import { and, asc, eq, like, sql } from "@/storage/db"
import { Database } from "@/storage/db"
import { KnowledgeChunkTable, KnowledgeDocumentTable } from "./knowledge.sql"
import { ulid } from "ulid"
import type { Chunk } from "./chunk"
import type { Kind } from "./paths"

export type Document = typeof KnowledgeDocumentTable.$inferSelect
export type SearchRow = {
  id: string
  document_id: string
  path: string
  kind: string
  ordinal: number
  heading: string | null
  raw: string
  version: number
  start_line: number | null
  end_line: number | null
  score: number
}

function now() {
  return Date.now()
}

export namespace KnowledgeRepo {
  export function get(path: string) {
    return Database.use((db) => db.select().from(KnowledgeDocumentTable).where(eq(KnowledgeDocumentTable.path, path)).get())
  }

  export function remove(path: string) {
    return Database.use((db) => db.delete(KnowledgeDocumentTable).where(eq(KnowledgeDocumentTable.path, path)).run())
  }

  export function upsert(input: {
    kind: Kind
    path: string
    source: string
    raw: string
    raw_hash: string
    metadata?: string | null
    expected?: number
    time_source_updated?: number
  }) {
    const cur = get(input.path)
    const time = now()
    if (!cur) {
      const id = ulid()
      Database.use((db) =>
        db
          .insert(KnowledgeDocumentTable)
          .values({
            id,
            kind: input.kind,
            path: input.path,
            source: input.source,
            version: 1,
            raw: input.raw,
            raw_hash: input.raw_hash,
            metadata: input.metadata,
            sync_state: "synced",
            conflict_state: "none",
            sync_error: null,
            sync_cursor: null,
            conflict_raw: null,
            conflict_hash: null,
            time_source_updated: input.time_source_updated ?? time,
            time_synced: time,
            time_created: time,
            time_updated: time,
          })
          .run(),
      )
      return get(input.path)
    }

    if (typeof input.expected === "number" && cur.version !== input.expected) {
      return {
        ...cur,
        conflict_state: "version_mismatch",
        conflict_raw: input.raw,
        conflict_hash: input.raw_hash,
      } satisfies Document
    }

    const next = cur.version + 1
    const where = and(eq(KnowledgeDocumentTable.id, cur.id), eq(KnowledgeDocumentTable.version, cur.version))
    const res = Database.use((db) =>
      db
        .update(KnowledgeDocumentTable)
        .set({
          kind: input.kind,
          source: input.source,
          version: next,
          raw: input.raw,
          raw_hash: input.raw_hash,
          metadata: input.metadata,
          sync_state: "synced",
          sync_error: null,
          sync_cursor: null,
          conflict_state: "none",
          conflict_raw: null,
          conflict_hash: null,
          time_source_updated: input.time_source_updated ?? time,
          time_synced: time,
          time_updated: time,
        })
        .where(where)
        .run(),
    ) as any

    if ((res?.changes ?? 0) > 0) {
      return get(input.path)
    }

    const stale = get(input.path)
    if (!stale) return undefined
    return {
      ...stale,
      conflict_state: "write_race",
      conflict_raw: input.raw,
      conflict_hash: input.raw_hash,
    } satisfies Document
  }

  export function markConflict(input: { id: string; state: string; raw: string; hash: string }) {
    const time = now()
    Database.use((db) =>
      db
        .update(KnowledgeDocumentTable)
        .set({
          conflict_state: input.state,
          conflict_raw: input.raw,
          conflict_hash: input.hash,
          sync_state: "conflict",
          time_updated: time,
        })
        .where(eq(KnowledgeDocumentTable.id, input.id))
        .run(),
    )
  }

  export function replaceChunks(document_id: string, kind: Kind, path: string, version: number, list: Chunk[]) {
    const time = now()
    Database.transaction((db) => {
      db.delete(KnowledgeChunkTable).where(eq(KnowledgeChunkTable.document_id, document_id)).run()
      if (!list.length) return
      db.insert(KnowledgeChunkTable)
        .values(
          list.map((item) => ({
            id: ulid(),
            document_id,
            kind,
            path,
            version,
            ordinal: item.ordinal,
            heading: item.heading,
            raw: item.raw,
            raw_hash: item.raw_hash,
            tokens: item.tokens,
            start_line: item.start_line,
            end_line: item.end_line,
            time_created: time,
            time_updated: time,
          })),
        )
        .run()
    })
  }

  export function document(path: string) {
    return get(path)
  }

  export function documents(input?: { kind?: Kind | Kind[] }) {
    return Database.use((db) => {
      if (!input?.kind) return db.select().from(KnowledgeDocumentTable).all()
      if (Array.isArray(input.kind)) {
        if (!input.kind.length) return []
        return db
          .select()
          .from(KnowledgeDocumentTable)
          .where(sql`${KnowledgeDocumentTable.kind} in (${sql.join(
            input.kind.map((item) => sql`${item}`),
            sql`, `,
          )})`)
          .all()
      }
      return db.select().from(KnowledgeDocumentTable).where(eq(KnowledgeDocumentTable.kind, input.kind)).all()
    })
  }

  export function search(input: { query: string; kind?: Kind | Kind[]; limit?: number }) {
    const limit = input.limit ?? 10
    const kinds = Array.isArray(input.kind) ? input.kind : input.kind ? [input.kind] : []
    const kindSql = !kinds.length
      ? sql``
      : sql`AND c.kind in (${sql.join(
          kinds.map((item) => sql`${item}`),
          sql`, `,
        )})`
    const kindWhere = !kinds.length
      ? undefined
      : kinds.length === 1
        ? eq(KnowledgeChunkTable.kind, kinds[0])
        : sql`${KnowledgeChunkTable.kind} in (${sql.join(
            kinds.map((item) => sql`${item}`),
            sql`, `,
          )})`
    try {
      return Database.use((db) =>
        db.all<SearchRow>(sql`
          SELECT c.id, c.document_id, c.path, c.kind, c.ordinal, c.heading, c.raw, c.version, c.start_line, c.end_line, bm25(knowledge_chunk_fts) AS score
          FROM knowledge_chunk_fts
          JOIN knowledge_chunk c ON c.rowid = knowledge_chunk_fts.rowid
          WHERE knowledge_chunk_fts MATCH ${input.query}
          ${kindSql}
          ORDER BY score ASC, c.path ASC, c.ordinal ASC
          LIMIT ${limit}
        `),
      )
    } catch {
      return Database.use((db) =>
        db
          .select()
          .from(KnowledgeChunkTable)
          .where(
            and(
              kindWhere,
              like(KnowledgeChunkTable.raw, `%${input.query}%`),
            ),
          )
          .orderBy(asc(KnowledgeChunkTable.path), asc(KnowledgeChunkTable.ordinal))
          .limit(limit)
          .all()
          .map((item) => ({ ...item, score: 0 })),
      )
    }
  }
}
