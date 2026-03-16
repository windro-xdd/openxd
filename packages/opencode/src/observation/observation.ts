// Observation system — auto-captures tool results for cross-session memory
// Inspired by claude-mem but without external dependencies (no Chroma, no Python)
// Uses SQLite FTS5 for efficient full-text search

import { Database, eq, desc, and, sql, like, or, inArray } from "../storage/db"
import { ObservationTable } from "./observation.sql"
import { Log } from "../util/log"
import { ulid } from "ulid"

const log = Log.create({ service: "observation" })

export namespace Observation {
  export interface Info {
    id: string
    projectId: string
    sessionId: string
    tool: string
    type: string
    summary: string
    content?: string
    tags?: string
    created: number
  }

  // Tool output classification for filtering
  export type ObservationType =
    | "file_edit" // Edit/Write tool
    | "file_read" // Read/Glob tool
    | "bash" // Bash command
    | "search" // Grep/websearch
    | "browser" // Browser actions
    | "memory" // Memory tool
    | "error" // Tool errors
    | "decision" // User decisions/confirmations
    | "finding" // Bug bounty findings, discoveries
    | "other"

  function classify(tool: string, output: string): ObservationType {
    if (tool === "edit" || tool === "write") return "file_edit"
    if (tool === "read" || tool === "glob") return "file_read"
    if (tool === "bash") return "bash"
    if (tool === "grep" || tool === "websearch" || tool === "webfetch") return "search"
    if (tool === "browser") return "browser"
    if (tool === "memory" || tool === "memory_search") return "memory"
    if (output.toLowerCase().includes("error") || output.toLowerCase().includes("failed")) return "error"
    return "other"
  }

  function summarize(tool: string, input: any, output: string): string {
    // Generate a ~50-100 token summary of the tool execution
    const maxLen = 200

    switch (tool) {
      case "edit":
        return `Edited ${input?.filePath || "file"}: ${output.slice(0, maxLen)}`
      case "write":
        return `Wrote ${input?.filePath || "file"} (${input?.content?.length || 0} chars)`
      case "read":
        return `Read ${input?.filePath || "file"}`
      case "bash":
        return `Ran: ${input?.command?.slice(0, 100) || "command"}`
      case "grep":
        return `Searched "${input?.pattern}" in ${input?.path || "."}`
      case "browser":
        return `Browser ${input?.action}: ${output.slice(0, maxLen)}`
      case "websearch":
        return `Searched web: ${input?.query?.slice(0, 100)}`
      case "webfetch":
        return `Fetched ${input?.url}`
      default:
        return `${tool}: ${output.slice(0, maxLen)}`
    }
  }

  function extractTags(tool: string, input: any, output: string): string {
    const tags: string[] = [tool]

    // Extract file paths
    if (input?.filePath) {
      const parts = input.filePath.split("/")
      tags.push(parts[parts.length - 1]) // filename
      if (parts.length > 1) tags.push(parts[parts.length - 2]) // parent dir
    }

    // Extract URLs
    if (input?.url) {
      try {
        const url = new URL(input.url)
        tags.push(url.hostname)
      } catch {}
    }

    // Extract search patterns
    if (input?.pattern) tags.push(input.pattern.slice(0, 30))
    if (input?.query) tags.push(...input.query.split(/\s+/).slice(0, 3))

    return tags.join(" ")
  }

  // Capture a tool execution as an observation
  export async function capture(opts: {
    projectId: string
    sessionId: string
    tool: string
    input: any
    output: string
  }): Promise<void> {
    // Skip memory tool to avoid recursion
    if (opts.tool === "memory" || opts.tool === "memory_search") return
    // Skip very short outputs (not interesting)
    if (opts.output.length < 20) return

    const type = classify(opts.tool, opts.output)
    const summary = summarize(opts.tool, opts.input, opts.output)
    const tags = extractTags(opts.tool, opts.input, opts.output)

    // Truncate content to avoid DB bloat (keep first 2000 chars)
    const content = opts.output.length > 2000 ? opts.output.slice(0, 2000) + "..." : opts.output

    const id = ulid()
    const now = Date.now()

    try {
      Database.use((db) => {
        db.insert(ObservationTable)
          .values({
            id,
            project_id: opts.projectId,
            session_id: opts.sessionId,
            tool: opts.tool,
            type,
            summary,
            content,
            tags,
            time_created: now,
            time_updated: now,
          })
          .run()
      })

      // Also insert into FTS index
      Database.use((db) => {
        db.run(
          sql`INSERT INTO observation_fts (id, summary, content, tags) VALUES (${id}, ${summary}, ${content}, ${tags})`,
        )
      })
    } catch (err) {
      // FTS table might not exist yet (pre-migration), silently skip
      log.debug("observation capture failed", { err })
    }
  }

