import z from "zod"
import { LoopTypes } from "./types"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { MessageV2 } from "@/session/message-v2"
import { Session } from "@/session"
import { Identifier } from "@/id/id"
import { SessionStatus } from "@/session/status"

export namespace LoopController {
  const log = Log.create({ service: "loop" })

  export const Event = {
    Progress: BusEvent.define(
      "loop.progress",
      z.object({
        sessionID: z.string(),
        iteration: z.number(),
        maxIterations: z.number(),
        reason: z.string(),
      }),
    ),
    Paused: BusEvent.define(
      "loop.paused",
      z.object({
        sessionID: z.string(),
        iteration: z.number(),
        reason: z.string(),
      }),
    ),
    Completed: BusEvent.define(
      "loop.completed",
      z.object({
        sessionID: z.string(),
        iterations: z.number(),
        reason: z.string(),
      }),
    ),
  }

  // Active loop states per session
  const loops = Instance.state(() => {
    return new Map<string, LoopTypes.State>()
  })

  /** Start a new autonomous loop for a session */
  export function start(sessionID: string, modeName: string, maxIterations: number): LoopTypes.State {
    const state: LoopTypes.State = {
      active: true,
      iteration: 0,
      maxIterations,
      sessionID,
      modeName,
      lastOutputHash: null,
      sameOutputCount: 0,
      lastFileChangeCount: 0,
      noChangeCount: 0,
      startTime: Date.now(),
    }
    loops().set(sessionID, state)
    log.info("loop started", { sessionID, modeName, maxIterations })
    return state
  }

  /** Get the active loop state for a session */
  export function get(sessionID: string): LoopTypes.State | undefined {
    return loops().get(sessionID)
  }

  /** Cancel the loop for a session */
  export function cancel(sessionID: string): void {
    const state = loops().get(sessionID)
    if (state) {
      state.active = false
      loops().delete(sessionID)
      log.info("loop cancelled", { sessionID, iteration: state.iteration })
    }
  }

  /** Check if a session has an active loop */
  export function isActive(sessionID: string): boolean {
    return loops().get(sessionID)?.active ?? false
  }

  /**
   * Evaluate whether the loop should continue after a model turn completes.
   *
   * Returns "continue", "stop", or "pause" with a reason.
   * - stop: task is done or max iterations reached
   * - pause: agent appears stuck, needs user input
   * - continue: keep going
   */
  export async function evaluate(sessionID: string): Promise<LoopTypes.Evaluation> {
    const state = loops().get(sessionID)
    if (!state || !state.active) {
      return { action: "stop", reason: "No active loop" }
    }

    // 1. Max iterations
    if (state.iteration >= state.maxIterations) {
      return { action: "stop", reason: `Reached max iterations (${state.maxIterations})` }
    }

    // 2. Get last assistant message to analyze
    const msgs = await Session.messages({ sessionID })
    const lastAssistant = findLastAssistant(msgs)

    if (!lastAssistant) {
      return { action: "continue", reason: "No assistant message yet" }
    }

    // 3. Check if model thinks it's done
    const lastText = extractAssistantText(lastAssistant)
    if (lastAssistant.info.role === "assistant") {
      const assistantInfo = lastAssistant.info as MessageV2.Assistant
      if (assistantInfo.finish === "stop" && looksComplete(lastText)) {
        return { action: "stop", reason: "Task appears complete" }
      }
    }

    // 4. Stuck detection — same output hash
    const outputHash = simpleHash(lastText)
    if (outputHash === state.lastOutputHash) {
      state.sameOutputCount++
      if (state.sameOutputCount >= 2) {
        return {
          action: "pause",
          reason: "Agent appears stuck — same output repeated. Waiting for input.",
        }
      }
    } else {
      state.sameOutputCount = 0
      state.lastOutputHash = outputHash
    }

    // 5. No progress detection — check if tool calls are producing changes
    const toolParts = lastAssistant.parts.filter((p) => p.type === "tool")
    const hasWriteTools = toolParts.some(
      (p) => p.type === "tool" && ["write", "edit", "multiedit", "patch", "bash"].includes(p.tool),
    )

    if (!hasWriteTools && state.iteration > 3) {
      state.noChangeCount++
      if (state.noChangeCount >= 3) {
        return {
          action: "pause",
          reason: "No file modifications in recent iterations. Need direction?",
        }
      }
    } else {
      state.noChangeCount = 0
    }

    // 6. Error in last response — don't auto-continue on errors
    if (lastAssistant.info.role === "assistant") {
      const assistantInfo = lastAssistant.info as MessageV2.Assistant
      if (assistantInfo.error) {
        return { action: "pause", reason: "Error in last response. Waiting for input." }
      }
    }

    return { action: "continue", reason: `Iteration ${state.iteration + 1}` }
  }

