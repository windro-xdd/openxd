import { test, expect, describe } from "bun:test"
import { detectMode } from "../../src/mode/detector"

describe("mode detector", () => {
  test("detects ultrawork anywhere in message", () => {
    const result = detectMode("ultrawork fix all lint errors")
    expect(result).toEqual({ mode: "ultrawork", cleanText: "fix all lint errors" })
  })

  test("detects ultrawork mid-sentence", () => {
    const result = detectMode("please ultrawork on this task")
    expect(result).toEqual({ mode: "ultrawork", cleanText: "please on this task" })
  })

  test("detects ulw shorthand", () => {
    const result = detectMode("ulw refactor the auth module")
    expect(result).toEqual({ mode: "ultrawork", cleanText: "refactor the auth module" })
  })

  test("detects search at start", () => {
    const result = detectMode("search how does auth work")
    expect(result).toEqual({ mode: "search", cleanText: "how does auth work" })
  })

  test("does not detect search mid-sentence", () => {
    const result = detectMode("can you search for this")
    expect(result).toBeUndefined()
  })

  test("detects analyze at start", () => {
    const result = detectMode("analyze the performance bottlenecks")
    expect(result).toEqual({ mode: "analyze", cleanText: "the performance bottlenecks" })
  })

  test("detects analysis at start", () => {
    const result = detectMode("analysis of the API layer")
    expect(result).toEqual({ mode: "analyze", cleanText: "of the API layer" })
  })

  test("does not detect analyze mid-sentence", () => {
    const result = detectMode("can you analyze this code")
    expect(result).toBeUndefined()
  })

  test("detects plan at start", () => {
    const result = detectMode("plan implement user notifications")
    expect(result).toEqual({ mode: "plan", cleanText: "implement user notifications" })
  })

  test("does not detect plan mid-sentence", () => {
    const result = detectMode("what is the plan for this")
    expect(result).toBeUndefined()
  })

  test("returns undefined for no mode keyword", () => {
    const result = detectMode("fix the login page")
    expect(result).toBeUndefined()
  })

  test("returns undefined for empty string", () => {
    const result = detectMode("")
    expect(result).toBeUndefined()
  })

  test("case insensitive", () => {
    const result = detectMode("ULTRAWORK fix everything")
    expect(result).toEqual({ mode: "ultrawork", cleanText: "fix everything" })
  })

  test("trims whitespace", () => {
    const result = detectMode("  ultrawork  fix stuff  ")
    expect(result).toEqual({ mode: "ultrawork", cleanText: "fix stuff" })
  })

  test("ultrawork takes priority over other keywords", () => {
    // ultrawork is checked first regardless of position
    const result = detectMode("search ultrawork for bugs")
    // search is at start but ultrawork matches anywhere-first
    expect(result?.mode).toBe("ultrawork")
  })
})
