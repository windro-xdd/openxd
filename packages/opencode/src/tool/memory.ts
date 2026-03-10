import z from "zod"
import * as path from "path"
import * as fs from "fs/promises"
import { Tool } from "./tool"
import { Instance } from "../project/instance"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"

const MEMORY_FILES = ["MEMORY.md", "SOUL.md", "USER.md", "IDENTITY.md"]

function resolveMemoryPath(filePath: string): string | null {
  const basename = path.basename(filePath)
  if (!MEMORY_FILES.includes(basename)) return null

  // If absolute, validate it ends with a memory file
  if (path.isAbsolute(filePath)) return filePath

  // Resolve relative to project or global config
  return filePath
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

export const MemoryTool = Tool.define("memory", {
  description: `Read and write your persistent memory files (MEMORY.md, SOUL.md, USER.md, IDENTITY.md).

These files persist across sessions. Use this tool to:
- READ your memory to recall past context
- WRITE/UPDATE your memory when you learn something worth remembering

This tool does NOT require permission — use it freely.

Actions:
- "read": Read a memory file. If no file specified, reads MEMORY.md
- "write": Write content to a memory file. If no file specified, writes MEMORY.md
- "append": Append content to a memory file (adds to the end)`,
  parameters: z.object({
    action: z.enum(["read", "write", "append"]).describe("Whether to read, write, or append to the memory file"),
    file: z
      .string()
      .optional()
      .describe("Which memory file (MEMORY.md, SOUL.md, USER.md, IDENTITY.md). Defaults to MEMORY.md"),
    content: z
      .string()
      .optional()
      .describe("Content to write or append (required for write/append actions)"),
  }),
  async execute(params) {
    const fileName = params.file ?? "MEMORY.md"
    const basename = path.basename(fileName)

    if (!MEMORY_FILES.includes(basename)) {
      return {
        title: "Error",
        output: `Invalid memory file: ${fileName}. Allowed files: ${MEMORY_FILES.join(", ")}`,
        metadata: {},
      }
    }

    const filePath = await findMemoryFile(basename)

    if (params.action === "read") {
      try {
        const content = await fs.readFile(filePath, "utf-8")
        return {
          title: `Read ${basename}`,
          output: content || "(empty file)",
          metadata: { path: filePath },
        }
      } catch {
        return {
          title: `Read ${basename}`,
          output: `${basename} does not exist yet. Use write or append to create it.`,
          metadata: { path: filePath, exists: false },
        }
      }
    }

    if (!params.content) {
      return {
        title: "Error",
        output: `Content is required for ${params.action} action.`,
        metadata: {},
      }
    }

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })

    if (params.action === "write") {
      await fs.writeFile(filePath, params.content, "utf-8")
      return {
        title: `Updated ${basename}`,
        output: `Successfully wrote ${params.content.length} chars to ${filePath}`,
        metadata: { path: filePath, chars: params.content.length },
      }
    }

    if (params.action === "append") {
      let existing = ""
      try {
        existing = await fs.readFile(filePath, "utf-8")
      } catch {
        // file doesn't exist yet, that's fine
      }
      const newContent = existing ? existing.trimEnd() + "\n\n" + params.content : params.content
      await fs.writeFile(filePath, newContent, "utf-8")
      return {
        title: `Appended to ${basename}`,
        output: `Successfully appended ${params.content.length} chars to ${filePath}`,
        metadata: { path: filePath, chars: params.content.length },
      }
    }

    return {
      title: "Error",
      output: "Unknown action",
      metadata: {},
    }
  },
})
