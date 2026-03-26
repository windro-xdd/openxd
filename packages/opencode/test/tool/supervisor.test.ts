import { describe, expect, test } from "bun:test"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"

describe("tool.supervisor", () => {
  test("is registered in tool ids", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("supervisor")
      },
    })
  })

  test("returns failed item for invalid subagent", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const list = await ToolRegistry.tools({ providerID: "anthropic", modelID: "claude-sonnet-4-5" })
        const tool = list.find((x) => x.id === "supervisor")
        expect(tool).toBeDefined()

        const out = await tool!.execute(
          {
            max_parallel: 2,
            steps: [
              {
                description: "Invalid worker",
                subagent_type: "does-not-exist",
                prompt: "noop",
              },
            ],
          },
          {
            sessionID: "session_test",
            messageID: "message_test",
            agent: "build",
            abort: new AbortController().signal,
            messages: [],
            metadata: () => {},
            ask: async () => {},
          },
        )

        expect(out.output).toContain("Dispatched 1 subtask(s)")
        expect(out.output).toContain("FAIL - Invalid worker")
        expect(out.metadata.total).toBe(1)
        expect(out.metadata.failed).toBe(1)
      },
    })
  })
})
