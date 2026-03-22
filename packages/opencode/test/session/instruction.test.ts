import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import path from "path"
import { InstructionPrompt } from "../../src/session/instruction"
import { Instance } from "../../src/project/instance"
import { Global } from "../../src/global"
import { tmpdir } from "../fixture/fixture"
import { KnowledgeSync } from "../../src/knowledge/service"

describe("InstructionPrompt.resolve", () => {
  test("returns empty when AGENTS.md is at project root (already in systemPaths)", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Root Instructions")
        await Bun.write(path.join(dir, "src", "file.ts"), "const x = 1")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const system = await InstructionPrompt.systemPaths()
        expect(system.has(path.join(tmp.path, "AGENTS.md"))).toBe(true)

        const results = await InstructionPrompt.resolve([], path.join(tmp.path, "src", "file.ts"), "test-message-1")
        expect(results).toEqual([])
      },
    })
  })

  test("returns AGENTS.md from subdirectory (not in systemPaths)", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "subdir", "AGENTS.md"), "# Subdir Instructions")
        await Bun.write(path.join(dir, "subdir", "nested", "file.ts"), "const x = 1")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const system = await InstructionPrompt.systemPaths()
        expect(system.has(path.join(tmp.path, "subdir", "AGENTS.md"))).toBe(false)

        const results = await InstructionPrompt.resolve(
          [],
          path.join(tmp.path, "subdir", "nested", "file.ts"),
          "test-message-2",
        )
        expect(results.length).toBe(1)
        expect(results[0].filepath).toBe(path.join(tmp.path, "subdir", "AGENTS.md"))
      },
    })
  })

  test("doesn't reload AGENTS.md when reading it directly", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "subdir", "AGENTS.md"), "# Subdir Instructions")
        await Bun.write(path.join(dir, "subdir", "nested", "file.ts"), "const x = 1")
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const filepath = path.join(tmp.path, "subdir", "AGENTS.md")
        const system = await InstructionPrompt.systemPaths()
        expect(system.has(filepath)).toBe(false)

        const results = await InstructionPrompt.resolve([], filepath, "test-message-2")
        expect(results).toEqual([])
      },
    })
  })
})

describe("InstructionPrompt.systemPaths OPENCODE_CONFIG_DIR", () => {
  let originalConfigDir: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env["OPENCODE_CONFIG_DIR"]
  })

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env["OPENCODE_CONFIG_DIR"]
    } else {
      process.env["OPENCODE_CONFIG_DIR"] = originalConfigDir
    }
  })

  test("prefers OPENCODE_CONFIG_DIR AGENTS.md over global when both exist", async () => {
    await using profileTmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Profile Instructions")
      },
    })
    await using globalTmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Global Instructions")
      },
    })
    await using projectTmp = await tmpdir()

    process.env["OPENCODE_CONFIG_DIR"] = profileTmp.path
    const originalGlobalConfig = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path

    try {
      await Instance.provide({
        directory: projectTmp.path,
        fn: async () => {
          const paths = await InstructionPrompt.systemPaths()
          expect(paths.has(path.join(profileTmp.path, "AGENTS.md"))).toBe(true)
          expect(paths.has(path.join(globalTmp.path, "AGENTS.md"))).toBe(false)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = originalGlobalConfig
    }
  })

  test("falls back to global AGENTS.md when OPENCODE_CONFIG_DIR has no AGENTS.md", async () => {
    await using profileTmp = await tmpdir()
    await using globalTmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Global Instructions")
      },
    })
    await using projectTmp = await tmpdir()

    process.env["OPENCODE_CONFIG_DIR"] = profileTmp.path
    const originalGlobalConfig = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path

    try {
      await Instance.provide({
        directory: projectTmp.path,
        fn: async () => {
          const paths = await InstructionPrompt.systemPaths()
          expect(paths.has(path.join(profileTmp.path, "AGENTS.md"))).toBe(false)
          expect(paths.has(path.join(globalTmp.path, "AGENTS.md"))).toBe(true)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = originalGlobalConfig
    }
  })

  test("uses global AGENTS.md when OPENCODE_CONFIG_DIR is not set", async () => {
    await using globalTmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Global Instructions")
      },
    })
    await using projectTmp = await tmpdir()

    delete process.env["OPENCODE_CONFIG_DIR"]
    const originalGlobalConfig = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path

    try {
      await Instance.provide({
        directory: projectTmp.path,
        fn: async () => {
          const paths = await InstructionPrompt.systemPaths()
          expect(paths.has(path.join(globalTmp.path, "AGENTS.md"))).toBe(true)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = originalGlobalConfig
    }
  })
})

