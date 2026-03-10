import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { Instance } from "../project/instance"

export const SessionHistoryTool = Tool.define("session_history", {
  description: `List and read OTHER sessions (not the current one). Use this to check what work was done in previous sessions, or when the user references something from a past conversation.

Actions:
- "list": Show recent sessions with titles and timestamps. Skip the current session — look at other ones.
- "read": Read messages from a specific session by its sessionID.

Use this when the user references context you don't have — check recent sessions before saying you don't know.`,
  parameters: z.object({
    action: z.enum(["list", "read"]).describe("Whether to list sessions or read a specific session's messages"),
    sessionID: z
      .string()
      .optional()
      .describe("Session ID to read (required for 'read' action)"),
    limit: z
      .number()
      .optional()
      .describe("Number of sessions to list (default 10) or messages to read (default 20)"),
    search: z
      .string()
      .optional()
      .describe("Filter sessions by title (case-insensitive, only for 'list' action)"),
    excludeSessionID: z
      .string()
      .optional()
      .describe("Session ID to exclude from results (use this to skip the current session)"),
  }),
  async execute(params, ctx) {
    if (params.action === "list") {
      const sessions: Session.Info[] = []
      for (const session of Session.list({
        directory: Instance.directory,
        roots: true,
        limit: (params.limit ?? 10) + (params.excludeSessionID ? 1 : 0),
        search: params.search,
      })) {
        if (params.excludeSessionID && session.id === params.excludeSessionID) continue
        sessions.push(session)
      }

      if (sessions.length === 0) {
        return {
          title: "No sessions found",
          output: "No sessions found" + (params.search ? ` matching "${params.search}"` : ""),
          metadata: { count: 0 },
        }
      }

      const lines = sessions.map((s) => {
        const created = new Date(s.time.created).toLocaleString()
        const updated = new Date(s.time.updated).toLocaleString()
        return `- **${s.title || "(untitled)"}** (${s.id})\n  Created: ${created} | Updated: ${updated}`
      })

      return {
        title: `${sessions.length} sessions`,
        output: `Found ${sessions.length} session(s):\n\n${lines.join("\n\n")}`,
        metadata: { count: sessions.length },
      }
    }

    // action === "read"
    if (!params.sessionID) {
      return {
        title: "Error",
        output: "sessionID is required for 'read' action. Use action 'list' first to find session IDs.",
        metadata: {},
      }
    }

    const messages = await Session.messages({ sessionID: params.sessionID })
    if (!messages || messages.length === 0) {
      return {
        title: "No messages",
        output: `No messages found in session ${params.sessionID}`,
        metadata: { count: 0 },
      }
    }

    const limit = params.limit ?? 20
    const recent = messages.slice(-limit)

    const lines = recent.map((msg) => {
      const role = msg.info.role === "user" ? "User" : "Assistant"
      const time = msg.info.time?.created
        ? new Date(msg.info.time.created).toLocaleString()
        : ""

      // Extract text content from parts
      const textParts = msg.parts
        .filter((p) => p.type === "text" && p.text)
        .map((p) => (p as any).text as string)

      // For tool parts, just show a brief summary
      const toolParts = msg.parts
        .filter((p) => p.type === "tool")
        .map((p) => {
          const tool = p as any
          return `[Tool: ${tool.tool}]`
        })

      const content = [...textParts, ...toolParts].join("\n") || "(no text content)"

      // Truncate long content
      const maxLen = 500
      const truncated = content.length > maxLen
        ? content.slice(0, maxLen) + "... (truncated)"
        : content

      return `**${role}** ${time ? `(${time})` : ""}:\n${truncated}`
    })

    // Get session info for title
    const session = await Session.get(params.sessionID)
    const title = session?.title || params.sessionID

    return {
      title: `Session: ${title}`,
      output: `Session: ${title}\nShowing last ${recent.length} of ${messages.length} messages:\n\n${lines.join("\n\n---\n\n")}`,
      metadata: { count: recent.length, total: messages.length },
    }
  },
})