  /** Increment iteration counter and publish progress */
  export function advance(sessionID: string): void {
    const state = loops().get(sessionID)
    if (!state) return
    state.iteration++
    // Update session status to show loop progress in TUI
    SessionStatus.set(sessionID, {
      type: "loop",
      mode: state.modeName,
      iteration: state.iteration,
      maxIterations: state.maxIterations,
    })
    Bus.publish(Event.Progress, {
      sessionID,
      iteration: state.iteration,
      maxIterations: state.maxIterations,
      reason: `Iteration ${state.iteration}`,
    })
  }

  /** Build the continuation prompt injected between loop iterations */
  export function continuationPrompt(state: LoopTypes.State): string {
    return [
      `[Loop iteration ${state.iteration + 1}/${state.maxIterations}]`,
      "",
      "Review what you've done so far and continue with the next step.",
      "If the task is fully complete, say so clearly and stop.",
      "If you're stuck, explain what you've tried.",
    ].join("\n")
  }

  /**
   * Inject a synthetic continuation message into the session.
   * This is what drives the next iteration of the loop.
   */
  export async function injectContinuation(
    sessionID: string,
    state: LoopTypes.State,
    userMessage: MessageV2.User,
  ): Promise<void> {
    const msg = await Session.updateMessage({
      id: Identifier.ascending("message"),
      role: "user",
      sessionID,
      time: { created: Date.now() },
      agent: userMessage.agent,
      model: userMessage.model,
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: msg.id,
      sessionID,
      type: "text",
      synthetic: true,
      text: continuationPrompt(state),
      time: {
        start: Date.now(),
        end: Date.now(),
      },
    })
  }
}

// --- Helpers ---

function findLastAssistant(msgs: MessageV2.WithParts[]): MessageV2.WithParts | undefined {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].info.role === "assistant") return msgs[i]
  }
  return undefined
}

function extractAssistantText(msg: MessageV2.WithParts): string {
  return msg.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as any).text ?? "")
    .join("\n")
}

/** Simple string hash for stuck detection (not crypto, just comparison) */
function simpleHash(text: string): string {
  let hash = 0
  const str = text.slice(0, 2000) // Only hash first 2k chars
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return hash.toString(36)
}

/**
 * Heuristic: does the assistant's text indicate task completion?
 * No magic tokens — just natural language signals.
 */
function looksComplete(text: string): boolean {
  if (!text || text.length < 20) return false

  const doneSignals = [
    /\ball\s+(changes|tasks|steps|items|issues|errors|warnings)\s+(are\s+)?(now\s+)?(done|complete|finished|fixed|resolved)/i,
    /\btask\s+(is\s+)?(now\s+)?(done|complete|finished)/i,
    /\bsuccessfully\s+(completed|implemented|fixed|resolved|applied)/i,
    /\beverything\s+(is\s+)?(now\s+)?(done|ready|in\s+place|complete)/i,
    /\blet\s+me\s+know\s+if\s+(you\s+)?(need|want|have)/i,
    /\bimplementation\s+is\s+(now\s+)?(complete|done|finished)/i,
    /\ball\s+\d+\s+(issues|errors|warnings|problems)\s+(have\s+been\s+|are\s+)?(fixed|resolved)/i,
  ]

  // Need at least one done signal
  const hasDoneSignal = doneSignals.some((pattern) => pattern.test(text))
  if (!hasDoneSignal) return false

  // Check for counter-signals (agent still has more to do)
  const notDoneSignals = [
    /\bnext\s+(step|I'll|I\s+will|we\s+need)/i,
    /\bstill\s+need\s+to/i,
    /\bremaining\s+(tasks|steps|issues)/i,
    /\btodo:/i,
    /\bnow\s+(let's|I'll|I\s+will)\s+(move|proceed|continue)/i,
  ]

  const hasNotDone = notDoneSignals.some((pattern) => pattern.test(text))
  return !hasNotDone
}
