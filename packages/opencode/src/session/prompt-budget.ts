import { SessionCompaction } from "./compaction"
import { Token } from "../util/token"
import { ProviderTransform } from "../provider/transform"
import { MessageV2 } from "./message-v2"
import type { Provider } from "../provider/provider"

function estimateSystem(system: (string | unknown)[]) {
  let sum = 0
  for (const item of system) {
    sum += Token.estimate(typeof item === "string" ? item : JSON.stringify(item))
  }
  return sum
}

function estimateMessages(messages: MessageV2.WithParts[]) {
  let sum = 0
  for (const msg of messages) {
    for (const part of msg.parts) {
      if (part.type === "text") {
        sum += Token.estimate(part.text)
        continue
      }
      if (part.type === "file") {
        sum += Token.estimateDataUrl(part.url)
        continue
      }
      if (part.type !== "tool") continue
      const output = part.state.status === "completed" ? (part.state.output ?? "") : ""
      sum += Token.estimate(output) + Token.estimate(JSON.stringify(part.state.input ?? {}))
      if (part.state.status !== "completed" || part.state.time.compacted) continue
      for (const att of part.state.attachments ?? []) {
        sum += Token.estimateDataUrl(att.url)
      }
    }
  }
  return sum
}

function stripOldMedia(messages: MessageV2.WithParts[]) {
  const userIdx = messages.findLastIndex((m) => m.info.role === "user")
  for (let i = 0; i < messages.length; i++) {
    if (i === userIdx) continue
    const msg = messages[i]
    msg.parts = msg.parts.filter((p) => !(p.type === "file" && MessageV2.isMedia(p.mime)))
    for (const part of msg.parts) {
      if (part.type !== "tool" || part.state.status !== "completed" || part.state.time.compacted) continue
      if (!part.state.attachments?.length) continue
      part.state.attachments = []
      part.state.time.compacted = Date.now()
    }
  }
}

export async function applyTokenPreflight(input: {
  model: Provider.Model
  sessionID: string
  system: (string | unknown)[]
  messages: MessageV2.WithParts[]
  log: { info(msg: string, data?: Record<string, unknown>): void }
  reload(): Promise<MessageV2.WithParts[]>
}) {
  const contextLimit = input.model.limit.context || 200_000
  const inputLimit = input.model.limit.input || contextLimit
  const maxOutput = ProviderTransform.maxOutputTokens(input.model)
  const safeInputLimit = Math.floor((inputLimit - maxOutput) * 0.9)

  let effective = input.messages
  const estimate = () => estimateSystem(input.system) + estimateMessages(effective)
  let estimated = estimate()
  if (estimated <= safeInputLimit) {
    return effective
  }

  input.log.info("pre-flight: estimated tokens exceed safe limit, pruning + re-windowing", {
    sessionID: input.sessionID,
    estimatedTokens: estimated,
    safeInputLimit,
    contextLimit,
  })

  await SessionCompaction.emergencyPrune({ sessionID: input.sessionID })
  effective = SessionCompaction.slidingWindow(await input.reload(), input.model)

  estimated = estimate()
  if (estimated <= safeInputLimit) {
    return effective
  }

  input.log.info("pre-flight: still over limit after pruning, stripping old media", {
    sessionID: input.sessionID,
    reEstimated: estimated,
    safeInputLimit,
  })
  stripOldMedia(effective)
  return effective
}
