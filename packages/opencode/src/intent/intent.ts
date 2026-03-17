/**
 * Intent Detection System
 *
 * Detects user intent from message text and provides contextual hints.
 * This complements the Mode system:
 * - Modes: Explicit activation via keywords ("search", "plan", "ultrawork")
 * - Intents: Implicit detection from natural language patterns
 *
 * When a strong intent is detected but no explicit mode was used,
 * we inject subtle context hints to help the model respond appropriately.
 *
 * Intents map to behaviors:
 * - research → thorough investigation, multiple sources
 * - debug → root cause analysis, trace errors
 * - build → incremental implementation, TodoWrite usage
 * - refactor → preserve behavior, safe changes
 * - review → structured analysis, prioritized findings
 * - explain → clear teaching, examples
 * - test → coverage, edge cases
 */

export namespace Intent {
  export type Type = "research" | "debug" | "build" | "refactor" | "review" | "explain" | "test" | "chat" // Default - no special behavior

  export type Detection = {
    intent: Type
    confidence: number // 0-1
    signals: string[] // What triggered the detection
  }

  // Intent patterns with associated keywords/phrases
  const PATTERNS: Record<Exclude<Type, "chat">, { keywords: string[]; phrases: RegExp[] }> = {
    research: {
      keywords: [
        "research",
        "investigate",
        "find out",
        "look into",
        "explore",
        "discover",
        "learn about",
        "understand",
      ],
      phrases: [
        /what\s+(is|are|does|do)\s+.+\??/i,
        /how\s+(does|do|can|should)\s+.+\??/i,
        /why\s+(does|do|is|are)\s+.+\??/i,
        /tell\s+me\s+about/i,
        /search\s+(for|the\s+web)/i,
        /find\s+(information|out|resources)/i,
        /look\s+(up|into)/i,
      ],
    },
    debug: {
      keywords: ["debug", "fix", "error", "bug", "broken", "failing", "crash", "issue", "problem", "trace", "diagnose"],
      phrases: [
        /fix\s+(this|the|my)/i,
        /why\s+(is|does|isn't|doesn't)\s+.+\s+(work|fail|crash|error)/i,
        /not\s+working/i,
        /doesn't\s+work/i,
        /getting\s+(an?\s+)?error/i,
        /something\s+(is\s+)?(wrong|broken)/i,
        /what's\s+(wrong|broken|failing)/i,
        /help\s+me\s+(fix|debug|solve)/i,
      ],
    },
    build: {
      keywords: ["build", "create", "implement", "add", "make", "develop", "write", "generate", "new feature"],
      phrases: [
        /create\s+(a|an|the)/i,
        /build\s+(a|an|the|me)/i,
        /implement\s+(a|an|the)/i,
        /add\s+(a|an|the|new)/i,
        /make\s+(a|an|the|me)/i,
        /write\s+(a|an|the|me|code)/i,
        /i\s+want\s+(a|to\s+have)/i,
        /can\s+you\s+(create|build|make|add)/i,
      ],
    },
    refactor: {
      keywords: ["refactor", "clean", "improve", "optimize", "restructure", "reorganize", "simplify", "reduce"],
      phrases: [
        /refactor\s+(this|the|my)/i,
        /clean\s+(up|this|the)/i,
        /improve\s+(the|this|my)/i,
        /make\s+(this|it)\s+(cleaner|simpler|better|faster)/i,
        /simplify\s+(this|the)/i,
        /reduce\s+(complexity|duplication)/i,
        /too\s+(complex|messy|complicated)/i,
      ],
    },
    review: {
      keywords: ["review", "audit", "check", "analyze", "assess", "evaluate", "security", "vulnerability"],
      phrases: [
        /review\s+(this|the|my)/i,
        /check\s+(for|this|the|my)/i,
        /is\s+(this|my)\s+code\s+(good|secure|correct)/i,
        /any\s+(issues|problems|vulnerabilities)/i,
        /security\s+(audit|check|review)/i,
        /code\s+review/i,
        /look\s+over\s+(this|my)/i,
      ],
    },
    explain: {
      keywords: ["explain", "teach", "document", "describe", "clarify", "help me understand", "walk me through"],
      phrases: [
        /explain\s+(this|the|how|what|why)/i,
        /how\s+does\s+(this|it)\s+work/i,
        /what\s+does\s+(this|it)\s+(do|mean)/i,
        /can\s+you\s+explain/i,
        /walk\s+me\s+through/i,
        /help\s+me\s+understand/i,
        /teach\s+me/i,
        /document\s+(this|the)/i,
      ],
    },
    test: {
      keywords: ["test", "tests", "testing", "spec", "coverage", "unit test", "integration test", "verify"],
      phrases: [
        /write\s+(a\s+)?tests?\s+(for)?/i,
        /add\s+tests?\s+(for|to)/i,
        /test\s+(this|the|my)/i,
        /need\s+tests/i,
        /increase\s+coverage/i,
        /verify\s+(this|the|that)/i,
        /make\s+sure\s+(it|this)\s+works/i,
      ],
    },
  }

