import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { Instance } from "../../src/project/instance"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { KnowledgeSync } from "../../src/knowledge/service"
import { Bus } from "../../src/bus"
import { FileWatcher } from "../../src/file/watcher"
import { Filesystem } from "../../src/util/filesystem"
import { Hash } from "../../src/util/hash"

afterEach(async () => {
  await resetDatabase()
})

const TAG = "opencode:knowledge-sync"

function norm(raw: string) {
  const text = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd()
  return text ? text + "\n" : ""
}

function mark(input: { version: number; hash: string; source: "disk" | "mirror"; time: number }) {
  return `<!-- ${TAG} v=${input.version} h=${input.hash} s=${input.source} t=${input.time} -->`
}

function parseMark(raw: string) {
  const m = raw.match(new RegExp(`<!--\\s*${TAG}\\s+v=(\\d+)\\s+h=([a-f0-9]+)\\s+s=([^\\s]+)\\s+t=(\\d+)\\s*-->`))
  if (!m) return
  return {
    version: Number(m[1]),
    hash: m[2],
    source: m[3],
    time: Number(m[4]),
  }
}

describe("KnowledgeSync", () => {
  test("startup import indexes required markdown classes", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Team\nKeep context fresh")
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nProject notes")
        await fs.mkdir(path.join(dir, "memory"), { recursive: true })
        await Bun.write(path.join(dir, "memory", "2026-03-21.md"), "# Daily\nSync log")
        await fs.mkdir(path.join(dir, ".opencode", "skill", "sync-skill"), { recursive: true })
        await Bun.write(
          path.join(dir, ".opencode", "skill", "sync-skill", "SKILL.md"),
          `---
name: sync-skill
description: Skill for sync tests.
---

# Sync Skill
`,
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const instruction = KnowledgeSync.get_document(path.join(tmp.path, "AGENTS.md"))
        const memory = KnowledgeSync.get_document(path.join(tmp.path, "MEMORY.md"))
        const daily = KnowledgeSync.get_document(path.join(tmp.path, "memory", "2026-03-21.md"))
        const skill = KnowledgeSync.get_document(path.join(tmp.path, ".opencode", "skill", "sync-skill", "SKILL.md"))

        expect(instruction?.kind).toBe("instruction")
        expect(memory?.kind).toBe("memory")
        expect(daily?.kind).toBe("daily")
        expect(skill?.kind).toBe("skill")

        const rows0 = KnowledgeSync.search_chunks({ query: "context", limit: 20 })
        const rows1 = KnowledgeSync.search_chunks({ query: "sync", limit: 20 })
        expect(rows0.some((row) => row.path === path.join(tmp.path, "AGENTS.md"))).toBe(true)
        expect(rows1.some((row) => row.path === path.join(tmp.path, "memory", "2026-03-21.md"))).toBe(true)
        expect(rows1.some((row) => row.path === path.join(tmp.path, ".opencode", "skill", "sync-skill", "SKILL.md"))).toBe(true)
      },
    })
  })

  test("supports DB->MD and MD->DB roundtrip with version/hash progression and no-op unchanged updates", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nseed")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const file = path.join(tmp.path, "MEMORY.md")
        const first = KnowledgeSync.get_document(file)
        expect(first?.version).toBe(1)
        expect(first?.raw_hash).toBe(Hash.fast(first?.raw ?? ""))

        const body = "# Memory\ninternal write"
        const raw = norm(body)
        const hash = Hash.fast(raw)

        const write = await KnowledgeSync.write_document({
          path: file,
          raw: body,
        })
        expect(write?.state).toBe("ok")

        const d1 = KnowledgeSync.get_document(file)
        const v1 = d1?.version
        expect(typeof v1).toBe("number")
        expect(v1).toBe(2)
        expect(d1?.raw).toBe(raw)
        expect(d1?.raw_hash).toBe(hash)

        const text = await Filesystem.readText(file)
        const tail = parseMark(text)
        expect(tail).toBeDefined()
        expect(tail?.version).toBe(v1)
        expect(tail?.hash).toBe(hash)
        expect(tail?.source).toBe("disk")
        expect(typeof tail?.time).toBe("number")

        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })
        const v2 = KnowledgeSync.get_document(file)?.version
        expect(v2).toBe(v1)

        await Filesystem.write(file, raw)
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })
        const v3 = KnowledgeSync.get_document(file)?.version
        expect(v3).toBe(v2)

        await Filesystem.write(file, "# Memory\nexternal change\n")
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })
        const next = KnowledgeSync.get_document(file)
        expect(next?.version).toBe((v1 ?? 0) + 1)
        expect(next?.raw).toBe("# Memory\nexternal change\n")
        expect(next?.raw_hash).toBe(Hash.fast("# Memory\nexternal change\n"))
      },
    })
  })

  test("ingests file watcher add/unlink events", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nstart")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const file = path.join(tmp.path, "AGENTS.md")
        expect(KnowledgeSync.get_document(file)).toBeUndefined()

        await Filesystem.write(file, "# Team\nFrom watcher\n")
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "add" })

        const added = KnowledgeSync.get_document(file)
        expect(added?.kind).toBe("instruction")
        expect(added?.raw).toBe("# Team\nFrom watcher\n")

        await fs.rm(file)
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "unlink" })
        expect(KnowledgeSync.get_document(file)).toBeUndefined()
      },
    })
  })

  test("handles deterministic marker conflicts and optimistic version conflicts", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nstart")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const file = path.join(tmp.path, "MEMORY.md")
        const base = KnowledgeSync.get_document(file)
        expect(base?.version).toBe(1)

        const incoming = norm("# Memory\nincoming mirror write")
        const incomingHash = Hash.fast(incoming)
        const incomingMark = mark({
          version: base!.version,
          hash: incomingHash,
          source: "mirror",
          time: (base!.time_source_updated ?? Date.now()) + 1000,
        })

        await Filesystem.write(file, incoming + "\n" + incomingMark + "\n")
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })

        const kept = KnowledgeSync.get_document(file)
        expect(kept?.version).toBe(base?.version)
        expect(kept?.raw).toBe(base?.raw)
        expect(kept?.conflict_state).toBe("deterministic_keep_current")
        expect(kept?.conflict_raw).toBe(incoming)
        expect(kept?.conflict_hash).toBe(incomingHash)

        const ok = await KnowledgeSync.write_document({
          path: file,
          raw: "# Memory\nsecond",
          expected: kept?.version,
        })
        expect(ok?.state).toBe("ok")

        const conflict = await KnowledgeSync.write_document({
          path: file,
          raw: "# Memory\nstale write",
          expected: base?.version,
        })

        expect(conflict?.state).toBe("conflict")
        const doc = KnowledgeSync.get_document(file)
        expect(doc?.conflict_state).toBe("version_mismatch")
        expect(doc?.conflict_raw).toContain("stale write")
        expect(doc?.raw).toContain("second")
      },
    })
  })
})
