import z from "zod"
import * as path from "path"
import * as fs from "fs/promises"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Global } from "../global"

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

async function collectMemoryFiles(): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = []
  const seen = new Set<string>()

  async function tryRead(filePath: string) {
    const resolved = path.resolve(filePath)
    if (seen.has(resolved)) return
    seen.add(resolved)
    try {
      const content = await fs.readFile(filePath, "utf-8")
      if (content.trim()) {
        files.push({ path: filePath, content })
      }
    } catch {
      // doesn't exist
    }
  }

  // MEMORY.md locations
  const memoryLocations = [
    path.join(Instance.directory, ".opencode", "MEMORY.md"),
    path.join(Instance.directory, "MEMORY.md"),
    path.join(Global.Path.config, "MEMORY.md"),
  ]
  for (const loc of memoryLocations) {
    await tryRead(loc)
  }

  // Daily memory files
  const memoryDirs = [
    path.join(Instance.directory, ".opencode", "memory"),
    path.join(Instance.directory, "memory"),
    path.join(Global.Path.config, "memory"),
  ]

  for (const dir of memoryDirs) {
    try {
      const entries = await fs.readdir(dir)
      for (const entry of entries) {
        if (entry.endsWith(".md")) {
          await tryRead(path.join(dir, entry))
        }
      }
    } catch {
      // dir doesn't exist
    }
  }

  return files
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

    const files = await collectMemoryFiles()

    if (files.length === 0) {
      return {
        title: "Memory Search",
        output: "No memory files found. Use the memory tool to create MEMORY.md or daily files.",
        metadata: {} as any,
      }
    }

    // Split all files into chunks and score them
    const allResults: SearchResult[] = []

    for (const file of files) {
      const chunks = splitIntoChunks(file.content, file.path)
      for (const chunk of chunks) {
        const score = scoreChunk(chunk, params.query, queryWords)
        if (score > 0) {
          allResults.push({
            file: chunk.file,
            lineNumber: chunk.lineStart,
            snippet: extractSnippet(chunk.text, params.query),
            score,
            heading: chunk.heading,
          })
        }
      }
    }

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
