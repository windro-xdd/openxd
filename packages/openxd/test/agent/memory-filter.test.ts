import { describe, it, expect } from "bun:test"
import { MemoryFilter } from "@/agent/memory-filter"
import type { AgentMemory } from "@/agent/memory"

describe("MemoryFilter", () => {
  describe("extractDomain", () => {
    it("should extract domains from user message keywords", () => {
      const system: string[] = []
      const msg = "Help me debug this bug in my React code"

      const domains = MemoryFilter.extractDomain(system, msg)
      expect(domains).toContain("software")
      expect(domains).toContain("web")
    })

    it("should extract security domain", () => {
      const system: string[] = []
      const msg = "I need to find vulnerabilities in this API"

      const domains = MemoryFilter.extractDomain(system, msg)
      expect(domains).toContain("security")
    })

    it("should extract research domain", () => {
      const system: string[] = []
      const msg = "Please analyze and compare these approaches"

      const domains = MemoryFilter.extractDomain(system, msg)
      expect(domains).toContain("research")
    })

    it("should extract writing domain", () => {
      const system: string[] = []
      const msg = "Help me write a blog post about TypeScript"

      const domains = MemoryFilter.extractDomain(system, msg)
      expect(domains).toContain("writing")
    })

    it("should return empty array if no domains match", () => {
      const system: string[] = []
      const msg = "Hello, how are you?"

      const domains = MemoryFilter.extractDomain(system, msg)
      expect(domains.length).toBe(0)
    })
  })

  describe("scoreSkill", () => {
    it("should score domain matches high", () => {
      const skill: AgentMemory.Skill = {
        name: "test",
        domain: "software",
        description: "test",
        lastUsed: Date.now(),
        useCount: 1,
      }

      const score1 = MemoryFilter.scoreSkill(skill, ["software"], new Set())
      const score2 = MemoryFilter.scoreSkill(skill, ["security"], new Set())

      expect(score1).toBeGreaterThan(score2)
    })

    it("should boost recently used skills", () => {
      const now = Date.now()
      const recent: AgentMemory.Skill = {
        name: "test",
        domain: "software",
        description: "test",
        lastUsed: now,
        useCount: 1,
      }

      const old: AgentMemory.Skill = {
        name: "test2",
        domain: "software",
        description: "test",
        lastUsed: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        useCount: 1,
      }

      const score1 = MemoryFilter.scoreSkill(recent, ["software"], new Set())
      const score2 = MemoryFilter.scoreSkill(old, ["software"], new Set())

      expect(score1).toBeGreaterThan(score2)
    })

    it("should consider use count", () => {
      const skill1: AgentMemory.Skill = {
        name: "test1",
        domain: "software",
        description: "test",
        lastUsed: Date.now(),
        useCount: 1,
      }

      const skill2: AgentMemory.Skill = {
        name: "test2",
        domain: "software",
        description: "test",
        lastUsed: Date.now(),
        useCount: 10,
      }

      const score1 = MemoryFilter.scoreSkill(skill1, [], new Set())
      const score2 = MemoryFilter.scoreSkill(skill2, [], new Set())

      expect(score2).toBeGreaterThan(score1)
    })
  })

  describe("selectRelevant", () => {
    it("should return empty array if no skills provided", () => {
      const selected = MemoryFilter.selectRelevant([], [], "test", 5)
      expect(selected).toEqual([])
    })

    it("should filter by domain when domain is detected", () => {
      const skills: AgentMemory.Skill[] = [
        {
          name: "sql",
          domain: "data",
          description: "SQL",
          lastUsed: Date.now(),
          useCount: 1,
        },
        {
          name: "react",
          domain: "web",
          description: "React",
          lastUsed: Date.now(),
          useCount: 1,
        },
        {
          name: "typescript",
          domain: "software",
          description: "TypeScript",
          lastUsed: Date.now(),
          useCount: 1,
        },
      ]

      const msg = "Help me fix this bug in React"
      const selected = MemoryFilter.selectRelevant(skills, [], msg, 5)

      expect(selected.some((s) => s.name === "react")).toBe(true)
    })

    it("should limit results to specified count", () => {
      const skills: AgentMemory.Skill[] = Array.from({ length: 10 }, (_, i) => ({
        name: `skill-${i}`,
        domain: "software",
        description: `Skill ${i}`,
        lastUsed: Date.now() - i * 1000,
        useCount: 1,
      }))

      const selected = MemoryFilter.selectRelevant(skills, [], "fix bug in code", 3)
      expect(selected.length).toBeLessThanOrEqual(3)
    })

    it("should return top recent skills if no domain detected", () => {
      const now = Date.now()
      const skills: AgentMemory.Skill[] = [
        {
          name: "old",
          domain: "software",
          description: "Old",
          lastUsed: now - 100000,
          useCount: 1,
        },
        {
          name: "recent",
          domain: "software",
          description: "Recent",
          lastUsed: now,
          useCount: 1,
        },
      ]

      const selected = MemoryFilter.selectRelevant(skills, [], "hello", 5)
      expect(selected[0].name).toBe("recent")
    })
  })
})
