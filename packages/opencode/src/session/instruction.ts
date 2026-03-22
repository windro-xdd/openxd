import path from "path"
import os from "os"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { Flag } from "@/flag/flag"
import { Log } from "../util/log"
import { Glob } from "../util/glob"
import { KnowledgeSync } from "@/knowledge/service"
import type { MessageV2 } from "./message-v2"

const log = Log.create({ service: "instruction" })

const FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "CONTEXT.md", // deprecated
]

// Always loaded independently (not fallbacks like FILES)
const ALWAYS_LOAD_FILES = ["MEMORY.md", "SOUL.md", "USER.md", "IDENTITY.md", "LESSONS.md"]

const FILE_CAP = 40_000
const SECTION_CAP = {
  identity: 40_000,
  memory: 50_000,
  skills: 30_000,
  other: 50_000,
}
const TOTAL_CAP = 120_000

type Section = keyof typeof SECTION_CAP

function section(file: string, kind?: string): Section {
  const base = path.basename(file)
  if (kind === "skill" || base === "SKILL.md") return "skills"
  if (base === "SOUL.md" || base === "USER.md" || base === "IDENTITY.md") return "identity"
  if (kind === "memory" || kind === "daily") return "memory"
  if (base === "MEMORY.md" || base === "LESSONS.md") return "memory"
  if (/^\d{4}-\d{2}-\d{2}\.md$/.test(base) && path.basename(path.dirname(file)) === "memory") return "memory"
  return "other"
}

function clip(raw: string, max: number, reason: string) {
  if (max <= 0) return ""
  if (raw.length <= max) return raw
  const suffix = `\n\n... (truncated — ${reason})`
  if (max <= suffix.length) return raw.slice(0, max)
  return raw.slice(0, max - suffix.length) + suffix
}

function fromdb(file: string) {
  try {
    const doc = KnowledgeSync.get_document(file)
    if (!doc?.raw) return
    return {
      raw: doc.raw,
      kind: doc.kind,
      source: "db" as const,
    }
  } catch {
    return
  }
}

function todayDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function yesterdayDate(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function globalFiles() {
  const files = []
  if (Flag.OPENCODE_CONFIG_DIR) {
    files.push(path.join(Flag.OPENCODE_CONFIG_DIR, "AGENTS.md"))
  }
  files.push(path.join(Global.Path.config, "AGENTS.md"))
  if (!Flag.OPENCODE_DISABLE_CLAUDE_CODE_PROMPT) {
    files.push(path.join(os.homedir(), ".claude", "CLAUDE.md"))
  }
  return files
}

function globalAlwaysLoadFiles() {
  const files = []
  for (const name of ALWAYS_LOAD_FILES) {
    if (Flag.OPENCODE_CONFIG_DIR) {
      files.push(path.join(Flag.OPENCODE_CONFIG_DIR, name))
    }
    files.push(path.join(Global.Path.config, name))
  }
  return files
}

async function resolveRelative(instruction: string): Promise<string[]> {
  if (!Flag.OPENCODE_DISABLE_PROJECT_CONFIG) {
    return Filesystem.globUp(instruction, Instance.directory, Instance.worktree).catch(() => [])
  }
  if (!Flag.OPENCODE_CONFIG_DIR) {
    log.warn(
      `Skipping relative instruction "${instruction}" - no OPENCODE_CONFIG_DIR set while project config is disabled`,
    )
    return []
  }
  return Filesystem.globUp(instruction, Flag.OPENCODE_CONFIG_DIR, Flag.OPENCODE_CONFIG_DIR).catch(() => [])
}

export namespace InstructionPrompt {
  const state = Instance.state(() => {
    return {
      claims: new Map<string, Set<string>>(),
    }
  })

  function isClaimed(messageID: string, filepath: string) {
    const claimed = state().claims.get(messageID)
    if (!claimed) return false
    return claimed.has(filepath)
  }

  function claim(messageID: string, filepath: string) {
    const current = state()
    let claimed = current.claims.get(messageID)
    if (!claimed) {
      claimed = new Set()
      current.claims.set(messageID, claimed)
    }
    claimed.add(filepath)
  }

  export function clear(messageID: string) {
    state().claims.delete(messageID)
  }

  export async function systemPaths() {
    const config = await Config.get()
    const paths = new Set<string>()

    if (!Flag.OPENCODE_DISABLE_PROJECT_CONFIG) {
      // Instruction files: first match wins (AGENTS.md > CLAUDE.md > CONTEXT.md)
      for (const file of FILES) {
        const matches = await Filesystem.findUp(file, Instance.directory, Instance.worktree)
        if (matches.length > 0) {
          matches.forEach((p) => {
            paths.add(path.resolve(p))
          })
          break
        }
      }

      // Always-load files: each loaded independently if it exists
      for (const file of ALWAYS_LOAD_FILES) {
        const matches = await Filesystem.findUp(file, Instance.directory, Instance.worktree)
        for (const p of matches) {
          paths.add(path.resolve(p))
        }
      }
    }

    // Global instruction files (first match wins)
    for (const file of globalFiles()) {
      if (await Filesystem.exists(file)) {
        paths.add(path.resolve(file))
        break
      }
    }

    // Global always-load files (each loaded independently)
    for (const file of globalAlwaysLoadFiles()) {
      if (await Filesystem.exists(file)) {
        paths.add(path.resolve(file))
      }
    }

    // Daily memory files: load today's and yesterday's if they exist
    const dailyDates = [todayDate(), yesterdayDate()]
    const dailyDirs = [
      path.join(Instance.directory, ".opencode", "memory"),
      path.join(Instance.directory, "memory"),
      path.join(Global.Path.config, "memory"),
    ]
    for (const date of dailyDates) {
      for (const dir of dailyDirs) {
        const dailyPath = path.join(dir, `${date}.md`)
        if (await Filesystem.exists(dailyPath)) {
          paths.add(path.resolve(dailyPath))
          break // found for this date, skip other dirs
        }
      }
    }

    if (config.instructions) {
      for (let instruction of config.instructions) {
        if (instruction.startsWith("https://") || instruction.startsWith("http://")) continue
        if (instruction.startsWith("~/")) {
          instruction = path.join(os.homedir(), instruction.slice(2))
        }
        const matches = path.isAbsolute(instruction)
          ? await Glob.scan(path.basename(instruction), {
              cwd: path.dirname(instruction),
              absolute: true,
              include: "file",
            }).catch(() => [])
          : await resolveRelative(instruction)
        matches.forEach((p) => {
          paths.add(path.resolve(p))
        })
      }
    }

    return paths
  }

  export async function system() {
    const config = await Config.get()
    const paths = await systemPaths()

    const usage: Record<Section, number> & { total: number } = {
      identity: 0,
      memory: 0,
      skills: 0,
      other: 0,
      total: 0,
    }

    const files: string[] = []
    for (const p of paths) {
      const row = fromdb(p)
      let content = row?.raw
      if (!content) {
        content = await Filesystem.readText(p).catch(() => "")
      }
      if (!content) continue

      const sec = section(p, row?.kind)

      const perFile = clip(content, FILE_CAP, "file too large for context window")
      if (perFile !== content) {
        log.warn("instruction file truncated", {
          path: p,
          source: row?.source ?? "file",
          section: sec,
          original: content.length,
          max: FILE_CAP,
        })
        content = perFile
      }

      const leftSection = SECTION_CAP[sec] - usage[sec]
      if (leftSection <= 0) {
        log.warn("instruction skipped due to section budget", {
          path: p,
          section: sec,
          sectionUsed: usage[sec],
          sectionCap: SECTION_CAP[sec],
        })
        continue
      }

      const perSection = clip(content, leftSection, `${sec} section budget reached`)
      if (perSection !== content) {
        log.warn("instruction truncated due to section budget", {
          path: p,
          section: sec,
          source: row?.source ?? "file",
          sectionUsed: usage[sec],
          sectionCap: SECTION_CAP[sec],
        })
        content = perSection
      }

      const leftTotal = TOTAL_CAP - usage.total
      if (leftTotal <= 0) {
        log.warn("instruction skipped due to total budget", {
          path: p,
          source: row?.source ?? "file",
          totalUsed: usage.total,
          totalCap: TOTAL_CAP,
        })
        continue
      }

      const perTotal = clip(content, leftTotal, "global instruction budget reached")
      if (perTotal !== content) {
        log.warn("instruction truncated due to total budget", {
          path: p,
          source: row?.source ?? "file",
          totalUsed: usage.total,
          totalCap: TOTAL_CAP,
        })
        content = perTotal
      }

      usage[sec] += content.length
      usage.total += content.length
      files.push("Instructions from: " + p + "\n" + content)
    }

    const urls: string[] = []
    if (config.instructions) {
      for (const instruction of config.instructions) {
        if (instruction.startsWith("https://") || instruction.startsWith("http://")) {
          urls.push(instruction)
        }
      }
    }
    const fetches = urls.map((url) =>
      fetch(url, { signal: AbortSignal.timeout(5000) })
        .then((res) => (res.ok ? res.text() : ""))
        .catch(() => "")
        .then((x) => (x ? "Instructions from: " + url + "\n" + x : "")),
    )

    return Promise.all(fetches).then((result) => [...files, ...result.filter(Boolean)])
  }

  export function loaded(messages: MessageV2.WithParts[]) {
    const paths = new Set<string>()
    for (const msg of messages) {
      for (const part of msg.parts) {
        if (part.type === "tool" && part.tool === "read" && part.state.status === "completed") {
          if (part.state.time.compacted) continue
          const loaded = part.state.metadata?.loaded
          if (!loaded || !Array.isArray(loaded)) continue
          for (const p of loaded) {
            if (typeof p === "string") paths.add(p)
          }
        }
      }
    }
    return paths
  }

  export async function find(dir: string) {
    for (const file of FILES) {
      const filepath = path.resolve(path.join(dir, file))
      if (await Filesystem.exists(filepath)) return filepath
    }
  }

  export async function resolve(messages: MessageV2.WithParts[], filepath: string, messageID: string) {
    const system = await systemPaths()
    const already = loaded(messages)
    const results: { filepath: string; content: string }[] = []

    const target = path.resolve(filepath)
    let current = path.dirname(target)
    const root = path.resolve(Instance.directory)

    while (current.startsWith(root) && current !== root) {
      const found = await find(current)

      if (found && found !== target && !system.has(found) && !already.has(found) && !isClaimed(messageID, found)) {
        claim(messageID, found)
        const content = await Filesystem.readText(found).catch(() => undefined)
        if (content) {
          results.push({ filepath: found, content: "Instructions from: " + found + "\n" + content })
        }
      }
      current = path.dirname(current)
    }

    return results
  }
}
