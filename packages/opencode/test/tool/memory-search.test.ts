import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { MemorySearchTool } from "../../src/tool/memory-search"

const ctx = {
  sessionID: "test-memory-search-session",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

afterEach(async () => {
  await Instance.disposeAll()
})

describe("tool.memory_search", () => {
  test("returns sectioned results with file and line markers from knowledge DB", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "MEMORY.md"),
          "# Memory\n\n## Project Alpha\nSQLite sync strategy and chunk retrieval details.\n\n## Project Beta\nNothing here.\n",
        )
        await Bun.write(path.join(dir, "memory", "2026-03-21.md"), "# 2026-03-21\n\n## Notes\nSQLite relevance scoring notes.\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const tool = await MemorySearchTool.init()
        const result = await tool.execute({ query: "sqlite sync", maxResults: 3 }, ctx)

        expect(result.title).toBe("Memory Search")
        expect(result.output).toContain('Found')
        expect(result.output).toContain("### Result 1")
        expect(result.output).toContain("**File:**")
        expect(result.output).toContain("**Section:**")
        expect(result.output).toContain("MEMORY.md#")
        expect(result.metadata.returned).toBeGreaterThan(0)
        expect(result.metadata.filesSearched).toBeGreaterThanOrEqual(2)
      },
    })
  })

  test("honors maxResults and reports empty search cleanly", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nOne thing only.\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const tool = await MemorySearchTool.init()

        const some = await tool.execute({ query: "thing", maxResults: 1 }, ctx)
        expect(some.metadata.returned).toBe(1)
        expect((some.output.match(/### Result/g) || []).length).toBe(1)

        const none = await tool.execute({ query: "absolutelymissingterm", maxResults: 2 }, ctx)
        expect(none.output).toContain('No results found for "absolutelymissingterm"')
        expect(none.metadata.filesSearched).toBeGreaterThanOrEqual(1)
      },
    })
  })
})
