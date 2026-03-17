import z from "zod"
import { Tool } from "./tool"
import { Observation } from "../observation/observation"
import { Instance } from "../project/instance"

export const ObservationSearchTool = Tool.define("observation_search", {
  description: `Search past tool executions from across all sessions.
  
Useful for:
- Recalling previous security analysis ("What did I find on Anduril last week?")
- Finding similar code patterns ("Where did I edit this file before?")
- Tracking progress on ongoing tasks ("What was the status on X?")
- Cross-session context ("We already analyzed this in session Y")

**3-layer retrieval:**
1. Search index (fast, ~50 tokens/result) — returns matching summaries
2. Timeline context — observations around matches
3. Full content (lazy load) — only when needed

**Search tips:**
- Use keywords from your goal, not exact phrases
- "hackerone findings critical" better than "what did I find"
- Filter by type to narrow: type:file_edit, type:bash, type:browser`,
  parameters: z.object({
    query: z.string().describe("Search query (e.g. 'Anduril CORS findings', 'DoorDash API endpoints')"),
    type: z
      .enum(["file_edit", "file_read", "bash", "search", "browser", "memory", "error", "other"])
      .optional()
      .describe("Filter by observation type"),
    limit: z.number().int().min(1).max(50).optional().describe("Max results to return (default: 10)"),
  }),
  async execute(params, _ctx) {
    try {
      const results = await Observation.search({
        projectId: Instance.project.id,
        query: params.query,
        type: params.type,
        limit: params.limit ?? 10,
      })

      if (results.length === 0) {
        return {
          title: "No Results",
          output: `No observations found for "${params.query}${params.type ? ` (type: ${params.type})` : ""}"`,
          metadata: {} as any,
        }
      }

      const formatted = results
        .map((r, i) => {
          const ago = Math.floor((Date.now() - r.created) / 60000)
          const agoStr = ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.floor(ago / 60)}h` : `${Math.floor(ago / 1440)}d`
          return `[${i + 1}] ${r.type.padEnd(10)} (${agoStr} ago)\n${r.summary}`
        })
        .join("\n\n")

      return {
        title: "Observations",
        output: `Found ${results.length} results:\n\n${formatted}\n\nUse observation_get with an ID to view full content and timeline context.`,
        metadata: {} as any,
      }
    } catch (err: any) {
      return {
        title: "Search Error",
        output: `${err.message || err}`,
        metadata: {} as any,
      }
    }
  },
})

export const ObservationGetTool = Tool.define("observation_get", {
  description: `Get full details of an observation from observation_search.
  
Retrieves the complete observation with timeline context (5 before + 5 after).
Shows related observations that happened nearby in time for broader context.`,
  parameters: z.object({
    id: z.string().describe("Observation ID from observation_search results"),
    timeline: z.boolean().optional().describe("Include timeline context (default: true)"),
  }),
  async execute(params, _ctx) {
    try {
      const obs = await Observation.getByIds([params.id])
      if (obs.length === 0) {
        return {
          title: "Not Found",
          output: `Observation ${params.id} not found`,
          metadata: {} as any,
        }
      }

      const o = obs[0]
      let content = `**Tool:** ${o.tool}\n**Type:** ${o.type}\n**Created:** ${new Date(o.created).toISOString()}\n\n`
      content += `**Summary:**\n${o.summary}\n\n`

      if (o.content) {
        content += `**Full Content:**\n${o.content.slice(0, 2000)}\n`
        if (o.content.length > 2000) content += `\n... (${o.content.length - 2000} chars more)`
      }

      if (o.tags) {
        content += `\n\n**Tags:** ${o.tags}`
      }

      if (params.timeline !== false) {
        const timeline = await Observation.timeline({
          projectId: Instance.project.id,
          observationId: params.id,
        })

        if (timeline.length > 1) {
          content += `\n\n**Timeline Context:**\n`
          timeline.forEach((t) => {
            const marker = t.id === o.id ? " ← " : "   "
            const ago = Math.floor((Date.now() - t.created) / 60000)
            const agoStr = ago < 60 ? `${ago}m` : ago < 1440 ? `${Math.floor(ago / 60)}h` : `${Math.floor(ago / 1440)}d`
            content += `${marker}[${t.tool}] ${agoStr} ago: ${t.summary.slice(0, 100)}\n`
          })
        }
      }

      return {
        title: "Observation",
        output: content,
        metadata: {} as any,
      }
    } catch (err: any) {
      return {
        title: "Error",
        output: `${err.message || err}`,
        metadata: {} as any,
      }
    }
  },
})
