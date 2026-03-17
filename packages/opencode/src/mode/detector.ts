import type { ModeTypes } from "./types"

/**
 * Detect mode keywords from user input.
 *
 * `ultrawork` / `ulw` can appear anywhere in the message.
 * Other mode keywords must be the first word to avoid false positives
 * (e.g., "analyze this code" triggers analyze, but "can you analyze" does not).
 */

const MODE_ALIASES: Record<string, string[]> = {
  ultrawork: ["ultrawork", "ulw"],
  build: ["build", "gsd"],
  search: ["search", "research"],
  analyze: ["analyze", "analysis"],
  plan: ["plan", "planning"],
}

const MODE_PATTERNS: Record<string, RegExp> = {
  ultrawork: /\b\/?(ultrawork|ulw)\b/i,
  build: /^\/?(build|gsd)\b/i,
  search: /^\/?(search|research)\b/i,
  analyze: /^\/?(analyze|analysis)\b/i,
  plan: /^\/?(plan|planning)\b/i,
}

function clean(text: string, mode: string) {
  const next = MODE_ALIASES[mode].reduce((acc, alias) => {
    return acc.replace(new RegExp(`/${alias}\\b`, "gi"), "").replace(new RegExp(`\\b${alias}\\b`, "gi"), "")
  }, text)
  return next.replace(/^\//, "").replace(/\s+/g, " ").trim()
}

export function detectMode(text: string): ModeTypes.DetectionResult | undefined {
  const trimmed = text.trim()
  if (!trimmed) return undefined

  // ultrawork can appear anywhere
  if (MODE_PATTERNS.ultrawork.test(trimmed)) {
    const cleanText = clean(trimmed, "ultrawork")
    return { mode: "ultrawork", cleanText }
  }

  // Other modes: must be the first word
  const words = trimmed.split(/\s+/)
  const firstWord = words[0] === "/" ? `${words[0]}${words[1] ?? ""}` : words[0]
  for (const [name, pattern] of Object.entries(MODE_PATTERNS)) {
    if (name === "ultrawork") continue
    if (pattern.test(firstWord)) {
      const cleanText = clean(trimmed, name)
      return { mode: name, cleanText }
    }
  }

  return undefined
}
