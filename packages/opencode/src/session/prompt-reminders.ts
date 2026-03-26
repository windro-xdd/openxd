import { MessageV2 } from "./message-v2"
import { detectCorrection } from "./lesson"

export { detectCorrection }

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
        "\n\n<system-reminder>The user appears to be correcting you. Verify the exact issue, fix it first, and only then continue.</system-reminder>"
      break
    }
  }
}