  // Search observations using FTS5
  export async function search(opts: {
    projectId: string
    query: string
    type?: ObservationType
    limit?: number
  }): Promise<{ id: string; summary: string; type: string; created: number; score: number }[]> {
    const limit = opts.limit ?? 20

    try {
      // Use FTS5 for search
      const results = Database.use((db) => {
        return db.all<{ id: string; summary: string; type: string; time_created: number; rank: number }>(sql`
          SELECT o.id, o.summary, o.type, o.time_created, fts.rank
          FROM observation_fts fts
          JOIN observation o ON fts.id = o.id
          WHERE observation_fts MATCH ${opts.query}
            AND o.project_id = ${opts.projectId}
            ${opts.type ? sql`AND o.type = ${opts.type}` : sql``}
          ORDER BY fts.rank
          LIMIT ${limit}
        `)
      })

      return results.map((r) => ({
        id: r.id,
        summary: r.summary,
        type: r.type,
        created: r.time_created,
        score: -r.rank, // FTS5 rank is negative (higher is better)
      }))
    } catch {
      // FTS not available, fall back to LIKE search
      const results = Database.use((db) => {
        return db
          .select({
            id: ObservationTable.id,
            summary: ObservationTable.summary,
            type: ObservationTable.type,
            created: ObservationTable.time_created,
          })
          .from(ObservationTable)
          .where(
            and(
              eq(ObservationTable.project_id, opts.projectId),
              opts.type ? eq(ObservationTable.type, opts.type) : undefined,
              or(like(ObservationTable.summary, `%${opts.query}%`), like(ObservationTable.tags, `%${opts.query}%`)),
            ),
          )
          .orderBy(desc(ObservationTable.time_created))
          .limit(limit)
          .all()
      })

      return results.map((r) => ({
        id: r.id,
        summary: r.summary,
        type: r.type,
        created: r.created!,
        score: 1,
      }))
    }
  }

  // Get timeline around a specific observation
  export async function timeline(opts: {
    projectId: string
    observationId?: string
    sessionId?: string
    before?: number
    after?: number
  }): Promise<Info[]> {
    const before = opts.before ?? 5
    const after = opts.after ?? 5

    let pivot: number | undefined

    if (opts.observationId) {
      const obsId = opts.observationId
      const obs = Database.use((db) =>
        db
          .select({ created: ObservationTable.time_created })
          .from(ObservationTable)
          .where(eq(ObservationTable.id, obsId))
          .get(),
      )
      pivot = obs?.created ?? undefined
    }

    const results = Database.use((db) => {
      let query = db
        .select()
        .from(ObservationTable)
        .where(
          and(
            eq(ObservationTable.project_id, opts.projectId),
            opts.sessionId ? eq(ObservationTable.session_id, opts.sessionId) : undefined,
          ),
        )
        .orderBy(desc(ObservationTable.time_created))
        .limit(before + after + 1)

      return query.all()
    })

    return results.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      sessionId: r.session_id,
      tool: r.tool,
      type: r.type,
      summary: r.summary,
      content: r.content ?? undefined,
      tags: r.tags ?? undefined,
      created: r.time_created!,
    }))
  }

  // Get full observation details by IDs (for the 3-layer retrieval pattern)
  export async function getByIds(ids: string[]): Promise<Info[]> {
    if (ids.length === 0) return []

    const results = Database.use((db) => {
      return db.select().from(ObservationTable).where(inArray(ObservationTable.id, ids)).all()
    })

    return results.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      sessionId: r.session_id,
      tool: r.tool,
      type: r.type,
      summary: r.summary,
      content: r.content ?? undefined,
      tags: r.tags ?? undefined,
      created: r.time_created!,
    }))
  }

  // Get recent observations for a project (for session start context)
  export async function recent(opts: {
    projectId: string
    limit?: number
    excludeSessionId?: string
  }): Promise<{ id: string; summary: string; type: string; created: number }[]> {
    const limit = opts.limit ?? 10

    const results = Database.use((db) => {
      return db
        .select({
          id: ObservationTable.id,
          summary: ObservationTable.summary,
          type: ObservationTable.type,
          created: ObservationTable.time_created,
        })
        .from(ObservationTable)
        .where(
          and(
            eq(ObservationTable.project_id, opts.projectId),
            opts.excludeSessionId ? sql`${ObservationTable.session_id} != ${opts.excludeSessionId}` : undefined,
          ),
        )
        .orderBy(desc(ObservationTable.time_created))
        .limit(limit)
        .all()
    })

    return results.map((r) => ({
      id: r.id,
      summary: r.summary,
      type: r.type,
      created: r.created!,
    }))
  }
}
