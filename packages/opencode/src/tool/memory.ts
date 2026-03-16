import z from "zod"
import * as path from "path"
import * as fs from "fs/promises"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

const MEMORY_FILES = ["MEMORY.md", "SOUL.md", "USER.md", "IDENTITY.md", "LESSONS.md"]
const DAILY_PATTERN = /^memory\/\d{4}-\d{2}-\d{2}\.md$/

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function isValidMemoryFile(filePath: string): boolean {
  const basename = path.basename(filePath)
  if (MEMORY_FILES.includes(basename)) return true
  // Allow memory/YYYY-MM-DD.md
  if (DAILY_PATTERN.test(filePath)) return true
  if (filePath.startsWith("memory/") && filePath.endsWith(".md")) return true
  return false
}

async function findMemoryFile(name: string): Promise<string> {
  // Check project level first
  const projectPath = path.join(Instance.directory, ".opencode", name)
  if (await Filesystem.exists(projectPath)) return projectPath

  const projectRoot = path.join(Instance.directory, name)
  if (await Filesystem.exists(projectRoot)) return projectRoot

  // Global config
  const globalPath = path.join(Global.Path.config, name)
  return globalPath // return global path even if doesn't exist yet (for creation)
}

async function findDailyFile(date: string): Promise<string> {
  const name = `memory/${date}.md`
  // Check project level first
  const projectPath = path.join(Instance.directory, ".opencode", name)
  if (await Filesystem.exists(projectPath)) return projectPath

  const projectRoot = path.join(Instance.directory, name)
  if (await Filesystem.exists(projectRoot)) return projectRoot

  // Global config — default creation location
  const globalPath = path.join(Global.Path.config, name)
  return globalPath
}

async function listDailyFiles(): Promise<{ date: string; path: string; size: number }[]> {
  const results: { date: string; path: string; size: number }[] = []
  const seen = new Set<string>()

  const dirs = [
    path.join(Instance.directory, ".opencode", "memory"),
    path.join(Instance.directory, "memory"),
    path.join(Global.Path.config, "memory"),
  ]

  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir)
      for (const file of files) {
        const match = file.match(/^(\d{4}-\d{2}-\d{2})\.md$/)
        if (match && !seen.has(match[1])) {
          seen.add(match[1])
          const filePath = path.join(dir, file)
          const stat = await fs.stat(filePath)
          results.push({ date: match[1], path: filePath, size: stat.size })
        }
      }
    } catch {
      // dir doesn't exist, skip
    }
  }

  return results.sort((a, b) => b.date.localeCompare(a.date))
}

