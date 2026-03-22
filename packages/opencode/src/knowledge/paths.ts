import path from "path"
import os from "os"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Flag } from "@/flag/flag"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import { Glob } from "@/util/glob"
import { InstructionPrompt } from "@/session/instruction"
import { Skill } from "@/skill"

export type Kind = "instruction" | "memory" | "daily" | "skill"

export type Entry = {
  path: string
  kind: Kind
  source: "disk" | "mirror"
}

const MEMORY = ["MEMORY.md", "SOUL.md", "USER.md", "IDENTITY.md", "LESSONS.md"]

function add(map: Map<string, Entry>, file: string, kind: Kind, source: "disk" | "mirror") {
  const full = path.resolve(file)
  if (map.has(full)) return
  map.set(full, { path: full, kind, source })
}

export async function list() {
  const map = new Map<string, Entry>()

  for (const file of await InstructionPrompt.systemPaths()) {
    const name = path.basename(file)
    const kind: Kind = MEMORY.includes(name)
      ? "memory"
      : /^\d{4}-\d{2}-\d{2}\.md$/.test(name)
        ? "daily"
        : "instruction"
    add(map, file, kind, "disk")
  }

  const cfg = await Config.get()
  if (cfg.instructions) {
    for (let item of cfg.instructions) {
      if (item.startsWith("http://") || item.startsWith("https://")) continue
      if (item.startsWith("~/")) item = path.join(os.homedir(), item.slice(2))
      if (path.isAbsolute(item)) {
        const files = await Glob.scan(path.basename(item), {
          cwd: path.dirname(item),
          absolute: true,
          include: "file",
          dot: true,
        }).catch(() => [])
        for (const file of files) add(map, file, "instruction", "disk")
        continue
      }
      const files = await Filesystem.globUp(item, Instance.directory, Instance.worktree).catch(() => [])
      for (const file of files) add(map, file, "instruction", "disk")
    }
  }

  const dirs = await Config.directories()
  for (const dir of dirs) {
    for (const name of MEMORY) {
      const file = path.join(dir, name)
      if (await Filesystem.exists(file)) {
        add(map, file, "memory", "mirror")
      }
    }
    const day = await Glob.scan("memory/*.md", {
      cwd: dir,
      absolute: true,
      include: "file",
      dot: true,
    }).catch(() => [])
    for (const file of day) add(map, file, "daily", "mirror")
  }

  const projectDirs = await ConfigPaths.directories(Instance.directory, Instance.worktree)
  for (const dir of projectDirs) {
    const list = await Glob.scan("{agent,agents,command,commands,mode,modes}/**/*.md", {
      cwd: dir,
      absolute: true,
      include: "file",
      dot: true,
      symlink: true,
    }).catch(() => [])
    for (const file of list) add(map, file, "instruction", "disk")
  }

  const skills = await Skill.all()
  for (const skill of skills) {
    add(map, skill.location, "skill", "disk")
  }

  if (!Flag.OPENCODE_DISABLE_EXTERNAL_SKILLS) {
    const ext = [path.join(Global.Path.home, ".claude"), path.join(Global.Path.home, ".agents")]
    for (const dir of ext) {
      if (!(await Filesystem.isDir(dir))) continue
      const files = await Glob.scan("skills/**/SKILL.md", {
        cwd: dir,
        absolute: true,
        include: "file",
        dot: true,
        symlink: true,
      }).catch(() => [])
      for (const file of files) add(map, file, "skill", "disk")
    }
  }

  return Array.from(map.values()).sort((a, b) => a.path.localeCompare(b.path))
}

export function kind(file: string): Kind | undefined {
  const base = path.basename(file)
  if (base === "SKILL.md") return "skill"
  if (MEMORY.includes(base)) return "memory"
  if (/^\d{4}-\d{2}-\d{2}\.md$/.test(base) && path.basename(path.dirname(file)) === "memory") return "daily"
  if (base === "AGENTS.md" || base === "CLAUDE.md" || base === "CONTEXT.md") return "instruction"
  if (base.endsWith(".md") && /[\\/]((agent|agents|command|commands|mode|modes)[\\/])/.test(file)) return "instruction"
  return undefined
}

export function source(file: string): "disk" | "mirror" {
  const full = path.resolve(file)
  if (full.startsWith(path.resolve(Global.Path.config) + path.sep)) return "mirror"
  if (full.includes(`${path.sep}.opencode${path.sep}`)) return "mirror"
  return "disk"
}
