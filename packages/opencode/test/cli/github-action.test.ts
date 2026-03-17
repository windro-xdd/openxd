import { test, expect, describe } from "bun:test"
import { extractResponseText, formatPromptTooLargeError } from "../../src/cli/cmd/github"
import type { MessageV2 } from "../../src/session/message-v2"
import {
  getEventFlags,
  getUserPrompt,
  getIssueId,
  getTriggerCommentId,
  getCommentType,
} from "../../src/cli/cmd/github/prompt"
import type { Context } from "@actions/github/lib/context"

// Helper to create minimal valid parts
function createTextPart(text: string): MessageV2.Part {
  return {
    id: "1",
    sessionID: "s",
    messageID: "m",
    type: "text" as const,
    text,
  }
}

function createReasoningPart(text: string): MessageV2.Part {
  return {
    id: "1",
    sessionID: "s",
    messageID: "m",
    type: "reasoning" as const,
    text,
    time: { start: 0 },
  }
}

function createToolPart(tool: string, title: string, status: "completed" | "running" = "completed"): MessageV2.Part {
  if (status === "completed") {
    return {
      id: "1",
      sessionID: "s",
      messageID: "m",
      type: "tool" as const,
      callID: "c1",
      tool,
      state: {
        status: "completed",
        input: {},
        output: "",
        title,
        metadata: {},
        time: { start: 0, end: 1 },
      },
    }
  }
  return {
    id: "1",
    sessionID: "s",
    messageID: "m",
    type: "tool" as const,
    callID: "c1",
    tool,
    state: {
      status: "running",
      input: {},
      time: { start: 0 },
    },
  }
}

function createStepStartPart(): MessageV2.Part {
  return {
    id: "1",
    sessionID: "s",
    messageID: "m",
    type: "step-start" as const,
  }
}

