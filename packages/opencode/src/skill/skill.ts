import z from "zod"
import path from "path"
import os from "os"
import matter from "gray-matter"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { NamedError } from "@opencode-ai/util/error"
import { ConfigMarkdown } from "../config/markdown"
import { Log } from "../util/log"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@/flag/flag"
import { Bus } from "@/bus"
import { Session } from "@/session"
import { Discovery } from "./discovery"
import { Glob } from "../util/glob"
import { Hash } from "@/util/hash"
import { KnowledgeRepo } from "@/knowledge/repo"
import { FileWatcher } from "@/file/watcher"

export namespace Skill {
  const log = Log.create({ service: "skill" })
  export const Info = z.object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
    triggers: z.array(z.string()).default([]),
    content: z.string(),
  })
  export type Info = z.infer<typeof Info>

  export const InvalidError = NamedError.create(
    "SkillInvalidError",
    z.object({
      path: z.string(),
      message: z.string().optional(),
      issues: z.custom<z.core.$ZodIssue[]>().optional(),
    }),
  )

  export const NameMismatchError = NamedError.create(
    "SkillNameMismatchError",
    z.object({
      path: z.string(),
      expected: z.string(),
      actual: z.string(),
    }),
  )

  // External skill directories to search for (project-level and global)
  // These follow the directory layout used by Claude Code and other agents.
  const EXTERNAL_DIRS = [".claude", ".agents"]
  const EXTERNAL_SKILL_PATTERN = "skills/**/SKILL.md"
  const OPENCODE_SKILL_PATTERN = "{skill,skills}/**/SKILL.md"
  const SKILL_PATTERN = "**/SKILL.md"

  function normalize(raw: string) {
    const text = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd()
    return text ? text + "\n" : ""
  }

  function parse(raw: string, location: string) {
    let md
    try {
      md = matter(raw)
    } catch {
      try {
        md = matter(ConfigMarkdown.fallbackSanitization(raw))
      } catch (err) {
        const message = `${location}: Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`
        Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to parse skill", { skill: location, err })
        return
      }
    }

    const parsed = Info.pick({ name: true, description: true, triggers: true }).safeParse(md.data)
    if (!parsed.success) return
    return {
      name: parsed.data.name,
      description: parsed.data.description,
      location,
      triggers: parsed.data.triggers,
      content: md.content,
    } satisfies Info
  }

  function add(skills: Record<string, Info>, info: Info) {
    if (skills[info.name]) {
      log.warn("duplicate skill name", {
        name: info.name,
        existing: skills[info.name].location,
        duplicate: info.location,
      })
    }
    skills[info.name] = info
  }

  function marker(meta: unknown) {
    try {
      const data =
        typeof meta === "string"
          ? JSON.parse(meta)
          : typeof meta === "object" && meta !== null
            ? meta
            : undefined
      if (!data || typeof data !== "object") return
      if (!("marker" in data)) return
      const item = (data as { marker?: unknown }).marker
      if (typeof item !== "object" || item === null) return
      const ver = Number((item as { version?: unknown }).version)
      if (!Number.isFinite(ver)) return
      return ver
    } catch {
      return
    }
  }

  export const state = Instance.state(async () => {
    const skills: Record<string, Info> = {}
    const dirs = new Set<string>()

    const drop = (location: string) => {
      const full = path.resolve(location)
      for (const [name, item] of Object.entries(skills)) {
        if (path.resolve(item.location) !== full) continue
        delete skills[name]
      }

      const dir = path.dirname(full)
      const used = Object.values(skills).some((item) => path.dirname(path.resolve(item.location)) === dir)
      if (!used) dirs.delete(dir)
    }

    const addSkill = async (match: string) => {
      const location = path.resolve(match)
      drop(location)
      const stat = Filesystem.stat(match)
      const mtime = Number(stat?.mtimeMs ?? 0)

      const doc = KnowledgeRepo.get(location)
      if (doc?.kind === "skill") {
        const ver = marker(doc.metadata)
        const current = ver === undefined || ver === doc.version
        const fresh = current && Number(doc.time_source_updated ?? 0) === mtime
        if (fresh) {
          const info = parse(doc.raw, location)
          if (info) {
            dirs.add(path.dirname(location))
            add(skills, info)
            return
          }
        }

        const text = await Filesystem.readText(location).catch(() => undefined)
        const hash = typeof text === "string" ? Hash.fast(normalize(text)) : undefined
        if (hash && hash === doc.raw_hash && current) {
          const info = parse(doc.raw, location)
          if (info) {
            dirs.add(path.dirname(location))
            add(skills, info)
            return
          }
        }
      }

      const md = await ConfigMarkdown.parse(location).catch((err) => {
        const message = ConfigMarkdown.FrontmatterError.isInstance(err)
          ? err.data.message
          : `Failed to parse skill ${location}`
        Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to load skill", { skill: location, err })
        return undefined
      })

      if (!md) return

      const parsed = Info.pick({ name: true, description: true, triggers: true }).safeParse(md.data)
      if (!parsed.success) return

      dirs.add(path.dirname(location))

      add(skills, {
        name: parsed.data.name,
        description: parsed.data.description,
        location,
        triggers: parsed.data.triggers,
        content: md.content,
      })
    }

    const scanExternal = async (root: string, scope: "global" | "project") => {
      return Glob.scan(EXTERNAL_SKILL_PATTERN, {
        cwd: root,
        absolute: true,
        include: "file",
        dot: true,
        symlink: true,
      })
        .then((matches) => Promise.all(matches.map(addSkill)))
        .catch((error) => {
          log.error(`failed to scan ${scope} skills`, { dir: root, error })
        })
    }

    // Scan external skill directories (.claude/skills/, .agents/skills/, etc.)
    // Load global (home) first, then project-level (so project-level overwrites)
    if (!Flag.OPENCODE_DISABLE_EXTERNAL_SKILLS) {
      for (const dir of EXTERNAL_DIRS) {
        const root = path.join(Global.Path.home, dir)
        if (!(await Filesystem.isDir(root))) continue
        await scanExternal(root, "global")
      }

      for await (const root of Filesystem.up({
        targets: EXTERNAL_DIRS,
        start: Instance.directory,
        stop: Instance.worktree,
      })) {
        await scanExternal(root, "project")
      }
    }

    // Scan .openxd/skill/ directories
    for (const dir of await Config.directories()) {
      const matches = await Glob.scan(OPENCODE_SKILL_PATTERN, {
        cwd: dir,
        absolute: true,
        include: "file",
        symlink: true,
      })
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Scan additional skill paths from config
    const config = await Config.get()
    for (const skillPath of config.skills?.paths ?? []) {
      const expanded = skillPath.startsWith("~/") ? path.join(os.homedir(), skillPath.slice(2)) : skillPath
      const resolved = path.isAbsolute(expanded) ? expanded : path.join(Instance.directory, expanded)
      if (!(await Filesystem.isDir(resolved))) {
        log.warn("skill path not found", { path: resolved })
        continue
      }
      const matches = await Glob.scan(SKILL_PATTERN, {
        cwd: resolved,
        absolute: true,
        include: "file",
        symlink: true,
      })
      for (const match of matches) {
        await addSkill(match)
      }
    }

    // Download and load skills from URLs
    for (const url of config.skills?.urls ?? []) {
      const list = await Discovery.pull(url)
      for (const dir of list) {
        dirs.add(dir)
        const matches = await Glob.scan(SKILL_PATTERN, {
          cwd: dir,
          absolute: true,
          include: "file",
          symlink: true,
        })
        for (const match of matches) {
          await addSkill(match)
        }
      }
    }

    const unsub = Bus.subscribe(FileWatcher.Event.Updated, async (evt) => {
      if (path.basename(evt.properties.file) !== "SKILL.md") return
      const location = path.resolve(evt.properties.file)
      if (evt.properties.event === "unlink") {
        drop(location)
        return
      }
      await addSkill(location)
    })

    return {
      skills,
      dirs,
      unsub,
    }
  }, async (s) => s.unsub?.())

  export async function get(name: string) {
    return state().then((x) => x.skills[name])
  }

  export async function all() {
    return state().then((x) => Object.values(x.skills))
  }

  export async function dirs() {
    return state().then((x) => Array.from(x.dirs))
  }

  export async function search(query: string, limit = 6) {
    const text = query.trim()
    if (!text) return [] as Array<{ name: string; description: string; rank: number }>
    const list = await all()
    if (!list.length) return [] as Array<{ name: string; description: string; rank: number }>

    const byPath = new Map(list.map((item) => [path.resolve(item.location), item]))
    const hits = KnowledgeRepo.search({ query: text, kind: "skill", limit: Math.max(limit * 8, 24) })
    const ranked = new Map<string, { name: string; description: string; rank: number }>()

    for (const hit of hits) {
      const skill = byPath.get(path.resolve(hit.path))
      if (!skill) continue
      const prev = ranked.get(skill.name)
      const row = {
        name: skill.name,
        description: skill.description,
        rank: hit.score,
      }
      if (!prev || row.rank < prev.rank) {
        ranked.set(skill.name, row)
      }
    }

    if (ranked.size) {
      return Array.from(ranked.values())
        .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
        .slice(0, limit)
    }

    const words = text.toLowerCase().split(/\s+/).filter(Boolean)
    if (!words.length) return [] as Array<{ name: string; description: string; rank: number }>

    const scored = list
      .map((item) => {
        const name = item.name.toLowerCase()
        const description = item.description.toLowerCase()
        const triggers = item.triggers.join(" ").toLowerCase()
        const content = item.content.toLowerCase()
        if (words.every((word) => !name.includes(word) && !description.includes(word) && !triggers.includes(word) && !content.includes(word))) {
          return
        }
        const rank = words.reduce((score, word) => {
          if (name === word) return score - 6
          if (name.includes(word)) return score - 4
          if (description.includes(word)) return score - 3
          if (triggers.includes(word)) return score - 2
          if (content.includes(word)) return score - 1
          return score
        }, 0)
        return {
          name: item.name,
          description: item.description,
          rank,
        }
      })
      .filter((item) => item !== undefined)

    return scored.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)).slice(0, limit)
  }
}
