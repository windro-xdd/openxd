import { describe, it, expect } from "bun:test"
import { detectDomain, getDomainGuidelines, getDomainContext } from "../../src/agent/domain"
import {
  createState,
  recordToolCall,
  recordMessage,
  validate,
  detectToolLoop,
  detectMessageDedup,
} from "../../src/agent/guardrails"

describe("Autonomous Behavior Across Domains", () => {
  describe("Domain Switching", () => {
    it("correctly identifies software domain from diverse inputs", () => {
      const inputs = [
        "Fix this TypeScript bug in the API",
        "Debug the function and optimize performance",
        "Refactor the component architecture",
        "Write a new feature for the database",
      ]

      for (const input of inputs) {
        const result = detectDomain(input)
        expect(result.domain).toBe("software")
        expect(result.confidence).toBeGreaterThan(0.3)
      }
    })

    it("identifies security-related inputs", () => {
      const inputs = [
        "Find vulnerabilities in this application",
        "Help with penetration testing",
        "Analyze this potential exploit",
        "Research this CVE",
      ]

      for (const input of inputs) {
        const result = detectDomain(input)
        // Should be security or research (both valid for CVE research)
        expect(["security", "research"].includes(result.domain)).toBe(true)
      }
    })

    it("correctly identifies research domain", () => {
      const inputs = [
        "Compare these three frameworks",
        "Analyze market trends",
        "Research the latest benchmarks",
        "Investigate this pattern",
      ]

      for (const input of inputs) {
        const result = detectDomain(input)
        expect(result.domain).toBe("research")
      }
    })

    it("correctly identifies writing domain", () => {
      const inputs = [
        "Write documentation for this API",
        "Create a blog post about testing",
        "Draft an email to the team",
        "Write a README file",
      ]

      for (const input of inputs) {
        const result = detectDomain(input)
        expect(result.domain).toBe("writing")
      }
    })

    it("identifies infrastructure-related inputs", () => {
      const inputs = [
        "Deploy with Docker and Kubernetes",
        "Set up CI/CD pipeline",
        "Configure monitoring with Prometheus",
        "Manage the database",
      ]

      for (const input of inputs) {
        const result = detectDomain(input)
        // Should be infrastructure or software (database is ambiguous)
        expect(["infrastructure", "software"].includes(result.domain)).toBe(true)
      }
    })
  })

  describe("Domain-Specific Guidance", () => {
    it("provides software guidance", () => {
      const guidance = getDomainGuidelines("software")
      expect(guidance).toContain("TypeScript")
      expect(guidance).toContain("architecture")
      expect(guidance).toContain("test")
    })

    it("provides security guidance", () => {
      const guidance = getDomainGuidelines("security")
      expect(guidance).toContain("OWASP")
      expect(guidance).toContain("risk")
      expect(guidance).toContain("threat")
    })

    it("provides research guidance", () => {
      const guidance = getDomainGuidelines("research")
      expect(guidance).toContain("search")
      expect(guidance).toContain("evidence")
    })

    it("provides writing guidance", () => {
      const guidance = getDomainGuidelines("writing")
      expect(guidance).toContain("tone")
      expect(guidance).toContain("clearly")
    })

    it("provides infrastructure guidance", () => {
      const guidance = getDomainGuidelines("infrastructure")
      expect(guidance).toContain("scalability")
      expect(guidance).toContain("monitoring")
    })
  })

  describe("Guardrails in Multi-Domain Scenarios", () => {
    it("prevents tool loops when switching domains", () => {
      const state = createState()

      // Simulate switching between tools frequently
      recordToolCall(state, "search")
      recordToolCall(state, "read")
      recordToolCall(state, "grep")
      recordToolCall(state, "search")
      recordToolCall(state, "read")
      recordToolCall(state, "grep")

      // No loop should be detected (different tools)
      const searchLoop = detectToolLoop(state, "search")
      const readLoop = detectToolLoop(state, "read")
      const grepLoop = detectToolLoop(state, "grep")

      expect(searchLoop.isLoop).toBe(false)
      expect(readLoop.isLoop).toBe(false)
      expect(grepLoop.isLoop).toBe(false)
    })

    it("detects when repeating same search results message", () => {
      const state = createState()
      const message =
        "Here are the search results: [result1, result2, result3]"

      recordMessage(state, message)
      recordMessage(state, message)

      const dedup = detectMessageDedup(state, message)
      expect(dedup.isDuplicate).toBe(true)
    })

    it("validates mixed domain work", () => {
      const state = createState()

      // Simulate domain switching workflow
      recordToolCall(state, "search") // research domain
      recordMessage(state, "Found security CVE info")

      recordToolCall(state, "grep") // software domain
      recordMessage(state, "Located vulnerable code")

      recordToolCall(state, "write") // writing domain
      recordMessage(state, "Wrote security summary")

      const issues = validate(state, "write", "New message", 3)
      expect(issues.length).toBe(0)
    })
  })

  describe("Context Awareness", () => {
    it("provides domain context for messages", () => {
      const context = getDomainContext(
        "Fix this TypeScript bug in the authentication module",
      )
      expect(context).toContain("Domain Detection")
      expect(context).toContain("Detected Domain")
      expect(context).toContain("Confidence")
      expect(context).toContain("software")
    })

    it("works with ambiguous requests", () => {
      const context = getDomainContext("Help me")
      expect(context).toContain("Domain Detection")
      // Should default to software
      expect(context).toContain("software")
    })
  })

  describe("Autonomous Workflow Simulation", () => {
    it("can handle a multi-step workflow", () => {
      const state = createState()

      // Step 1: Research (domain: research)
      recordToolCall(state, "web_search")
      recordMessage(state, "Found 3 framework options")

      // Step 2: Analysis (domain: software)
      recordToolCall(state, "read")
      recordToolCall(state, "grep")
      recordMessage(state, "Analyzed framework details")

      // Step 3: Documentation (domain: writing)
      recordToolCall(state, "write")
      recordMessage(state, "Documented findings")

      // Verify workflow completed without guardrail violations
      const issues = validate(state, "write", "New final message", 2)
      expect(issues.length).toBe(0)
      expect(state.toolCallHistory.length).toBe(4)
    })

    it("maintains state across tool calls", () => {
      const state = createState()

      // Simulate autonomous agent making multiple decisions
      for (let i = 0; i < 10; i++) {
        recordToolCall(state, "tool")
        recordMessage(state, `Message ${i}`)
      }

      expect(state.toolCallHistory.length).toBeGreaterThan(0)
      expect(state.recentMessages.length).toBeGreaterThan(0)
    })
  })

  describe("Zero to Multi-Domain Capability", () => {
    it("can work across all domains in sequence", () => {
      const domains = ["software", "security", "research", "writing", "infrastructure"]

      for (const domain of domains) {
        const guidance = getDomainGuidelines(domain)
        expect(guidance.length).toBeGreaterThan(0)
      }
    })

    it("provides appropriate guidance for each domain", () => {
      const inputs: [string, string[]][] = [
        ["Fix the bug", ["software"]],
        ["Find issues", ["security", "research"]],
        ["Research frameworks", ["research"]],
        ["Write documentation", ["writing"]],
        ["Deploy with Docker", ["infrastructure", "software"]],
      ]

      for (const [input, expectedDomains] of inputs) {
        const result = detectDomain(input)
        expect(expectedDomains.includes(result.domain)).toBe(true)
      }
    })
  })
})
