import { describe, it, expect } from "bun:test"
import { OpenXDIdentity } from "../../src/agent/identity"

describe("OpenXDIdentity", () => {
  it("loads identity successfully", async () => {
    const prompt = await OpenXDIdentity.identity.getSystemPromptAddition()
    expect(prompt).toBeTruthy()
    expect(prompt).toContain("OpenXD")
  })

  it("includes identity header", async () => {
    const prompt = await OpenXDIdentity.identity.getSystemPromptAddition()
    expect(prompt).toContain("# Your Identity")
  })

  it("emphasizes full-stack assistant capabilities", async () => {
    const prompt = await OpenXDIdentity.identity.getSystemPromptAddition()
    expect(prompt).toContain("personal AI assistant")
  })

  it("returns substantial content", async () => {
    const prompt = await OpenXDIdentity.identity.getSystemPromptAddition()
    expect(prompt.length).toBeGreaterThan(0)
  })
})

