import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import { Session } from "."
import { Identifier } from "../id/id"
import { Instance } from "../project/instance"
import { Provider } from "../provider/provider"
import { MessageV2 } from "./message-v2"
import z from "zod"
import { Token } from "../util/token"
import { Log } from "../util/log"
import { SessionProcessor } from "./processor"
import { fn } from "@/util/fn"
import { Agent } from "@/agent/agent"
import { Plugin } from "@/plugin"
import { Config } from "@/config/config"
import { ProviderTransform } from "@/provider/transform"

import { Todo } from "./todo"

export namespace SessionCompaction {
  const log = Log.create({ service: "session.compaction" })

  /**
   * Sliding window — token-budget aware. Keeps as many recent turns as fit
   * within a token budget (45% of context). Falls back to minimum 3 turns.
   * Returns filtered message array (does NOT mutate the DB).
   */
  export function slidingWindow(
    msgs: MessageV2.WithParts[],
    model: Provider.Model,
    options?: { keepTurns?: number },
  ): MessageV2.WithParts[] {
    const context = model.limit.context || 200_000
    const tokenBudget = Math.floor(context * 0.35)
    const minKeepTurns = 3
    const maxKeepTurns = options?.keepTurns ?? 30

    let tokenCount = 0
    let turnCount = 0
    let cutIndex = msgs.length
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      let msgTokens = 0
      for (const part of msg.parts) {
        if (part.type === "text") {
          msgTokens += Token.estimate(part.text)
        } else if (part.type === "tool") {
          const output = part.state.status === "completed" ? (part.state.output ?? "") : ""
          msgTokens += Token.estimate(output) + Token.estimate(JSON.stringify(part.state.input ?? {}))
          // Count tool attachments (screenshots, images from browser/tools)
          if (part.state.status === "completed" && !part.state.time.compacted) {
            for (const att of part.state.attachments ?? []) {
              msgTokens += Token.estimateDataUrl((att as any).url ?? "")
            }
          }
        } else if (part.type === "file") {
          // Account for image/PDF data URLs which can be massive
          msgTokens += Token.estimateDataUrl((part as any).url ?? "")
        }
      }

      if (msg.info.role === "user" && !msg.parts.some((p) => p.type === "compaction")) {
        turnCount++
      }

      if (tokenCount + msgTokens > tokenBudget && turnCount > minKeepTurns) {
        cutIndex = i + 1
        break
      }
      if (turnCount >= maxKeepTurns) {
        cutIndex = i
        break
      }

      tokenCount += msgTokens
    }

    if (cutIndex <= 0 || cutIndex >= msgs.length) return msgs

    const summaries = msgs
      .slice(0, cutIndex)
      .filter((m) => m.info.role === "assistant" && (m.info as MessageV2.Assistant).summary === true)
    const recent = msgs.slice(cutIndex)

    if (summaries.length > 0) {
      const lastSummary = summaries[summaries.length - 1]
      log.info("sliding window: token-aware trim", {
        dropped: cutIndex,
        kept: recent.length,
        tokenBudget,
        estimatedTokens: tokenCount,
        turns: turnCount,
      })
      return [lastSummary, ...recent]
    }

