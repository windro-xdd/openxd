import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as path from "path"
import * as fs from "fs/promises"
import * as os from "os"
import { AgentMemory } from "@/agent/memory"

// Create unique directories per test to avoid conflicts
let testCounter = 0

describe("AgentMemory", () => {
  let tempDir: string
  let originalCwd: string

  beforeEach(async () => {
    // Save original cwd
    originalCwd = process.cwd()
    // Create a unique temp directory for this test
    const testId = ++testCounter
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `agent-memory-${testId}-`))
    process.chdir(tempDir)
  })

  afterEach(async () => {
    // Restore original cwd
    try {
      process.chdir(originalCwd)
    } catch {
      // ignore if fails
    }
    // Clean up
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // ignore if fails
    }
  })

  it("should create default memory if file does not exist", async () => {
    const mem = await AgentMemory.load()
    expect(mem.version).toBe(1)
    expect(mem.skills).toEqual([])
    expect(mem.createdAt).toBeDefined()
  })

  it("should save and load memory", async () => {
    const skill: AgentMemory.Skill = {
      name: "typescript-strict-mode",
      domain: "software",
      description: "Enforce TypeScript strict mode in projects",
      lastUsed: Date.now(),
      useCount: 1,
    }

    await AgentMemory.addSkill(skill)

    const loaded = await AgentMemory.load()
    expect(loaded.skills).toHaveLength(1)
    expect(loaded.skills[0].name).toBe("typescript-strict-mode")
  })

  it("should increment useCount when adding existing skill", async () => {
    // Clear memory first
    await AgentMemory.clear()

    const skill1: AgentMemory.Skill = {
      name: "react-hooks",
      domain: "software",
      description: "Using React hooks effectively",
      lastUsed: Date.now(),
      useCount: 1,
    }

    await AgentMemory.addSkill(skill1)
    await new Promise((r) => setTimeout(r, 10)) // Ensure time difference

    const skill2: AgentMemory.Skill = {
      name: "react-hooks",
      domain: "software",
      description: "Using React hooks effectively",
      lastUsed: Date.now(),
      useCount: 1,
    }

    await AgentMemory.addSkill(skill2)

    const loaded = await AgentMemory.load()
    expect(loaded.skills).toHaveLength(1)
    expect(loaded.skills[0].useCount).toBe(2)
  })

  it("should retrieve skills by domain", async () => {
    // Clear memory first
    await AgentMemory.clear()

    const skills = [
      {
        name: "sql-optimization",
        domain: "data",
        description: "Optimize database queries",
        lastUsed: Date.now(),
        useCount: 1,
      },
      {
        name: "python-testing",
        domain: "software",
        description: "Python testing patterns",
        lastUsed: Date.now(),
        useCount: 1,
      },
      {
        name: "sql-joins",
        domain: "data",
        description: "SQL join patterns",
        lastUsed: Date.now(),
        useCount: 1,
      },
    ] as AgentMemory.Skill[]

    for (const skill of skills) {
      await AgentMemory.addSkill(skill)
    }

    const dataSkills = await AgentMemory.getSkillsByDomain("data")
    expect(dataSkills).toHaveLength(2)
    expect(dataSkills.every((s) => s.domain === "data")).toBe(true)
  })

  it("should return skills sorted by lastUsed (descending)", async () => {
    // Clear memory first
    await AgentMemory.clear()

    const skills = [
      {
        name: "old-skill",
        domain: "software",
        description: "Old skill",
        lastUsed: Date.now(),
        useCount: 1,
      },
      {
        name: "recent-skill",
        domain: "software",
        description: "Recent skill",
        lastUsed: Date.now(),
        useCount: 1,
      },
      {
        name: "middle-skill",
        domain: "software",
        description: "Middle skill",
        lastUsed: Date.now(),
        useCount: 1,
      },
    ] as AgentMemory.Skill[]

    // Add with delays to ensure different timestamps
    for (const skill of skills) {
      await AgentMemory.addSkill(skill)
      await new Promise((r) => setTimeout(r, 10))
    }

    const all = await AgentMemory.getAllSkills()
    // Since addSkill updates lastUsed, the last added (middle-skill) is most recent
    expect(all[0].name).toBe("middle-skill")
    expect(all[1].name).toBe("recent-skill")
    expect(all[2].name).toBe("old-skill")
  })

  it("should clear all skills", async () => {
    // Clear memory first
    await AgentMemory.clear()

    const skill: AgentMemory.Skill = {
      name: "test-skill",
      domain: "software",
      description: "Test",
      lastUsed: Date.now(),
      useCount: 1,
    }

    await AgentMemory.addSkill(skill)
    let loaded = await AgentMemory.load()
    expect(loaded.skills).toHaveLength(1)

    await AgentMemory.clear()
    loaded = await AgentMemory.load()
    expect(loaded.skills).toHaveLength(0)
  })
})
