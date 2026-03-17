import z from "zod"
import { Tool } from "./tool"
import path from "path"
import { realpath } from "node:fs/promises"
import DESCRIPTION from "./repomap.txt"
import { Instance } from "../project/instance"
import { Ripgrep } from "../file/ripgrep"

// Per-file symbol extraction via regex — fast, zero deps, good enough for top-level symbols
const PATTERNS: Record<string, RegExp> = {
  ts: /^(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum|abstract\s+class)\s+(\w+)|(?:async\s+)?function\s+(\w+)|class\s+(\w+))/gm,
  tsx: /^(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum|abstract\s+class)\s+(\w+)|(?:async\s+)?function\s+(\w+)|class\s+(\w+))/gm,
  js: /^(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)|(?:async\s+)?function\s+(\w+)|class\s+(\w+))/gm,
  jsx: /^(?:export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)|(?:async\s+)?function\s+(\w+)|class\s+(\w+))/gm,
  py: /^(?:async\s+)?(?:def|class)\s+(\w+)/gm,
  go: /^(?:func|type|var|const)\s+([A-Z]\w*)/gm,
  rs: /^pub\s+(?:fn|struct|enum|trait|type|impl(?:\s+\w+\s+for)?)\s+(\w+)/gm,
}

// Simple in-memory cache: file path → { mtime, symbols }
const cache = new Map<string, { mtime: number; symbols: string[] }>()

async function extract(file: string): Promise<string[]> {
  const stat = await Bun.file(file)
    .stat()
    .catch(() => null)
  if (!stat) return []
  const mtime = stat.mtime instanceof Date ? stat.mtime.getTime() : Number(stat.mtime)
  const hit = cache.get(file)
  if (hit && hit.mtime === mtime) return hit.symbols

  const ext = path.extname(file).slice(1)
  const pat = PATTERNS[ext]
  if (!pat) {
    cache.set(file, { mtime, symbols: [] })
    return []
  }

  const content = await Bun.file(file)
    .text()
    .catch(() => "")
  const rx = new RegExp(pat.source, pat.flags)
  const syms: string[] = []
  let m: RegExpExecArray | null
  while ((m = rx.exec(content)) !== null) {
    const name = m[1] ?? m[2] ?? m[3]
    if (name && !syms.includes(name)) syms.push(name)
  }
  cache.set(file, { mtime, symbols: syms })
  return syms
}

const EXTS = ["*.ts", "*.tsx", "*.js", "*.jsx", "*.py", "*.go", "*.rs"]

function norm(v: string) {
  return v
    .replaceAll("\\", "/")
    .replace(/^\.?\/+/, "")
    .replace(/\/+$/, "")
}

function match(rel: string, filter: string) {
  const file = norm(rel)
  const pre = norm(filter)
  if (!pre) return true
  return file === pre || file.startsWith(`${pre}/`)
}

function inside(root: string, file: string) {
  const rel = path.relative(root, file)
  if (!rel) return true
  if (path.isAbsolute(rel)) return false
  return !rel.startsWith("..")
}

export async function buildRepomap(opts?: { filter?: string; max_files?: number }): Promise<string> {
  const root = Instance.worktree
  const base = await realpath(root).catch(() => root)
  const limit = opts?.max_files ?? 150
  const lines: string[] = []
  let count = 0

  for await (const rel of Ripgrep.files({ cwd: root, glob: EXTS, hidden: false })) {
    if (opts?.filter && !match(rel, opts.filter)) continue
    if (count >= limit) break
    const abs = path.join(root, rel)
    const real = await realpath(abs).catch(() => null)
    if (!real) continue
    if (!inside(base, real)) continue
    const syms = await extract(real)
    if (syms.length === 0) continue
    lines.push(`${rel}:`)
    for (const s of syms) lines.push(`  ${s}`)
    count++
  }

  if (lines.length === 0) return ""
  return lines.join("\n")
}

export const RepomapTool = Tool.define("repomap", {
  description: DESCRIPTION,
  parameters: z.object({
    filter: z.string().optional().describe("Optional path prefix to filter files (e.g. \'src/session/\')"),
    max_files: z.number().int().positive().optional().describe("Max files to include (default 200)"),
  }),
  async execute(args, ctx) {
    await ctx.ask({ permission: "read", patterns: ["**"], always: ["**"], metadata: {} })
    const output = await buildRepomap({ filter: args.filter, max_files: args.max_files ?? 200 })
    if (!output) return { title: "Repo map", output: "(no source files found)", metadata: { fileCount: 0 } }
    const count = output.split("\n").filter((l) => !l.startsWith(" ")).length
    return {
      title: `Repo map (${count} files)`,
      output,
      metadata: { fileCount: count },
    }
  },
})
