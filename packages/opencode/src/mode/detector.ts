import type { ModeTypes } from "./types"

/**
 * Detect mode keywords from user input.
 *
 * `ultrawork` / `ulw` can appear anywhere in the message.
 * Other mode keywords must be the first word to avoid false positives
 * (e.g., "analyze this code" triggers analyze, but "can you analyze" does not).
 */

const MODE_PATTERNS: Record<string, RegExp> = {
  ultrawork: /\b(ultrawork|ulw)\b/i,
  build: /^(build|gsd)\b/i,
  search: /^(search|research)\b/i,
  analyze: /^(analyze|analysis)\b/i,
  plan: /^(plan|planning)\b/i,
}

export function detectMode(text: string): ModeTypes.DetectionResult | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined

  // ultrawork can appear anywhere
  if (MODE_PATTERNS.ultrawork.test(trimmed)) {
    const cleanText = trimmed.replace(MODE_PATTERNS.ultrawork, "").replace(/\s+/g, " ").trim()
    return { mode: "ultrawork", cleanText }
  }

  // Other modes: must be the first word
  const firstWord = trimmed.split(/\s+/)[0]
  for (const [name, pattern] of Object.entries(MODE_PATTERNS)) {
    if (name === "ultrawork") continue
    if (pattern.test(firstWord)) {
      const cleanText = trimmed.replace(pattern, "").replace(/\s+/g, " ").trim()
      return { mode: name, cleanText }
    }
  }

  return undefined
}
