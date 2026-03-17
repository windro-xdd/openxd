import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"
import { SessionTable } from "../session/session.sql"
import { ProjectTable } from "../project/project.sql"
import { Timestamps } from "../storage/schema.sql"

// Observations table — stores compressed summaries of tool executions
// Used for cross-session memory search and context injection
export const ObservationTable = sqliteTable(
  "observation",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    // Tool that generated this observation
    tool: text().notNull(),
    // Type classification for filtering: file_edit, file_read, bash, search, browser, memory, error, other
    type: text().notNull(),
    // Compressed summary of what happened (~50-100 tokens)
    summary: text().notNull(),
    // Full content (stored separately for lazy loading)
    content: text(),
    // Relevance tags for search (space-separated)
    tags: text(),
    ...Timestamps,
  },
  (table) => [
    index("observation_project_idx").on(table.project_id),
    index("observation_session_idx").on(table.session_id),
    index("observation_type_idx").on(table.type),
    index("observation_created_idx").on(table.time_created),
  ],
)

// FTS5 virtual table for full-text search on observations
// Created via raw SQL migration since Drizzle doesn't support virtual tables
