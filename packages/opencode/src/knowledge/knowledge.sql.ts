import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { Timestamps } from "../storage/schema.sql"

export const KnowledgeDocumentTable = sqliteTable(
  "knowledge_document",
  {
    id: text().primaryKey(),
    kind: text().notNull(),
    path: text().notNull(),
    title: text(),
    source: text().notNull(),
    version: integer().notNull().$default(() => 1),
    raw: text().notNull(),
    raw_hash: text().notNull(),
    metadata: text({ mode: "json" }),
    sync_state: text().notNull().$default(() => "dirty"),
    sync_error: text(),
    sync_cursor: text(),
    conflict_state: text().notNull().$default(() => "none"),
    conflict_raw: text(),
    conflict_hash: text(),
    time_source_updated: integer(),
    time_synced: integer(),
    ...Timestamps,
  },
  (table) => [
    index("knowledge_document_path_idx").on(table.path),
    index("knowledge_document_kind_idx").on(table.kind),
    index("knowledge_document_kind_path_idx").on(table.kind, table.path),
    index("knowledge_document_hash_idx").on(table.raw_hash),
    index("knowledge_document_version_idx").on(table.version),
    index("knowledge_document_updated_idx").on(table.time_updated),
  ],
)

export const KnowledgeChunkTable = sqliteTable(
  "knowledge_chunk",
  {
    id: text().primaryKey(),
    document_id: text()
      .notNull()
      .references(() => KnowledgeDocumentTable.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    path: text().notNull(),
    version: integer().notNull().$default(() => 1),
    ordinal: integer().notNull(),
    heading: text(),
    raw: text().notNull(),
    raw_hash: text().notNull(),
    tokens: integer(),
    start_line: integer(),
    end_line: integer(),
    ...Timestamps,
  },
  (table) => [
    index("knowledge_chunk_document_idx").on(table.document_id),
    index("knowledge_chunk_kind_idx").on(table.kind),
    index("knowledge_chunk_path_idx").on(table.path),
    index("knowledge_chunk_hash_idx").on(table.raw_hash),
    index("knowledge_chunk_version_idx").on(table.version),
    index("knowledge_chunk_updated_idx").on(table.time_updated),
    index("knowledge_chunk_document_order_idx").on(table.document_id, table.ordinal),
  ],
)