describe("InstructionPrompt.system budgets and db fallback", () => {
  let originalConfigDir: string | undefined
  let originalTestHome: string | undefined

  beforeEach(() => {
    originalConfigDir = process.env["OPENCODE_CONFIG_DIR"]
    originalTestHome = process.env["OPENCODE_TEST_HOME"]
  })

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env["OPENCODE_CONFIG_DIR"]
    } else {
      process.env["OPENCODE_CONFIG_DIR"] = originalConfigDir
    }
    if (originalTestHome === undefined) {
      delete process.env["OPENCODE_TEST_HOME"]
    } else {
      process.env["OPENCODE_TEST_HOME"] = originalTestHome
    }
  })

  test("uses db-backed content with section and total budgets", async () => {
    await using projectTmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# AGENTS\nfrom-file")
        await Bun.write(path.join(dir, "MEMORY.md"), "# MEMORY\nfrom-file")
        await Bun.write(path.join(dir, "SOUL.md"), "# SOUL\nfrom-file")
        await Bun.write(path.join(dir, "USER.md"), "# USER\nfrom-file")
        await Bun.write(path.join(dir, "IDENTITY.md"), "# IDENTITY\nfrom-file")
      },
    })
    await using globalTmp = await tmpdir({
      init: async (dir) => {
        const chars = "m".repeat(39_980)
        await Bun.write(path.join(dir, "MEMORY.md"), chars)
      },
    })

    const originalGlobalConfig = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path

    try {
      await Instance.provide({
        directory: projectTmp.path,
        fn: async () => {
          const paths = await InstructionPrompt.systemPaths()
          const projectAgents = path.join(projectTmp.path, "AGENTS.md")
          const projectMemory = path.join(projectTmp.path, "MEMORY.md")
          const projectSoul = path.join(projectTmp.path, "SOUL.md")
          const projectUser = path.join(projectTmp.path, "USER.md")
          const projectIdentity = path.join(projectTmp.path, "IDENTITY.md")
          const globalMemory = path.join(globalTmp.path, "MEMORY.md")

          expect(paths.has(projectAgents)).toBe(true)
          expect(paths.has(projectMemory)).toBe(true)
          expect(paths.has(globalMemory)).toBe(true)

          await KnowledgeSync.write_document({
            path: projectAgents,
            raw: "# AGENTS\n" + "A".repeat(500),
          })
          await KnowledgeSync.write_document({
            path: projectMemory,
            raw: "# MEMORY\n" + "B".repeat(39_980),
          })
          await KnowledgeSync.write_document({
            path: globalMemory,
            raw: "# GLOBAL MEMORY\n" + "C".repeat(39_980),
          })
          await KnowledgeSync.write_document({
            path: projectSoul,
            raw: "# SOUL\n" + "S".repeat(19_950),
          })
          await KnowledgeSync.write_document({
            path: projectUser,
            raw: "# USER\n" + "U".repeat(19_950),
          })
          await KnowledgeSync.write_document({
            path: projectIdentity,
            raw: "# IDENTITY\n" + "I".repeat(19_950),
          })

          const out = await InstructionPrompt.system()
          const agents = out.find((x) => x.startsWith(`Instructions from: ${projectAgents}\n`))
          const memory = out.find((x) => x.startsWith(`Instructions from: ${projectMemory}\n`))
          const memoryGlobal = out.find((x) => x.startsWith(`Instructions from: ${globalMemory}\n`))
          const soul = out.find((x) => x.startsWith(`Instructions from: ${projectSoul}\n`))
          const user = out.find((x) => x.startsWith(`Instructions from: ${projectUser}\n`))
          const identity = out.find((x) => x.startsWith(`Instructions from: ${projectIdentity}\n`))

          expect(agents?.includes("from-file")).toBe(false)
          expect(agents?.includes("A".repeat(100))).toBe(true)

          expect(memory?.includes("B".repeat(100))).toBe(true)
          expect(memoryGlobal?.includes("C".repeat(100))).toBe(true)
          expect(memoryGlobal?.includes("memory section budget reached")).toBe(true)

          expect(soul?.includes("S".repeat(100))).toBe(true)
          expect(user?.includes("U".repeat(100))).toBe(true)
          expect(identity?.includes("I".repeat(20))).toBe(true)
          expect(identity?.includes("identity section budget reached")).toBe(true)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = originalGlobalConfig
    }
  })

  test("falls back to filesystem reads when db lookup fails", async () => {
    await using projectTmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Root Instructions\nfrom-file-fallback")
      },
    })

    const original = KnowledgeSync.get_document
    ;(KnowledgeSync as { get_document: typeof KnowledgeSync.get_document }).get_document = () => {
      throw new Error("db unavailable")
    }

    try {
      await Instance.provide({
        directory: projectTmp.path,
        fn: async () => {
          const out = await InstructionPrompt.system()
          const row = out.find((x) => x.startsWith(`Instructions from: ${path.join(projectTmp.path, "AGENTS.md")}\n`))
          expect(row).toBeDefined()
          expect(row?.includes("from-file-fallback")).toBe(true)
        },
      })
    } finally {
      ;(KnowledgeSync as { get_document: typeof KnowledgeSync.get_document }).get_document = original
    }
  })

  test("loads config instruction URLs", async () => {
    await using projectTmp = await tmpdir({
      config: {
        instructions: ["https://example.com/instruction.md"],
      },
      init: async (dir) => {
        await Bun.write(path.join(dir, "AGENTS.md"), "# Root Instructions")
      },
    })

    const originalFetch = globalThis.fetch
    globalThis.fetch = ((url: string | URL | Request) => {
      if (url.toString() === "https://example.com/instruction.md") {
        return Promise.resolve(new Response("# Remote\nfrom-url", { status: 200 }))
      }
      return originalFetch(url)
    }) as typeof fetch

    try {
      await Instance.provide({
        directory: projectTmp.path,
        fn: async () => {
          const out = await InstructionPrompt.system()
          const remote = out.find((x) => x.startsWith("Instructions from: https://example.com/instruction.md\n"))
          expect(remote).toBeDefined()
          expect(remote?.includes("from-url")).toBe(true)
        },
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
