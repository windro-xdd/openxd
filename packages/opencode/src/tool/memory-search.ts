import z from "zod"
import { Tool } from "./tool"
import { KnowledgeSync } from "../knowledge/service"

interface SearchResult {
  file: string
  lineNumber: number
  snippet: string
  score: number
  heading: string
}

interface Chunk {
  file: string
  heading: string
  text: string
  lineStart: number
}

interface Row {
  path: string
  heading: string | null
  raw: string
  start_line: number | null
  score: number
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
}

function scoreChunk(chunk: Chunk, query: string, queryWords: string[]): number {
  const text = chunk.text.toLowerCase()
  const heading = chunk.heading.toLowerCase()
  let score = 0

  // Exact phrase match — highest score
  if (text.includes(query.toLowerCase())) {
    score += 10
  }

  // All query words present
  const chunkWords = new Set(tokenize(chunk.text))
  const matchedWords = queryWords.filter((w) => chunkWords.has(w))
  if (matchedWords.length === queryWords.length && queryWords.length > 0) {
    score += 5
  }

  // Partial word matches
  score += matchedWords.length

  // Heading match bonus (2x)
  const headingWords = new Set(tokenize(heading))
  const headingMatches = queryWords.filter((w) => headingWords.has(w))
  score += headingMatches.length * 2

  // Exact phrase in heading — big bonus
  if (heading.includes(query.toLowerCase())) {
    score += 8
  }

  return score
}

function extractSnippet(text: string, query: string, maxLines = 5): string {
  const lines = text.split("\n")
  const queryLower = query.toLowerCase()

  // Find the line with the best match
  let bestLine = 0
  let bestScore = -1
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase()
    if (lower.includes(queryLower)) {
      bestLine = i
      bestScore = 2
      break
    }
    const words = tokenize(query)
    const lineWords = new Set(tokenize(lines[i]))
    const overlap = words.filter((w) => lineWords.has(w)).length
    if (overlap > bestScore) {
      bestScore = overlap
      bestLine = i
    }
  }

  // Extract surrounding lines
  const start = Math.max(0, bestLine - Math.floor(maxLines / 2))
  const end = Math.min(lines.length, start + maxLines)
  return lines.slice(start, end).join("\n")
}

function splitIntoChunks(content: string, filePath: string): Chunk[] {
  const lines = content.split("\n")
  const chunks: Chunk[] = []
  let currentHeading = "(top)"
  let currentText: string[] = []
  let currentLineStart = 1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.match(/^#{1,3}\s+/)) {
      // Save previous chunk
      if (currentText.length > 0) {
        const text = currentText.join("\n").trim()
        if (text) {
          chunks.push({
            file: filePath,
            heading: currentHeading,
            text,
            lineStart: currentLineStart,
          })
        }
      }
      currentHeading = line.replace(/^#+\s*/, "")
      currentText = [line]
      currentLineStart = i + 1
    } else {
      currentText.push(line)
    }
  }

  // Last chunk
  if (currentText.length > 0) {
    const text = currentText.join("\n").trim()
    if (text) {
      chunks.push({
        file: filePath,
        heading: currentHeading,
        text,
        lineStart: currentLineStart,
      })
    }
  }

  return chunks
}

function resolve(row: Row, query: string, words: string[]): SearchResult {
  const text = row.raw || ""
  const chunk: Chunk = {
    file: row.path,
    heading: row.heading || "(top)",
    text,
    lineStart: row.start_line ?? 1,
  }
  const score = scoreChunk(chunk, query, words)
  const fts = Number.isFinite(row.score) ? Math.max(0, Math.round(Math.abs(row.score) * 100)) : 0
  return {
    file: row.path,
    lineNumber: row.start_line ?? 1,
    snippet: extractSnippet(text, query),
    heading: chunk.heading,
    score: score + fts,
  }
}

function compact(input: SearchResult[]) {
  const map = new Map<string, SearchResult>()
  for (const row of input) {
    const key = `${row.file}:${row.lineNumber}:${row.heading}`
    const cur = map.get(key)
    if (!cur || row.score > cur.score) map.set(key, row)
  }
  return Array.from(map.values())
}

export const MemorySearchTool = Tool.define("memory_search", {
  description: `Search across all memory files (MEMORY.md and daily memory files memory/*.md).

Use this before answering questions about prior work, decisions, preferences, or context from past sessions.
Returns matching snippets with file path, line number, and relevance score.`,
  parameters: z.object({
    query: z.string().describe("What to search for"),
    maxResults: z.number().int().positive().optional().describe("Maximum results to return (default: 5)"),
  }),
  async execute(params, ctx) {
    const maxResults = params.maxResults ?? 5
    const queryWords = tokenize(params.query)

    if (queryWords.length === 0) {
      return {
        title: "Memory Search",
        output: "Query is empty or has no searchable words.",
        metadata: {} as any,
      }
    }

    const docs = KnowledgeSync.list_documents({ kind: ["memory", "daily"] })
    const files = docs.filter((item) => item.raw.trim()).map((item) => ({ path: item.path, content: item.raw }))

    if (files.length === 0) {
      return {
        title: "Memory Search",
        output: "No memory files found. Use the memory tool to create MEMORY.md or daily files.",
        metadata: {} as any,
      }
    }

    const query = queryWords.join(" ")
    const rows = KnowledgeSync.search_chunks({ query: query || params.query, kind: ["memory", "daily"], limit: maxResults * 8 }) as Row[]

    const allResults = rows.length
      ? compact(rows.map((row) => resolve(row, params.query, queryWords)).filter((row) => row.score > 0))
      : compact(
          files
            .flatMap((file) => splitIntoChunks(file.content, file.path))
            .map((chunk) => ({
              file: chunk.file,
              lineNumber: chunk.lineStart,
              snippet: extractSnippet(chunk.text, params.query),
              score: scoreChunk(chunk, params.query, queryWords),
              heading: chunk.heading,
            }))
            .filter((row) => row.score > 0),
        )

    // Sort by score descending
    allResults.sort((a, b) => b.score - a.score)
    const results = allResults.slice(0, maxResults)

    if (results.length === 0) {
      return {
        title: "Memory Search",
        output: `No results found for "${params.query}" across ${files.length} memory file(s).`,
        metadata: { filesSearched: files.length },
      }
    }

    const output = results
      .map(
        (r, i) =>
          `### Result ${i + 1} (score: ${r.score})\n**File:** ${r.file}#${r.lineNumber}\n**Section:** ${r.heading}\n\`\`\`\n${r.snippet}\n\`\`\``,
      )
      .join("\n\n")

    return {
      title: "Memory Search",
      output: `Found ${results.length} result(s) for "${params.query}":\n\n${output}`,
      metadata: { filesSearched: files.length, totalResults: allResults.length, returned: results.length },
    }
  },
})
