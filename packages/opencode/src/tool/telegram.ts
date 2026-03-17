import z from "zod"
import { Tool } from "./tool"
import { TelegramState } from "../telegram/state"
import { TelegramBot } from "../telegram/bot"

export const TelegramTool = Tool.define("telegram", {
  description: `Manage Telegram bot pairing. Actions:
- pair: Approve a pairing code from a Telegram user wanting to connect
- users: List all paired Telegram users  
- remove: Unpair a Telegram user by their user ID`,
  parameters: z.object({
    action: z
      .enum(["pair", "users", "remove"])
      .describe("Action: pair (approve code), users (list paired), remove (unpair user)"),
    code: z.string().optional().describe("Pairing code (required for 'pair' action)"),
    userId: z.number().optional().describe("User ID to remove (required for 'remove' action)"),
  }),
  async execute(params) {
    switch (params.action) {
      case "pair": {
        if (!params.code) {
          return {
            title: "Telegram Pair",
            output: "Missing pairing code.",
            metadata: {} as any,
          }
        }
        const result = TelegramState.approvePairing(params.code)
        if (!result.success) {
          return {
            title: "Telegram Pair",
            output: "Invalid or expired pairing code. Codes expire after 10 minutes. Ask the user to send /start to the bot again for a new code.",
            metadata: {} as any,
          }
        }
        // Notify user on Telegram
        if (result.chatId) {
          TelegramBot.notify(result.chatId, "✅ *Paired successfully!* You can now send messages here.").catch(() => {})
        }
        return {
          title: "Telegram Pair",
          output: `✅ Successfully paired Telegram user: ${result.firstName || "Unknown"} (@${result.username || "unknown"}) [ID: ${result.userId}]`,
          metadata: {} as any,
        }
      }
      case "users": {
        const users = TelegramState.listPairedUsers()
        const pending = TelegramState.getPendingPairings()
        let output = `Paired users (${users.length}): ${users.length ? users.join(", ") : "none"}`
        if (pending.length > 0) {
          output += `\n\nPending pairing requests (${pending.length}):`
          for (const p of pending) {
            const age = Math.round((Date.now() - p.createdAt) / 1000)
            output += `\n  - ${p.firstName || "Unknown"} (@${p.username || "?"}) code: ${p.code} (${age}s ago)`
          }
        }
        return {
          title: "Telegram Users",
          output,
          metadata: {} as any,
        }
      }
      case "remove": {
        if (!params.userId) {
          return {
            title: "Telegram Remove",
            output: "Missing userId parameter.",
            metadata: {} as any,
          }
        }
        const removed = TelegramState.removePairedUser(params.userId)
        return {
          title: "Telegram Remove",
          output: removed
            ? `Removed user ${params.userId} from paired users.`
            : `User ${params.userId} not found in paired users.`,
          metadata: {} as any,
        }
      }
      default:
        return {
          title: "Telegram",
          output: "Unknown action.",
          metadata: {} as any,
        }
    }
  },
})