  // Intent-specific prompt augmentations
  const AUGMENTATIONS: Record<Exclude<Type, "chat">, string> = {
    research: `<intent-context type="research">
You detected a RESEARCH intent. The user wants thorough investigation.
- Use websearch to find relevant sources
- Cross-reference multiple sources
- Be comprehensive and cite your findings
- Summarize key insights clearly
- If uncertain, acknowledge limitations and suggest further investigation
</intent-context>`,

    debug: `<intent-context type="debug">
You detected a DEBUG intent. The user needs help fixing something.
- First understand the error/symptom fully
- Read relevant code before suggesting fixes
- Look for the ROOT CAUSE, not just symptoms
- Test your hypothesis before claiming a fix
- Explain what went wrong and why your fix works
- Consider edge cases that might cause similar issues
</intent-context>`,

    build: `<intent-context type="build">
You detected a BUILD intent. The user wants something created.
- Understand requirements before coding
- Use TodoWrite to plan multi-step work
- Follow existing patterns in the codebase
- Build incrementally, verify as you go
- Consider error handling and edge cases
- Ask clarifying questions if requirements are ambiguous
</intent-context>`,

    refactor: `<intent-context type="refactor">
You detected a REFACTOR intent. The user wants code improved.
- Understand the current code first
- Preserve existing behavior (no functional changes unless asked)
- Make incremental, safe changes
- Run tests/typecheck after changes
- Explain what you're improving and why
- Consider if refactoring is actually needed
</intent-context>`,

    review: `<intent-context type="review">
You detected a REVIEW intent. The user wants code analyzed.
- Read the code thoroughly before commenting
- Check for: bugs, security issues, performance, maintainability
- Be specific with feedback (file:line references)
- Prioritize findings (critical → minor)
- Suggest concrete improvements, not just problems
- Acknowledge what's done well
</intent-context>`,

    explain: `<intent-context type="explain">
You detected an EXPLAIN intent. The user wants to understand something.
- Start with a high-level overview
- Use analogies if helpful
- Break complex topics into digestible parts
- Include examples where appropriate
- Check if they want more depth on any aspect
- Point to documentation or resources for further learning
</intent-context>`,

    test: `<intent-context type="test">
You detected a TEST intent. The user wants testing help.
- Understand what behavior needs testing
- Follow existing test patterns in the codebase
- Cover happy path and edge cases
- Keep tests focused and independent
- Run tests to verify they pass
- Consider test maintainability
</intent-context>`,
  }

  /**
   * Detect intent from user message text.
   * Returns "chat" if no clear task intent is detected.
   */
  export function detect(text: string): Detection {
    const lower = text.toLowerCase()
    const scores: { intent: Exclude<Type, "chat">; score: number; signals: string[] }[] = []

    for (const [intent, { keywords, phrases }] of Object.entries(PATTERNS) as Array<
      [Exclude<Type, "chat">, { keywords: string[]; phrases: RegExp[] }]
    >) {
      let score = 0
      const signals: string[] = []

      // Check keywords
      for (const kw of keywords) {
        if (lower.includes(kw)) {
          score += 1
          signals.push(`keyword: ${kw}`)
        }
      }

      // Check phrases (stronger signal)
      for (const phrase of phrases) {
        if (phrase.test(text)) {
          score += 2
          signals.push(`phrase: ${phrase.source.slice(0, 30)}...`)
        }
      }

      if (score > 0) {
        scores.push({ intent, score, signals })
      }
    }

    // No intent detected
    if (scores.length === 0) {
      return { intent: "chat", confidence: 1, signals: [] }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score)
    const best = scores[0]

    // Confidence based on score and margin over second place
    const margin = scores.length > 1 ? best.score - scores[1].score : best.score
    const confidence = Math.min(1, best.score * 0.15 + margin * 0.1)

    // Only trigger if confidence is high enough (avoid false positives)
    if (confidence < 0.3) {
      return { intent: "chat", confidence: 1 - confidence, signals: best.signals }
    }

    return {
      intent: best.intent,
      confidence,
      signals: best.signals,
    }
  }

  /**
   * Get prompt augmentation for detected intent.
   * Returns undefined for "chat" intent (no augmentation needed).
   */
  export function getAugmentation(intent: Type): string | undefined {
    if (intent === "chat") return undefined
    return AUGMENTATIONS[intent]
  }

  /**
   * Detect and augment in one call.
   * Returns { detection, augmentation } where augmentation may be undefined.
   */
  export function process(text: string): { detection: Detection; augmentation?: string } {
    const detection = detect(text)
    const augmentation = getAugmentation(detection.intent)
    return { detection, augmentation }
  }
}