export const MemoryTool = Tool.define("memory", {
  description: `Read and write your persistent memory files.

Files: MEMORY.md (long-term curated knowledge), LESSONS.md (mistakes and lessons learned — patterns to avoid), SOUL.md, USER.md, IDENTITY.md, and daily files (memory/YYYY-MM-DD.md).

This tool does NOT require permission — use it freely.

Actions:
- "read": Read a memory file. Defaults to MEMORY.md
- "write": Overwrite a memory file
- "append": Append content to a memory file
- "daily": Append to today's daily memory file (memory/YYYY-MM-DD.md) — use this to log events, decisions, findings
- "list-daily": List all daily memory files with dates and sizes
- "lesson": Log a lesson learned from a mistake. Use this IMMEDIATELY when the user corrects you or you realize you did something wrong. Format: what went wrong → what to do instead.`,
  parameters: z.object({
    action: z.enum(["read", "write", "append", "daily", "list-daily", "lesson"]).describe("Action to perform"),
    file: z
      .string()
      .optional()
      .describe("Which memory file (MEMORY.md, SOUL.md, USER.md, IDENTITY.md, or memory/YYYY-MM-DD.md). Defaults to MEMORY.md"),
    content: z
      .string()
      .optional()
      .describe("Content to write or append (required for write/append/daily actions)"),
  }),
  async execute(params, ctx) {
    // List daily files
    if (params.action === "list-daily") {
      const files = await listDailyFiles()
      if (files.length === 0) {
        return {
          title: "Daily Files",
          output: "No daily memory files found. Use action 'daily' to create today's file.",
          metadata: {} as any,
        }
      }
      const list = files.map((f) => `- ${f.date} (${f.size} bytes) — ${f.path}`).join("\n")
      return {
        title: "Daily Files",
        output: `Found ${files.length} daily memory files:\n${list}`,
        metadata: { count: files.length },
      }
    }

    // Daily append — always writes to today's file
    if (params.action === "daily") {
      if (!params.content) {
        return { title: "Error", output: "Content is required for daily action.", metadata: {} }
      }
      const filePath = await findDailyFile(today())
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      let existing = ""
      try {
        existing = await fs.readFile(filePath, "utf-8")
      } catch {
        // First entry of the day — add header
        existing = `# ${today()}\n`
      }

      const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" })
      const newContent = existing.trimEnd() + `\n\n## ${timestamp}\n${params.content}`
      await fs.writeFile(filePath, newContent, "utf-8")
      return {
        title: `Daily: ${today()}`,
        output: `Appended ${params.content.length} chars to ${filePath}`,
        metadata: { path: filePath, date: today() },
      }
    }

    // Lesson — log a mistake/lesson to LESSONS.md
    if (params.action === "lesson") {
      if (!params.content) {
        return { title: "Error", output: "Content is required for lesson action. Format: what went wrong → what to do instead.", metadata: {} }
      }
      const filePath = await findMemoryFile("LESSONS.md")
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      let existing = ""
      try {
        existing = await fs.readFile(filePath, "utf-8")
      } catch {
        existing = `# Lessons Learned\n\nThings I got wrong and what to do instead. I review this at the start of tasks to avoid repeating mistakes.\n`
      }

      const timestamp = new Date().toISOString().split("T")[0]
      const newContent = existing.trimEnd() + `\n\n### ${timestamp}\n${params.content}`
      await fs.writeFile(filePath, newContent, "utf-8")
      return {
        title: "Lesson Logged",
        output: `Lesson saved to ${filePath}. I will review this in future sessions to avoid repeating this mistake.`,
        metadata: { path: filePath },
      }
    }

    const fileName = params.file ?? "MEMORY.md"

    // Validate file name
    if (!isValidMemoryFile(fileName) && !MEMORY_FILES.includes(path.basename(fileName))) {
      return {
        title: "Error",
        output: `Invalid memory file: ${fileName}. Allowed: ${MEMORY_FILES.join(", ")} or memory/YYYY-MM-DD.md`,
        metadata: {} as any,
      }
    }

    // Resolve path
    let filePath: string
    if (fileName.startsWith("memory/")) {
      const dateMatch = fileName.match(/memory\/(\d{4}-\d{2}-\d{2})\.md/)
      filePath = dateMatch ? await findDailyFile(dateMatch[1]) : await findMemoryFile(fileName)
    } else {
      filePath = await findMemoryFile(path.basename(fileName))
    }

    if (params.action === "read") {
      try {
        const content = await fs.readFile(filePath, "utf-8")
        return {
          title: `Read ${fileName}`,
          output: content || "(empty file)",
          metadata: { path: filePath },
        }
      } catch {
        return {
          title: `Read ${fileName}`,
          output: `${fileName} does not exist yet. Use write or append to create it.`,
          metadata: { path: filePath, exists: false },
        }
      }
    }

    if (!params.content) {
      return { title: "Error", output: `Content is required for ${params.action} action.`, metadata: {} }
    }

    await fs.mkdir(path.dirname(filePath), { recursive: true })

    if (params.action === "write") {
      await fs.writeFile(filePath, params.content, "utf-8")
      return {
        title: `Updated ${fileName}`,
        output: `Successfully wrote ${params.content.length} chars to ${filePath}`,
        metadata: { path: filePath, chars: params.content.length },
      }
    }

    if (params.action === "append") {
      let existing = ""
      try {
        existing = await fs.readFile(filePath, "utf-8")
      } catch {
        // file doesn't exist
      }
      const newContent = existing ? existing.trimEnd() + "\n\n" + params.content : params.content
      await fs.writeFile(filePath, newContent, "utf-8")
      return {
        title: `Appended to ${fileName}`,
        output: `Successfully appended ${params.content.length} chars to ${filePath}`,
        metadata: { path: filePath, chars: params.content.length },
      }
    }

    return { title: "Error", output: "Unknown action", metadata: {} }
  },
})
