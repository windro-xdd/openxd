import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { KnowledgeSync } from "../../src/knowledge/service"
import { Bus } from "../../src/bus"
import { FileWatcher } from "../../src/file/watcher"
import { Filesystem } from "../../src/util/filesystem"

afterEach(async () => {
  await Instance.disposeAll()
})

describe("KnowledgeSync", () => {
  test("initializes and indexes markdown sources", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Team\nKeep context fresh")
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nProject notes")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const doc = KnowledgeSync.get_document(path.join(tmp.path, "AGENTS.md"))
        expect(doc).toBeDefined()
        expect(doc?.kind).toBe("instruction")
        expect(doc?.raw).toContain("Keep context fresh")

        const rows = KnowledgeSync.search_chunks({ query: "context", limit: 10 })
        expect(rows.some((row) => row.path === path.join(tmp.path, "AGENTS.md"))).toBe(true)
      },
    })
  })

  test("ignores own mirrored writes and ingests external changes", async () => {
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

        const first = await KnowledgeSync.write_document({
          path: file,
          raw: "# Memory\ninternal write",
        })
        expect(first?.state).toBe("ok")
        const v1 = KnowledgeSync.get_document(file)?.version
        expect(typeof v1).toBe("number")

        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })
        const v2 = KnowledgeSync.get_document(file)?.version
        expect(v2).toBe(v1)

        await Filesystem.write(file, "# Memory\nexternal change\n")
        await Bus.publish(FileWatcher.Event.Updated, { file, event: "change" })
        const next = KnowledgeSync.get_document(file)
        expect(next?.version).toBe((v1 ?? 0) + 1)
        expect(next?.raw).toContain("external change")
      },
    })
  })

  test("flags optimistic-version conflicts without silent loss", async () => {
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
        expect(base).toBeDefined()

        const ok = await KnowledgeSync.write_document({
          path: file,
          raw: "# Memory\nsecond",
          expected: base?.version,
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
