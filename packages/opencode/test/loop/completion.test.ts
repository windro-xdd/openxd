import { test, expect, describe } from "bun:test"

// Test the completion detection heuristic (extracted logic)
function looksComplete(text: string): boolean {
  if (!text || text.length < 20) return false

  const doneSignals = [
    /\ball\s+(changes|tasks|steps|items|issues|errors|warnings)\s+(are\s+)?(now\s+)?(done|complete|finished|fixed|resolved)/i,
    /\btask\s+(is\s+)?(now\s+)?(done|complete|finished)/i,
    /\bsuccessfully\s+(completed|implemented|fixed|resolved|applied)/i,
    /\beverything\s+(is\s+)?(now\s+)?(done|ready|in\s+place|complete)/i,
    /\blet\s+me\s+know\s+if\s+(you\s+)?(need|want|have)/i,
    /\bimplementation\s+is\s+(now\s+)?(complete|done|finished)/i,
    /\ball\s+\d+\s+(issues|errors|warnings|problems)\s+(have\s+been\s+|are\s+)?(fixed|resolved)/i,
  ]

  const hasDoneSignal = doneSignals.some((pattern) => pattern.test(text))
  if (!hasDoneSignal) return false

  const notDoneSignals = [
    /\bnext\s+(step|I'll|I\s+will|we\s+need)/i,
    /\bstill\s+need\s+to/i,
    /\bremaining\s+(tasks|steps|issues)/i,
    /\btodo:/i,
    /\bnow\s+(let's|I'll|I\s+will)\s+(move|proceed|continue)/i,
  ]

  const hasNotDone = notDoneSignals.some((pattern) => pattern.test(text))
  return !hasNotDone
}

describe("completion detection", () => {
  test("detects 'all tasks are done'", () => {
    expect(looksComplete("All tasks are done. The refactoring is complete.")).toBe(true)
  })

  test("detects 'successfully implemented'", () => {
    expect(looksComplete("I've successfully implemented the authentication module.")).toBe(true)
  })

  test("detects 'let me know if you need'", () => {
    expect(looksComplete("The changes are applied. Let me know if you need anything else.")).toBe(true)
  })

  test("detects 'everything is done'", () => {
    expect(looksComplete("Everything is done and working correctly now.")).toBe(true)
  })

  test("detects 'all 5 errors are fixed'", () => {
    expect(looksComplete("All 5 errors are fixed and tests pass now.")).toBe(true)
  })

  test("rejects when 'next step' present", () => {
    expect(looksComplete("Task is done. Next step is to deploy the changes.")).toBe(false)
  })

  test("rejects when 'still need to' present", () => {
    expect(looksComplete("Successfully implemented the API. Still need to add tests.")).toBe(false)
  })

  test("rejects when 'remaining tasks' present", () => {
    expect(looksComplete("All changes are done. Remaining tasks include documentation.")).toBe(false)
  })

  test("rejects short text", () => {
    expect(looksComplete("Done.")).toBe(false)
  })

  test("rejects empty text", () => {
    expect(looksComplete("")).toBe(false)
  })

  test("rejects no done signal", () => {
    expect(looksComplete("I've made some changes to the file and updated the function signature.")).toBe(false)
  })
})
