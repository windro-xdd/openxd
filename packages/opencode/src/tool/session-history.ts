import { z } from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"

export const SessionHistoryTool = Tool.define("session_history", {
  description: `Search through past session messages that are no longer in your active context. Use this when:
- The user asks about something from earlier in the conversation that you don't remember
- You need to recall a specific command output, code snippet, or discussion from earlier
- The user references something they told you before that's been compacted away
- You want to find a specific tool result or decision from earlier in this session

Actions:
- search: Search all messages in the current session by keyword
- recent: Get the N most recent messages (including compacted ones)
- get: Get a specific range of messages by index`,
  parameters: z.object({
    action: z.enum(["search", "recent", "get"]).describe("Action to perform"),
    query: z.string().optional().describe("Search query (for 'search' action)"),
    count: z.number().optional().describe("Number of messages to retrieve (default: 10)"),
    offset: z.number().optional().describe("Start offset for 'get' action (0-indexed, 0 = oldest)"),
    sessionID: z.string().optional().describe("Session ID to search (defaults to current session)"),
  }),
  async execute(input: any, ctx: any) {
    const sessionID = input.sessionID || ctx.sessionID
    const count = input.count ?? 10

    // Get all messages from the session (from DB, including compacted)
    const allMessages = await Session.messages({ sessionID, limit: 10000 })

    const formatMessage = (msg: MessageV2.WithParts, idx: number) => {
      const role = msg.info.role
      const time = new Date(msg.info.time.created).toISOString()
      const parts: string[] = []

      for (const part of msg.parts) {
        if (part.type === "text") {
          parts.push(part.text)
        } else if (part.type === "tool") {
          const state = part.state
          const toolName = part.tool
          const input = "input" in state ? JSON.stringify(state.input).slice(0, 200) : ""
          // Prefer original (pre-prune) output when available
          const raw = state.status === "completed" ? ((state as any).original ?? state.output ?? "") : ""
          const output = raw.slice(0, 500)
          parts.push(`[Tool: ${toolName}] ${input}${output ? "\n→ " + output : ""}`)
        } else if (part.type === "reasoning") {
          // Skip reasoning parts
        }
      }

      if (parts.length === 0) return null
      return `[${idx}] ${role} (${time}):\n${parts.join("\n")}`
    }

    if (input.action === "search") {
      if (!input.query) return { title: "", metadata: {}, output: "Error: query is required for search action" }

      const query = input.query.toLowerCase()
      const keywords = query.split(/\s+/).filter(Boolean)
      const matches: string[] = []

      for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i]
        const formatted = formatMessage(msg, i)
        if (!formatted) continue

        const lower = formatted.toLowerCase()
        if (keywords.some((k) => lower.includes(k))) {
          matches.push(formatted)
        }
      }

      const result = matches.slice(0, count)
      return {
        title: "",
        metadata: { totalMessages: allMessages.length, matchCount: matches.length },
        output:
          result.length > 0
            ? `Found ${matches.length} matches (showing ${result.length}):\n\n${result.join("\n\n---\n\n")}`
            : `No matches found for "${input.query}" in ${allMessages.length} messages.`,
      }
    }

    if (input.action === "recent") {
      const recent = allMessages.slice(0, count)
      const formatted = recent
        .map((msg, i) => formatMessage(msg, allMessages.length - recent.length + i))
        .filter(Boolean)

      return {
        title: "",
        metadata: { totalMessages: allMessages.length },
        output:
          formatted.length > 0
            ? `${formatted.length} most recent messages (of ${allMessages.length} total):\n\n${formatted.join("\n\n---\n\n")}`
            : "No messages found.",
      }
    }

    if (input.action === "get") {
      const offset = input.offset ?? 0
      const slice = allMessages.slice(offset, offset + count)
      const formatted = slice.map((msg, i) => formatMessage(msg, offset + i)).filter(Boolean)

      return {
        title: "",
        metadata: { totalMessages: allMessages.length },
        output:
          formatted.length > 0
            ? `Messages ${offset}-${offset + slice.length - 1} (of ${allMessages.length} total):\n\n${formatted.join("\n\n---\n\n")}`
            : "No messages in that range.",
      }
    }

    return { title: "", metadata: {}, output: "Unknown action" }
  },
})