function createStepFinishPart(): MessageV2.Part {
  return {
    id: "1",
    sessionID: "s",
    messageID: "m",
    type: "step-finish" as const,
    reason: "done",
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
}

describe("extractResponseText", () => {
  test("returns text from text part", () => {
    const parts = [createTextPart("Hello world")]
    expect(extractResponseText(parts)).toBe("Hello world")
  })

  test("returns last text part when multiple exist", () => {
    const parts = [createTextPart("First"), createTextPart("Last")]
    expect(extractResponseText(parts)).toBe("Last")
  })

  test("returns text even when tool parts follow", () => {
    const parts = [createTextPart("I'll help with that."), createToolPart("todowrite", "3 todos")]
    expect(extractResponseText(parts)).toBe("I'll help with that.")
  })

  test("returns null for reasoning-only response (signals summary needed)", () => {
    const parts = [createReasoningPart("Let me think about this...")]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("returns null for tool-only response (signals summary needed)", () => {
    // This is the exact scenario from the bug report - todowrite with no text
    const parts = [createToolPart("todowrite", "8 todos")]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("returns null for multiple completed tools", () => {
    const parts = [
      createToolPart("read", "src/file.ts"),
      createToolPart("edit", "src/file.ts"),
      createToolPart("bash", "bun test"),
    ]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("returns null for running tool parts (signals summary needed)", () => {
    const parts = [createToolPart("bash", "", "running")]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("throws on empty array", () => {
    expect(() => extractResponseText([])).toThrow("no parts returned")
  })

  test("returns null for step-start only", () => {
    const parts = [createStepStartPart()]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("returns null for step-finish only", () => {
    const parts = [createStepFinishPart()]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("returns null for step-start and step-finish", () => {
    const parts = [createStepStartPart(), createStepFinishPart()]
    expect(extractResponseText(parts)).toBeNull()
  })

  test("returns text from multi-step response", () => {
    const parts = [
      createStepStartPart(),
      createToolPart("read", "src/file.ts"),
      createTextPart("Done"),
      createStepFinishPart(),
    ]
    expect(extractResponseText(parts)).toBe("Done")
  })

  test("prefers text over reasoning when both present", () => {
    const parts = [createReasoningPart("Internal thinking..."), createTextPart("Final answer")]
    expect(extractResponseText(parts)).toBe("Final answer")
  })

  test("prefers text over tools when both present", () => {
    const parts = [createToolPart("read", "src/file.ts"), createTextPart("Here's what I found")]
    expect(extractResponseText(parts)).toBe("Here's what I found")
  })
})

describe("formatPromptTooLargeError", () => {
  test("formats error without files", () => {
    const result = formatPromptTooLargeError([])
    expect(result).toBe("PROMPT_TOO_LARGE: The prompt exceeds the model's context limit.")
  })

  test("formats error with files (base64 content)", () => {
    // Base64 is ~33% larger than original, so we multiply by 0.75 to get original size
    // 400 KB base64 = 300 KB original, 200 KB base64 = 150 KB original
    const files = [
      { filename: "screenshot.png", content: "a".repeat(400 * 1024) },
      { filename: "diagram.png", content: "b".repeat(200 * 1024) },
    ]
    const result = formatPromptTooLargeError(files)

    expect(result).toStartWith("PROMPT_TOO_LARGE: The prompt exceeds the model's context limit.")
    expect(result).toInclude("Files in prompt:")
    expect(result).toInclude("screenshot.png (300 KB)")
    expect(result).toInclude("diagram.png (150 KB)")
  })

  test("lists all files when multiple present", () => {
    // Base64 sizes: 4KB -> 3KB, 8KB -> 6KB, 12KB -> 9KB
    const files = [
      { filename: "img1.png", content: "x".repeat(4 * 1024) },
      { filename: "img2.jpg", content: "y".repeat(8 * 1024) },
      { filename: "img3.gif", content: "z".repeat(12 * 1024) },
    ]
    const result = formatPromptTooLargeError(files)

    expect(result).toInclude("img1.png (3 KB)")
    expect(result).toInclude("img2.jpg (6 KB)")
    expect(result).toInclude("img3.gif (9 KB)")
  })
})

describe("github.prompt event routing", () => {
  function context(eventName: string): Context {
    return {
      eventName,
    } as Context
  }

  test("getEventFlags marks comment event as user event", () => {
    const flags = getEventFlags(context("issue_comment"))
    expect(flags.isUserEvent).toBe(true)
    expect(flags.isCommentEvent).toBe(true)
    expect(flags.isRepoEvent).toBe(false)
    expect(flags.isIssuesEvent).toBe(false)
  })

  test("getEventFlags marks schedule event as repo event", () => {
    const flags = getEventFlags(context("schedule"))
    expect(flags.isRepoEvent).toBe(true)
    expect(flags.isScheduleEvent).toBe(true)
    expect(flags.isUserEvent).toBe(false)
    expect(flags.isCommentEvent).toBe(false)
  })

  test("getIssueId resolves issue number for issue_comment payload", () => {
    const id = getIssueId({
      context: context("issue_comment"),
      payload: {
        issue: { number: 42 },
      } as any,
      isRepoEvent: false,
    })
    expect(id).toBe(42)
  })

  test("getIssueId resolves pull request number for review comment payload", () => {
    const id = getIssueId({
      context: context("pull_request_review_comment"),
      payload: {
        pull_request: { number: 77 },
      } as any,
      isRepoEvent: false,
    })
    expect(id).toBe(77)
  })

  test("getIssueId returns undefined for repo events", () => {
    const id = getIssueId({
      context: context("schedule"),
      payload: {} as any,
      isRepoEvent: true,
    })
    expect(id).toBeUndefined()
  })

  test("getTriggerCommentId returns comment id only for comment events", () => {
    const comment = getTriggerCommentId({
      payload: { comment: { id: 99 } } as any,
      isCommentEvent: true,
    })
    expect(comment).toBe(99)

    const none = getTriggerCommentId({
      payload: { comment: { id: 100 } } as any,
      isCommentEvent: false,
    })
    expect(none).toBeUndefined()
  })

  test("getCommentType routes review comments to pr_review", () => {
    expect(getCommentType({ context: context("pull_request_review_comment"), isCommentEvent: true })).toBe("pr_review")
    expect(getCommentType({ context: context("issue_comment"), isCommentEvent: true })).toBe("issue")
    expect(getCommentType({ context: context("schedule"), isCommentEvent: false })).toBeUndefined()
  })

  test("getUserPrompt extracts attachment markdown into prompt files", async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(Uint8Array.from([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "image/png" },
      })) as unknown as typeof fetch

    try {
      const result = await getUserPrompt({
        context: context("issue_comment"),
        payload: {
          comment: {
            body: "Please /oc review this image ![shot](https://github.com/user-attachments/files/example.png)",
            id: 1,
          },
        } as any,
        isRepoEvent: false,
        isIssuesEvent: false,
        isCommentEvent: true,
        appToken: "test-token",
      })

      expect(result.userPrompt).toContain("@example.png")
      expect(result.userPrompt).not.toContain("https://github.com/user-attachments/")
      expect(result.promptFiles.length).toBe(1)
      expect(result.promptFiles[0].filename).toBe("example.png")
      expect(result.promptFiles[0].mime).toBe("image/png")
      expect(result.promptFiles[0].content.length).toBeGreaterThan(0)
      expect(result.promptFiles[0].replacement).toBe("@example.png")
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