    log.info("sliding window: token-aware trim (no summary)", {
      dropped: cutIndex,
      kept: recent.length,
      tokenBudget,
      estimatedTokens: tokenCount,
      turns: turnCount,
    })
    return recent
  }

  /**
   * Check if sliding window should activate — at 75% capacity.
   */
  export async function shouldSlideWindow(input: { tokens: MessageV2.Assistant["tokens"]; model: Provider.Model }) {
    const config = await Config.get()
    if (config.compaction?.auto === false) return false
    const context = input.model.limit.context
    if (context === 0) return false

    const count =
      input.tokens.total ||
      input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

    const reserved =
      config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, ProviderTransform.maxOutputTokens(input.model))
    const usable = input.model.limit.input
      ? input.model.limit.input - reserved
      : context - ProviderTransform.maxOutputTokens(input.model)
    return count >= usable * 0.75
  }

  export const Event = {
    Compacted: BusEvent.define(
      "session.compacted",
      z.object({
        sessionID: z.string(),
      }),
    ),
  }

  const COMPACTION_BUFFER = 20_000

  export async function isOverflow(input: { tokens: MessageV2.Assistant["tokens"]; model: Provider.Model }) {
    const config = await Config.get()
    if (config.compaction?.auto === false) return false
    const context = input.model.limit.context
    if (context === 0) return false

    const count =
      input.tokens.total ||
      input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

    const reserved =
      config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, ProviderTransform.maxOutputTokens(input.model))
    const usable = input.model.limit.input
      ? input.model.limit.input - reserved
      : context - ProviderTransform.maxOutputTokens(input.model)
    return count >= usable
  }

  /**
   * Early pruning check — returns true when context usage is at ~70% of capacity.
   * Prune early to avoid hitting full compaction which blocks the conversation.
   */
  export async function shouldPrune(input: { tokens: MessageV2.Assistant["tokens"]; model: Provider.Model }) {
    const config = await Config.get()
    if (config.compaction?.prune === false) return false
    const context = input.model.limit.context
    if (context === 0) return false

    const count =
      input.tokens.total ||
      input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

    const reserved =
      config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, ProviderTransform.maxOutputTokens(input.model))
    const usable = input.model.limit.input
      ? input.model.limit.input - reserved
      : context - ProviderTransform.maxOutputTokens(input.model)
    // Trigger prune at 80% capacity — delayed to preserve tool outputs the agent still needs.
    // (Claude Code waits until ~95%. Early pruning destroys context prematurely.)
    return count >= usable * 0.8
  }

  /**
   * Proactive compaction check — returns true at ~90% capacity.
   * Triggers compaction BEFORE the model hits overflow, so it runs between turns (invisible to user).
   * This is the sweet spot: enough room to finish the current response, but compact before next one.
   */
  export async function shouldCompactProactively(input: {
    tokens: MessageV2.Assistant["tokens"]
    model: Provider.Model
  }) {
    const config = await Config.get()
    if (config.compaction?.auto === false) return false
    const context = input.model.limit.context
    if (context === 0) return false

    const count =
      input.tokens.total ||
      input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

    const reserved =
      config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, ProviderTransform.maxOutputTokens(input.model))
    const usable = input.model.limit.input
      ? input.model.limit.input - reserved
      : context - ProviderTransform.maxOutputTokens(input.model)
    return count >= usable * 0.9
  }

  export const PRUNE_MINIMUM = 5_000
  export const PRUNE_PROTECT = 10_000

  const PRUNE_PROTECTED_TOOLS = ["skill"]

  // Tool priority for pruning: lower number = prune first
  const TOOL_PRUNE_PRIORITY: Record<string, number> = {
    ls: 1,
    glob: 1,
    bash: 2,
    grep: 3,
    codesearch: 3,
    webfetch: 3,
    websearch: 3,
    read: 4,
    memory: 5,
    memory_search: 5,
    session_history: 5,
  }

  function getToolPriority(tool: string): number {
    return TOOL_PRUNE_PRIORITY[tool] ?? 2
  }

  // Soft trim: keep head + tail instead of fully clearing output
  function softTrim(output: string, headChars = 750, tailChars = 750): string {
    if (output.length <= headChars + tailChars + 50) return output
    const head = output.slice(0, headChars)
    const tail = output.slice(-tailChars)
    const truncated = output.length - headChars - tailChars
    return `${head}\n\n[... truncated ${truncated} chars ...]\n\n${tail}`
  }

  // Aggressive trim: reduce old tool output to just a short reference
  function aggressiveTrim(output: string, tool: string): string {
    const lines = output.split("\n").length
    const chars = output.length
    return `[Output: ${chars} chars, ${lines} lines — content pruned to save context]`
  }

  // goes backwards through parts until there are 20_000 tokens worth of tool
  // calls. then aggressively prunes output of previous tool calls.
  // Prunes low-priority tools first (ls/glob before read).
  export async function prune(input: { sessionID: string }) {
    const config = await Config.get()
    if (config.compaction?.prune === false) return
    log.info("pruning")
    const msgs = await Session.messages({ sessionID: input.sessionID })
    let total = 0
    let pruned = 0
    const candidates: { part: any; priority: number; estimate: number }[] = []
    let turns = 0

    loop: for (let msgIndex = msgs.length - 1; msgIndex >= 0; msgIndex--) {
      const msg = msgs[msgIndex]
      if (msg.info.role === "user") turns++
      if (turns < 2) continue
      if (msg.info.role === "assistant" && msg.info.summary) break loop
      for (let partIndex = msg.parts.length - 1; partIndex >= 0; partIndex--) {
        const part = msg.parts[partIndex]
        if (part.type === "tool")
          if (part.state.status === "completed") {
            if (PRUNE_PROTECTED_TOOLS.includes(part.tool)) continue

            // Don't stop at already-pruned parts — keep scanning for more to prune
            if (part.state.time.compacted) continue
            let estimate = Token.estimate(part.state.output)
            // Include attachment tokens (screenshots, browser images)
            for (const att of part.state.attachments ?? []) {
              estimate += Token.estimateDataUrl((att as any).url ?? "")
            }
            total += estimate
            if (total > PRUNE_PROTECT) {
              candidates.push({ part, priority: getToolPriority(part.tool), estimate })
            }
          }
      }
    }

    // Sort candidates: prune low-priority tools first
    candidates.sort((a, b) => a.priority - b.priority)

    for (const { part, estimate } of candidates) {
      pruned += estimate
    }

    log.info("found", { pruned, total, candidates: candidates.length })
    if (pruned > PRUNE_MINIMUM) {
      for (const { part } of candidates) {
        if (part.state.status === "completed") {
          // Preserve original output so session_history can recover it
          if (!(part.state as any).original) {
            ;(part.state as any).original = part.state.output
          }
          // Aggressive prune — replace with tiny summary and clear attachments
          part.state.output = aggressiveTrim(part.state.output, part.tool)
          part.state.attachments = [] // Clear screenshots/images
          part.state.time.compacted = Date.now()
          await Session.updatePart(part)
        }
      }
      log.info("pruned", { count: candidates.length })
    }
  }

  /**
   * Emergency prune — nukes ALL tool outputs regardless of age/priority.
   * Used when normal pruning isn't enough to prevent overflow.
   * Only protects the most recent turn's tool outputs.
   */
  export async function emergencyPrune(input: { sessionID: string }) {
    log.info("emergency pruning — clearing ALL old tool outputs")
    const msgs = await Session.messages({ sessionID: input.sessionID })
    let pruned = 0
    let turns = 0

    for (let msgIndex = msgs.length - 1; msgIndex >= 0; msgIndex--) {
      const msg = msgs[msgIndex]
      if (msg.info.role === "user") turns++
      // Protect only the most recent turn (turns < 1)
      if (turns < 1) continue
      if (msg.info.role === "assistant" && msg.info.summary) break
      for (const part of msg.parts) {
        if (part.type === "tool" && part.state.status === "completed") {
          if (part.state.time.compacted) continue
          const estimate = Token.estimate(part.state.output)
          // Also count attachment tokens (screenshots, images from browser tools)
          let attachmentTokens = 0
          for (const att of part.state.attachments ?? []) {
            attachmentTokens += Token.estimateDataUrl((att as any).url ?? "")
          }
          if (estimate > 100 || attachmentTokens > 100) {
            // Preserve original output so session_history can recover it
            if (!(part.state as any).original) {
              ;(part.state as any).original = part.state.output
            }
            part.state.output = `[${part.tool}: output cleared — emergency context recovery]`
            part.state.attachments = [] // Clear screenshots/images too
            part.state.time.compacted = Date.now()
            await Session.updatePart(part)
            pruned += estimate + attachmentTokens
          }
        }
      }
    }
    log.info("emergency pruned", { pruned })
    return pruned
  }

  export async function process(input: {
    parentID: string
    messages: MessageV2.WithParts[]
    sessionID: string
    abort: AbortSignal
    auto: boolean
    overflow?: boolean
  }) {
    const userMessage = input.messages.findLast((m) => m.info.id === input.parentID)!.info as MessageV2.User

    let messages = input.messages
    let replay: MessageV2.WithParts | undefined

    // Find the last compaction summary — we only need messages after it
    // Previous compaction summaries already capture older context
    const lastCompactionIdx = input.messages.findLastIndex(
      (m) => m.info.role === "assistant" && (m.info as MessageV2.Assistant).summary === true,
    )
    if (lastCompactionIdx >= 0 && !input.overflow) {
      // Include the compaction summary + everything after it
      messages = input.messages.slice(lastCompactionIdx)
    }

    if (input.overflow) {
      const idx = input.messages.findIndex((m) => m.info.id === input.parentID)
      for (let i = idx - 1; i >= 0; i--) {
        const msg = input.messages[i]
        if (msg.info.role === "user" && !msg.parts.some((p) => p.type === "compaction")) {
          replay = msg
          messages = input.messages.slice(0, i)
          break
        }
      }
      const hasContent =
        replay && messages.some((m) => m.info.role === "user" && !m.parts.some((p) => p.type === "compaction"))
      if (!hasContent) {
        replay = undefined
        messages = input.messages
      }
    }

    const agent = await Agent.get("compaction")
    const model = agent.model
      ? await Provider.getModel(agent.model.providerID, agent.model.modelID)
      : await Provider.getModel(userMessage.model.providerID, userMessage.model.modelID)
    const msg = (await Session.updateMessage({
      id: Identifier.ascending("message"),
      role: "assistant",
      parentID: input.parentID,
      sessionID: input.sessionID,
      mode: "compaction",
      agent: "compaction",
      variant: userMessage.variant,
      summary: true,
      path: {
        cwd: Instance.directory,
        root: Instance.worktree,
      },
      cost: 0,
      tokens: {
        output: 0,
        input: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      modelID: model.id,
      providerID: model.providerID,
      time: {
        created: Date.now(),
      },
    })) as MessageV2.Assistant
    const processor = SessionProcessor.create({
      assistantMessage: msg,
      sessionID: input.sessionID,
      model,
      abort: input.abort,
    })
    // Allow plugins to inject context or replace compaction prompt
    const compacting = await Plugin.trigger(
      "experimental.session.compacting",
      { sessionID: input.sessionID },
      { context: [], prompt: undefined },
    )
    const defaultPrompt = `Provide a detailed summary for continuing this conversation. Another agent will read this and continue the work seamlessly — it must not lose track of anything.

CRITICAL: Focus on the MOST RECENT work first. The last few messages before this compaction are the most important — that's what the next agent needs to continue. Do NOT spend most of the summary on earlier history while glossing over what's happening right now.

IMPORTANT: Keep the summary CONCISE — aim for under 2000 tokens. Be dense and information-rich, not verbose. The summary itself consumes context window space, so a bloated summary defeats the purpose of compaction.

Use this exact template:
---
## Current Task

[What is the user CURRENTLY trying to do RIGHT NOW? Be specific — not "working on auth" but "adding RS256 JWT validation to the /api/login endpoint, replacing the old HS256 implementation"]

## Task State

- Completed: [what's done, with specific file paths]
- In Progress: [what's actively being worked on — the exact step that was interrupted]
- Remaining: [what still needs to be done]

## User Instructions

- [List EVERY instruction, preference, or constraint the user gave — even small ones like "don't use semicolons" or "test with vitest not jest"]
- [Include the original request verbatim if it was specific]

## Key Discoveries

- [Non-obvious things learned: error patterns, API quirks, codebase patterns, gotchas]
- [Things that DIDN'T work and why — so the next agent doesn't retry them]

## Files

[Every file that was read, edited, or created — with a one-line note on what was done to each]
- \`src/auth/jwt.ts\` — replaced HS256 with RS256, added token refresh
- \`src/routes/login.ts\` — added rate limiter middleware
- \`tests/auth.test.ts\` — created, 3 tests passing

## Context

[Any other context needed to continue: environment vars required, services that need to be running, branches checked out, etc.]
---

Be thorough. If the next agent asks "what was I doing?" this summary should answer it completely.

IMPORTANT: Before summarizing, if you have access to the memory tool, save any key discoveries, decisions, or important context to MEMORY.md or today's daily memory file. This ensures nothing is permanently lost during compaction.

Also note in your summary if you learned anything new about the user (preferences, workflow, communication style) so the next agent can update USER.md, SOUL.md, or IDENTITY.md accordingly.`

    const promptText = compacting.prompt ?? [defaultPrompt, ...compacting.context].join("\n\n")

    // === SAFE COMPACTION: Pre-truncate messages to prevent compaction itself from overflowing ===
    // Estimate total tokens in the messages we're about to send for compaction
    const compactionContext = model.limit.context || 200_000
    const compactionBudget = Math.floor(compactionContext * 0.5) // Use at most 50% for history, leave room for prompt + response
    let estimatedTotal = 0
    for (const m of messages) {
      for (const part of m.parts) {
        if (part.type === "text") {
          estimatedTotal += Token.estimate(part.text)
        } else if (part.type === "tool") {
          const output = part.state.status === "completed" ? (part.state.output ?? "") : ""
          estimatedTotal += Token.estimate(output) + Token.estimate(JSON.stringify(part.state.input ?? {}))
        }
      }
    }

    if (estimatedTotal > compactionBudget) {
      log.info("pre-truncating messages for safe compaction", {
        estimatedTotal,
        compactionBudget,
        messageCount: messages.length,
      })

      // Step 1: Clear all old tool outputs in the messages we'll send (in-memory only, not persisted)
      // We clone to avoid mutating the original messages
      const clonedMessages: MessageV2.WithParts[] = messages.map((m) => ({
        info: m.info,
        parts: m.parts.map((p) => {
          if (p.type === "tool" && p.state.status === "completed" && !PRUNE_PROTECTED_TOOLS.includes(p.tool)) {
            return {
              ...p,
              state: {
                ...p.state,
                output: `[Tool: ${p.tool} — output cleared for compaction]`,
                attachments: undefined,
              },
            } as MessageV2.ToolPart
          }
          return p
        }),
      }))

      // Step 2: Re-estimate and apply sliding window if still too large
      let reEstimated = 0
      for (const m of clonedMessages) {
        for (const part of m.parts) {
          if (part.type === "text") {
            reEstimated += Token.estimate(part.text)
          } else if (part.type === "tool") {
            const output = part.state.status === "completed" ? (part.state.output ?? "") : ""
            reEstimated += Token.estimate(output) + Token.estimate(JSON.stringify(part.state.input ?? {}))
          }
        }
      }

      if (reEstimated > compactionBudget) {
        // Apply sliding window to keep only recent messages within budget
        const windowedMessages = slidingWindow(clonedMessages, model, { keepTurns: 15 })
        log.info("compaction sliding window applied", {
          before: clonedMessages.length,
          after: windowedMessages.length,
          reEstimated,
          compactionBudget,
        })
        messages = windowedMessages
      } else {
        messages = clonedMessages
      }
    }

    // Inject current todo list so compaction doesn't lose track of active tasks
    const todos = Todo.get(input.sessionID)
    const todoContext =
      todos.length > 0
        ? "\n\n## ACTIVE TODO LIST (MUST be preserved in summary)\n" +
          todos.map((t) => `- [${t.status}] ${t.content}`).join("\n") +
          "\n\nThe todo list above represents the user's CURRENT active task. Your summary MUST include these items and their status. The next agent needs to continue from where this left off."
        : ""

    // Add a timeout to prevent compaction from hanging forever
    const compactionTimeout = 120_000 // 2 minutes max
    const timeoutController = new AbortController()
    const combinedAbort = new AbortController()
    const onParentAbort = () => combinedAbort.abort()
    const onTimeout = () => combinedAbort.abort()
    input.abort.addEventListener("abort", onParentAbort, { once: true })
    const timer = setTimeout(onTimeout, compactionTimeout)

    const result = await processor.process({
      user: userMessage,
      agent,
      abort: combinedAbort.signal,
      sessionID: input.sessionID,
      tools: {},
      system: [],
      messages: [
        ...MessageV2.toModelMessages(messages, model, { stripMedia: true }),
        {
          role: "user",
          content: [
            {
              type: "text",
              text: promptText + todoContext,
            },
          ],
        },
      ],
      model,
    })

    // Clean up compaction timeout
    clearTimeout(timer)
    input.abort.removeEventListener("abort", onParentAbort)

    // Validate compaction summary quality — warn if too short or missing critical sections
    if (result === "continue") {
      const allMsgs = await Session.messages({ sessionID: input.sessionID })
      const summary = allMsgs.find((m) => m.info.id === msg.id)
      if (summary) {
        const text = summary.parts
          .filter((p: MessageV2.Part): p is MessageV2.TextPart => p.type === "text")
          .map((p: MessageV2.TextPart) => p.text)
          .join("\n")
        if (text.length < 200) {
          log.error("compaction summary suspiciously short — context may be lost", {
            length: text.length,
            sessionID: input.sessionID,
          })
        }
        const sections = ["Current Task", "Files", "Task State"]
        const missing = sections.filter((s) => !text.includes(s))
        if (missing.length > 0) {
          log.warn("compaction summary missing expected sections", {
            missing,
            sessionID: input.sessionID,
          })
        }
      }
    }

    if (result === "compact") {
      processor.message.error = new MessageV2.ContextOverflowError({
        message: replay
          ? "Conversation history too large to compact - exceeds model context limit"
          : "Session too large to compact - context exceeds model limit even after stripping media",
      }).toObject()
      processor.message.finish = "error"
      await Session.updateMessage(processor.message)
      return "stop"
    }

    if (result === "continue" && input.auto) {
      if (replay) {
        const original = replay.info as MessageV2.User
        const replayMsg = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: input.sessionID,
          time: { created: Date.now() },
          agent: original.agent,
          model: original.model,
          format: original.format,
          tools: original.tools,
          system: original.system,
          variant: original.variant,
        })
        for (const part of replay.parts) {
          if (part.type === "compaction") continue
          const replayPart =
            part.type === "file" && MessageV2.isMedia(part.mime)
              ? { type: "text" as const, text: `[Attached ${part.mime}: ${part.filename ?? "file"}]` }
              : part
          await Session.updatePart({
            ...replayPart,
            id: Identifier.ascending("part"),
            messageID: replayMsg.id,
            sessionID: input.sessionID,
          })
        }
        // Add continuation instruction after replay
        await Session.updatePart({
          id: Identifier.ascending("part"),
          messageID: replayMsg.id,
          sessionID: input.sessionID,
          type: "text",
          synthetic: true,
          text: "\n[System: Context was compacted. Continue exactly where you left off — do NOT re-read memory files, summarize history, or start over. The summary above has everything you need.]",
        })
      } else {
        const continueMsg = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: input.sessionID,
          time: { created: Date.now() },
          agent: userMessage.agent,
          model: userMessage.model,
        })
        const text =
          (input.overflow
            ? "The previous request exceeded the provider's size limit due to large media attachments. The conversation was compacted and media files were removed from context. If the user was asking about attached images or files, explain that the attachments were too large to process and suggest they try again with smaller or fewer files.\n\n"
            : "") +
          "Continue exactly where you left off. The compaction summary above contains everything you need — do NOT re-read memory files, summarize history, or explain what happened before. Just pick up the task and keep going."
        await Session.updatePart({
          id: Identifier.ascending("part"),
          messageID: continueMsg.id,
          sessionID: input.sessionID,
          type: "text",
          synthetic: true,
          text,
          time: {
            start: Date.now(),
            end: Date.now(),
          },
        })
      }
    }
    if (processor.message.error) return "stop"
    Bus.publish(Event.Compacted, { sessionID: input.sessionID })
    return "continue"
  }

  export const create = fn(
    z.object({
      sessionID: Identifier.schema("session"),
      agent: z.string(),
      model: z.object({
        providerID: z.string(),
        modelID: z.string(),
      }),
      auto: z.boolean(),
      overflow: z.boolean().optional(),
    }),
    async (input) => {
      const msg = await Session.updateMessage({
        id: Identifier.ascending("message"),
        role: "user",
        model: input.model,
        sessionID: input.sessionID,
        agent: input.agent,
        time: {
          created: Date.now(),
        },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        messageID: msg.id,
        sessionID: msg.sessionID,
        type: "compaction",
        auto: input.auto,
        overflow: input.overflow,
      })
    },
  )
}
