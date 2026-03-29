import { describe, it, expect } from "bun:test"
import { SystemPrompt } from "../../src/session/system"
import { Provider } from "../../src/provider/provider"

describe("SystemPrompt integration with OpenXD Identity", () => {
  it("identity function returns a non-empty array", async () => {
    const identity = await SystemPrompt.identity()
    expect(identity).toBeArray()
    expect(identity.length).toBeGreaterThan(0)
    expect(identity[0]).toContain("Your Identity")
  })

  it("identity contains full-stack assistant definition", async () => {
    const identity = await SystemPrompt.identity()
    const combined = identity.join("\n")
    expect(combined).toContain("OpenXD")
    expect(combined).toContain("full-stack")
    expect(combined).toContain("personal AI assistant")
  })

  it("provider function returns valid prompts", async () => {
    // Test with a mock model
    const testModel: Partial<Provider.Model> = {
      api: { id: "claude-3-sonnet" },
    } as any

    const prompts = SystemPrompt.provider(testModel as Provider.Model)
    expect(prompts).toBeArray()
    expect(prompts.length).toBeGreaterThan(0)
    expect(prompts[0]).toBeTruthy()
  })
})
