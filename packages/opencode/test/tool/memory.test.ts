import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { InstanceBootstrap } from "../../src/project/bootstrap"
import { MemoryTool } from "../../src/tool/memory"
import { KnowledgeSync } from "../../src/knowledge/service"

const ctx = {
  sessionID: "test-memory-session",
  messageID: "",
  callID: "",
  agent: "build",
  abort: AbortSignal.any([]),
  messages: [],
  metadata: () => {},
  ask: async () => {},
}

function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

afterEach(async () => {
  await Instance.disposeAll()
})

describe("tool.memory", () => {
  test("read keeps legacy title/metadata and resolves project .opencode path first", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, ".opencode", "MEMORY.md"), "# Memory\nproject-opencode\n")
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nproject-root\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const tool = await MemoryTool.init()
        const result = await tool.execute({ action: "read", file: "MEMORY.md" }, ctx)

        expect(result.title).toBe("Read MEMORY.md")
        expect(String(result.metadata.path)).toBe(path.join(tmp.path, ".opencode", "MEMORY.md"))
        expect(result.output).toContain("project-opencode")
        expect(result.output).not.toContain("project-root")
      },
    })
  })

  test("write updates markdown source and knowledge document", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nseed\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const file = path.join(tmp.path, "MEMORY.md")
        const tool = await MemoryTool.init()
        const result = await tool.execute({ action: "write", file: "MEMORY.md", content: "# Memory\nfrom tool" }, ctx)

        expect(result.title).toBe("Updated MEMORY.md")
        expect(result.output).toContain("Successfully wrote")

        const doc = KnowledgeSync.get_document(file)
        expect(doc).toBeDefined()
        expect(doc?.raw).toContain("from tool")

        const disk = await Bun.file(file).text()
        expect(disk).toContain("from tool")
        expect(disk).toContain("opencode:knowledge-sync")
      },
    })
  })

  test("append and read prefer knowledge DB content", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "MEMORY.md"), "# Memory\nseed\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const file = path.join(tmp.path, "MEMORY.md")
        const tool = await MemoryTool.init()

        await tool.execute({ action: "append", file: "MEMORY.md", content: "new line from append" }, ctx)

        const doc = KnowledgeSync.get_document(file)
        expect(doc?.raw).toContain("new line from append")

        await Bun.write(file, "# Memory\ndisk diverged\n")

        const read = await tool.execute({ action: "read", file: "MEMORY.md" }, ctx)
        expect(read.output).toContain("new line from append")
        expect(read.output).not.toContain("disk diverged")
      },
    })
  })

  test("daily and lesson actions write through to DB-backed files", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "LESSONS.md"), "# Lessons Learned\n")
        await Bun.write(path.join(dir, "memory", `${today()}.md`), `# ${today()}\n`)
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const tool = await MemoryTool.init()
        const daily = await tool.execute({ action: "daily", content: "captured daily event" }, ctx)
        const lesson = await tool.execute(
          {
            action: "lesson",
            content:
              "WRONG: I misread the current profile state and gave outdated advice.\nRIGHT: Check current state before giving profile edits.\nRULE: Verify live state before prescriptive edits.",
          },
          ctx,
        )

        expect(daily.title).toContain("Daily:")
        expect(String(daily.metadata.path)).toContain(`${path.sep}memory${path.sep}${today()}.md`)
        const dailyDoc = KnowledgeSync.get_document(String(daily.metadata.path))
        expect(dailyDoc?.raw).toContain("captured daily event")

        expect(lesson.title).toBe("Lesson Logged")
        expect(String(lesson.metadata.path)).toBe(path.join(tmp.path, "LESSONS.md"))
        const lessonDoc = KnowledgeSync.get_document(path.join(tmp.path, "LESSONS.md"))
        expect(lessonDoc?.raw).toContain("WRONG: I misread the current profile state")
      },
    })
  })

  test("lesson action enforces WRONG/RIGHT/RULE format", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const tool = await MemoryTool.init()
        const result = await tool.execute({ action: "lesson", content: "generic lesson text" }, ctx)

        expect(result.title).toBe("Error")
        expect(result.output).toContain("Lesson format invalid")
      },
    })
  })

  test("lesson action deduplicates against indexed history", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(
          path.join(dir, "LESSONS.md"),
          [
            "# Lessons Learned",
            "",
            "### 2026-03-20",
            "WRONG: I skipped typecheck before release.",
            "RIGHT: Run typecheck before release.",
            "RULE: Verify before release.",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        await KnowledgeSync.write_document({
          path: path.join(tmp.path, "LESSONS.md"),
          raw: await Bun.file(path.join(tmp.path, "LESSONS.md")).text(),
        })
        const tool = await MemoryTool.init()
        const result = await tool.execute(
          {
            action: "lesson",
            content:
              "WRONG: I skipped typecheck before release.\nRIGHT: Run typecheck before release.\nRULE: Verify before release.",
          },
          ctx,
        )

        expect(result.title).toBe("Error")
        expect(result.output).toContain("Duplicate lesson")
      },
    })
  })

  test("read missing file keeps compatibility output and metadata", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      init: InstanceBootstrap,
      fn: async () => {
        const tool = await MemoryTool.init()
        const result = await tool.execute({ action: "read", file: "USER.md" }, ctx)

        expect(result.title).toBe("Read USER.md")
        expect(result.output).toContain("USER.md does not exist yet")
        expect(result.metadata.exists).toBe(false)
        expect(String(result.metadata.path)).toContain("USER.md")
      },
    })
  })
})
