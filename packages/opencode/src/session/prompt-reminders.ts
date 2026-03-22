import { MessageV2 } from "./message-v2"

const CORRECTION_PATTERNS = [
  /\bno[,.\s!]|^no$/i,
  /\bwrong\b/i,
  /\bnot what i/i,
  /\bnot right\b/i,
  /\bincorrect\b/i,
  /\byou missed\b/i,
  /\byou forgot\b/i,
  /\bstill not\b/i,
  /\bthat('s| is) not\b/i,
  /\bi (said|told you|already|mentioned)\b/i,
  /\brevert\b/i,
  /\bundo\b/i,
  /\bthat broke\b/i,
  /\bwhy did you\b/i,
  /\bnope\b/i,
]

export function detectCorrection(text: string): boolean {
  const lower = text.toLowerCase().trim()
  if (lower.length > 500) return false
  return CORRECTION_PATTERNS.some((p) => p.test(lower))
}

export function injectQueuedUserReminder(messages: MessageV2.WithParts[], lastFinishedID: string) {
  for (const msg of messages) {
    if (msg.info.role !== "user" || msg.info.id <= lastFinishedID) continue
    for (const part of msg.parts) {
      if (part.type !== "text" || part.ignored || part.synthetic) continue
      if (!part.text.trim()) continue
      part.text = [
        "<system-reminder>",
        "The user sent the following message:",
        part.text,
        "",
        "Please address this message and continue with your tasks.",
        "</system-reminder>",
      ].join("\n")
    }
  }
}

export function injectCorrectionReminder(messages: MessageV2.WithParts[], userID: string) {
  for (const msg of messages) {
    if (msg.info.role !== "user" || msg.info.id !== userID) continue
    for (const part of msg.parts) {
      if (part.type !== "text" || part.ignored || part.synthetic) continue
      if (!detectCorrection(part.text)) continue
      part.text +=
        "\n\n<system-reminder>The user appears to be correcting you. Stop and verify first: read the exact files/tool outputs involved, confirm the root cause, and only then reply with a fix. Do not answer from assumptions or memory.</system-reminder>"
      break
    }
  }
}
