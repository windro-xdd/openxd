import path from "path"
import os from "os"
import type { Tool } from "./tool"
import { Instance } from "../project/instance"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

// Track directories created by the agent during this process lifetime.
// Writes to these directories are auto-allowed without permission prompts.
const agentCreatedDirs = new Set<string>()

/** Mark a directory as created by the agent (called from bash tool on mkdir detection). */
export function markAgentCreatedDir(dir: string) {
  const resolved = path.resolve(dir)
  agentCreatedDirs.add(resolved)
}

/** Check if a path is inside a directory the agent created. */
function isInAgentCreatedDir(target: string): boolean {
  const resolved = path.resolve(target)
  for (const dir of agentCreatedDirs) {
    if (resolved === dir || resolved.startsWith(dir + "/") || resolved.startsWith(dir + path.sep)) {
      return true
    }
  }
  return false
}

// Directories that are always allowed without permission prompts
const ALWAYS_ALLOWED_PREFIXES = [
  path.join(os.homedir(), "bbh"),
]

/** Check if a path is in an always-allowed directory. */
function isAlwaysAllowed(target: string): boolean {
  const resolved = path.resolve(target)
  return ALWAYS_ALLOWED_PREFIXES.some(
    (prefix) => resolved === prefix || resolved.startsWith(prefix + "/") || resolved.startsWith(prefix + path.sep),
  )
}

export async function assertExternalDirectory(ctx: Tool.Context, target?: string, options?: Options) {
  if (!target) return

  if (options?.bypass) return

  if (Instance.containsPath(target)) return

  // Auto-allow always-allowed directories (e.g. ~/bbh/)
  if (isAlwaysAllowed(target)) return

  // Auto-allow if the agent created this directory earlier in the session
  if (isInAgentCreatedDir(target)) return

  const kind = options?.kind ?? "file"
  const parentDir = kind === "directory" ? target : path.dirname(target)
  const glob = path.join(parentDir, "*").replaceAll("\\", "/")

  await ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: {
      filepath: target,
      parentDir,
    },
  })
}
