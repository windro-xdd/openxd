import { describe, it, expect, beforeEach } from "bun:test"
import {
  createState,
  recordToolCall,
  recordMessage,
  recordSuccess,
  recordFailure,
  detectToolLoop,
  detectMessageDedup,
  detectRateLimitViolation,
  detectDeepNesting,
  getTooManyFailures,
  validate,
  formatValidation,
  type GuardrailState,
} from "../../src/agent/guardrails"

describe("Guardrails", () => {
  let state: GuardrailState

  beforeEach(() => {
    state = createState()
  })

  describe("Tool Loop Detection", () => {
    it("detects when same tool is called 3+ times in sequence", () => {
      recordToolCall(state, "search")
      recordToolCall(state, "search")
      recordToolCall(state, "search")

      const result = detectToolLoop(state, "search")
      expect(result.isLoop).toBe(true)
      expect(result.count).toBe(3)
    })

    it("does not detect loop with different tools", () => {
      recordToolCall(state, "search")
      recordToolCall(state, "read")
      recordToolCall(state, "search")

      const result = detectToolLoop(state, "search")
      expect(result.isLoop).toBe(false)
    })

    it("does not detect loop with only 2 same calls", () => {
      recordToolCall(state, "search")
      recordToolCall(state, "search")

      const result = detectToolLoop(state, "search")
      expect(result.isLoop).toBe(false)
    })
  })

  describe("Message Deduplication", () => {
    it("detects duplicate messages", () => {
      const msg = "Fix this bug"
      recordMessage(state, msg)
      recordMessage(state, msg)

      const result = detectMessageDedup(state, msg)
      expect(result.isDuplicate).toBe(true)
      expect(result.count).toBeGreaterThanOrEqual(2)
    })

    it("does not flag first occurrence", () => {
      const msg = "Fix this bug"
      const result = detectMessageDedup(state, msg)
      expect(result.isDuplicate).toBe(false)
    })

    it("handles different messages", () => {
      recordMessage(state, "Message 1")
      recordMessage(state, "Message 2")

      const result = detectMessageDedup(state, "Message 3")
      expect(result.isDuplicate).toBe(false)
    })
  })

  describe("Rate Limiting", () => {
    it("tracks tool calls within time window", () => {
      // Record multiple calls (history is capped at 50)
      for (let i = 0; i < 60; i++) {
        recordToolCall(state, `tool_${i}`)
      }

      // Verify they're kept (but capped at 50)
      expect(state.toolCallHistory.length).toBe(50)
    })

    it("allows normal rate of calls", () => {
      recordToolCall(state, "search")
      recordToolCall(state, "read")

      expect(state.toolCallHistory.length).toBe(2)
    })
  })

  describe("Nesting Depth", () => {
    it("detects excessive nesting", () => {
      const result = detectDeepNesting(20)
      expect(result.isTooDeep).toBe(true)
    })

    it("allows reasonable nesting depth", () => {
      const result = detectDeepNesting(5)
      expect(result.isTooDeep).toBe(false)
    })
  })

  describe("Failure Tracking", () => {
    it("counts consecutive failures", () => {
      recordFailure(state)
      recordFailure(state)
      recordFailure(state)

      const result = getTooManyFailures(state)
      expect(result.count).toBe(3)
      expect(result.tooMany).toBe(false)
    })

    it("detects too many failures", () => {
      for (let i = 0; i < 6; i++) {
        recordFailure(state)
      }

      const result = getTooManyFailures(state)
      expect(result.tooMany).toBe(true)
    })

    it("resets on success", () => {
      recordFailure(state)
      recordFailure(state)
      recordSuccess(state)

      const result = getTooManyFailures(state)
      expect(result.count).toBe(0)
    })
  })

  describe("Comprehensive Validation", () => {
    it("returns no issues for normal operation", () => {
      recordToolCall(state, "search")
      recordMessage(state, "Fix this")
      recordMessage(state, "Fix this") // Record it twice so state tracks it

      const issues = validate(state, "search", "Other message", 2)
      expect(issues.length).toBe(0)
    })

    it("detects multiple issues", () => {
      // Create tool loop
      recordToolCall(state, "search")
      recordToolCall(state, "search")
      recordToolCall(state, "search")

      // Create message duplication
      const msg = "Repeat"
      recordMessage(state, msg)
      recordMessage(state, msg)

      // Create failures
      for (let i = 0; i < 6; i++) {
        recordFailure(state)
      }

      const issues = validate(state, "search", msg, 5)
      expect(issues.length).toBeGreaterThan(1)
    })

    it("formats validation output", () => {
      const issues = ["Tool loop detected", "Rate limit exceeded"]
      const formatted = formatValidation(issues)
      expect(formatted).toContain("Guardrail Warnings")
      expect(formatted).toContain("Tool loop detected")
      expect(formatted).toContain("Rate limit exceeded")
    })

    it("returns empty format for no issues", () => {
      const formatted = formatValidation([])
      expect(formatted).toBe("")
    })
  })

  describe("State Management", () => {
    it("limits tool call history size", () => {
      for (let i = 0; i < 100; i++) {
        recordToolCall(state, `tool_${i}`)
      }

      expect(state.toolCallHistory.length).toBeLessThanOrEqual(50)
    })

    it("limits recent messages size", () => {
      for (let i = 0; i < 20; i++) {
        recordMessage(state, `message ${i}`)
      }

      expect(state.recentMessages.length).toBeLessThanOrEqual(10)
    })
  })
})
