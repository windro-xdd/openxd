import path from "path"
import { Instance } from "@/project/instance"
import { KnowledgeSync } from "@/knowledge/service"

const RULES = [
  /\bwrong\b/i,
  /\bnot what i/i,
  /\bnot right\b/i,
  /\bincorrect\b/i,
  /\byou missed\b/i,
  /\byou forgot\b/i,
  /\bstill not\b/i,
  /\bthat('s| is) not\b/i,
  /\bi (said|told you|already|mentioned)\b/i,
  /\brevert\b/i,
  /\bundo\b/i,
  /\bthat broke\b/i,
  /\bwhy did you\b/i,
  /\bnope\b/i,
]

const NO_QUESTION = /^no\s+(what|how|why|when|where|which|can|could|should|do|does|is|are)\b/i

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "then",
  "from",
  "into",
  "when",
  "what",
  "where",
  "which",
  "while",
  "after",
  "before",
  "have",
  "has",
  "had",
  "was",
  "were",
  "will",
  "would",
  "should",
  "could",
  "about",
  "just",
  "more",
  "very",
  "than",
])

const SYN: Record<string, string> = {
  bug: "error",
  bugs: "error",
  wrong: "error",
  incorrect: "error",
  failed: "fail",
  failing: "fail",
  failure: "fail",
  broken: "break",
  broke: "break",
  fixing: "fix",
  fixed: "fix",
  tests: "test",
  testing: "test",
  verify: "verification",
  verified: "verification",
  validating: "verification",
  validation: "verification",
  auth: "authentication",
  token: "authentication",
  cookies: "authentication",
  csp: "security",
  xss: "security",
  cors: "security",
  release: "deploy",
  shipping: "deploy",
  deployed: "deploy",
  stale: "old",
  older: "old",
  old: "old",
  rebuild: "build",
  rebuilt: "build",
  binaries: "artifact",
  binary: "artifact",
  artifact: "artifact",
  artifacts: "artifact",
  commit: "commit",
  editing: "edit",
  edits: "edit",
}

const RISK = new Set(["bash", "edit", "write", "apply_patch", "batch_edit", "task", "supervisor"])

type Entry = {
  wrong: string
  right: string
  rule: string
  raw: string
  key: string
}

type Match = {
  item: Entry
  score: number
}

type Stat = {
  total: number
  repeats: number
  map: Record<string, number>
  seen: Record<string, true>
  last?: Match
}

function words(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, " ")
    .split(/\s+/)
    .map((x) => stem(SYN[x] ?? x))
    .filter((x) => x.length > 2 && !STOP.has(x))
}

function stem(text: string) {
  if (text.endsWith("ies") && text.length > 4) return text.slice(0, -3) + "y"
  if (text.endsWith("ing") && text.length > 5) return text.slice(0, -3)
  if (text.endsWith("ed") && text.length > 4) return text.slice(0, -2)
  if (text.endsWith("es") && text.length > 4) return text.slice(0, -2)
  if (text.endsWith("s") && text.length > 3) return text.slice(0, -1)
  return text
}

function trigrams(text: string) {
  const v = ` ${text.replace(/\s+/g, " ").trim()} `
  const out: string[] = []
  for (let i = 0; i < v.length - 2; i++) out.push(v.slice(i, i + 3))
  return out
}

function dice(a: string, b: string) {
  const x = trigrams(a)
  const y = trigrams(b)
  if (!x.length || !y.length) return 0
  const m = new Map<string, number>()
  for (const item of x) m.set(item, (m.get(item) ?? 0) + 1)
  let hit = 0
  for (const item of y) {
    const n = m.get(item) ?? 0
    if (!n) continue
    m.set(item, n - 1)
    hit++
  }
  return (2 * hit) / (x.length + y.length)
}

function jaccard(a: string[], b: string[]) {
  const x = new Set(a)
  const y = new Set(b)
  if (!x.size || !y.size) return 0
  let hit = 0
  for (const item of x) {
    if (y.has(item)) hit++
  }
  return hit / (x.size + y.size - hit)
}

function one(raw: string) {
  const text = raw.replaceAll("\n", " ").replace(/\s+/g, " ").trim()
  if (text.length <= 360) return text
  return text.slice(0, 360).trimEnd() + "..."
}

function parse(raw: string) {
  const src = raw.replaceAll("\r\n", "\n")
  const rgx = /WRONG:\s*([\s\S]*?)\nRIGHT:\s*([\s\S]*?)\nRULE:\s*([\s\S]*?)(?=\n###\s+\d{4}-\d{2}-\d{2}|\nWRONG:|$)/gim
  const out: Entry[] = []
  while (true) {
    const m = rgx.exec(src)
    if (!m) break
    const wrong = m[1].trim()
    const right = m[2].trim()
    const rule = m[3].trim()
    if (!wrong || !right || !rule) continue
    const raw = [`WRONG: ${wrong}`, `RIGHT: ${right}`, `RULE: ${rule}`].join("\n")
    out.push({
      wrong,
      right,
      rule,
      raw,
      key: `${wrong}\n${rule}`.toLowerCase().replace(/\s+/g, " "),
    })
  }
  return out
}

function score(query: string, item: Entry) {
  const left = words(query)
  const right = words(`${item.wrong}\n${item.right}\n${item.rule}`)
  const a = jaccard(left, right)
  const b = dice(query.toLowerCase(), item.raw.toLowerCase())
  const c = dice(left.join(" "), right.join(" "))
  return a * 0.7 + b * 0.15 + c * 0.15
}

function lessons() {
  const docs = KnowledgeSync.list_documents({ kind: "memory" })
  const pref = [
    path.resolve(Instance.directory, ".opencode", "LESSONS.md"),
    path.resolve(Instance.directory, "LESSONS.md"),
  ]
  const doc = docs.find((x) => pref.includes(path.resolve(x.path))) ?? docs.find((x) => path.basename(x.path) === "LESSONS.md")
  if (!doc?.raw?.trim()) return []
  return parse(doc.raw)
}

const state = Instance.state(() => ({
  stats: {} as Record<string, Stat>,
}))

export function detectCorrection(text: string) {
  const v = text.toLowerCase().trim()
  if (!v) return false
  if (v.length > 500) return false
  if (v === "no") return true
  if (NO_QUESTION.test(v)) return false
  if (/^no[,.!\s]/i.test(v)) return true
  return RULES.some((r) => r.test(v))
}

export function relevantLessons(input: { query: string; max?: number }) {
  const max = input.max ?? 3
  return matches(input.query, max).map((x) => one(x.item.raw))
}

export function matches(query: string, max = 3) {
  const ranked = lessons()
    .map((item) => ({ item, score: score(query, item) }))
    .filter((x) => x.score >= 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
  return ranked
}

export function assessLesson(input: { content: string; existing?: string }) {
  const content = input.content.trim()
  const wrong = content.match(/(^|\n)\s*WRONG\s*:\s*([\s\S]*?)(?=\n\s*RIGHT\s*:|$)/i)?.[2]?.trim() ?? ""
  const right = content.match(/(^|\n)\s*RIGHT\s*:\s*([\s\S]*?)(?=\n\s*RULE\s*:|$)/i)?.[2]?.trim() ?? ""
  const rule = content.match(/(^|\n)\s*RULE\s*:\s*([\s\S]*?)$/i)?.[2]?.trim() ?? ""
  if (!wrong || !right || !rule) {
    return {
      ok: false,
      reason: "Lesson format invalid. Use:\nWRONG: ...\nRIGHT: ...\nRULE: ...",
    }
  }
  if (wrong.length < 12 || right.length < 12 || rule.length < 10) {
    return {
      ok: false,
      reason: "Lesson quality too low. Provide specific WRONG/RIGHT/RULE with concrete details.",
    }
  }
  const low = rule.toLowerCase()
  if (low.includes("be careful") || low.includes("do better") || low.includes("be more careful")) {
    return {
      ok: false,
      reason: "Lesson quality too generic. RULE must be concrete and testable.",
    }
  }
  const block = [`WRONG: ${wrong}`, `RIGHT: ${right}`, `RULE: ${rule}`].join("\n")
  const set = input.existing ? parse(input.existing) : []
  const dup = set
    .map((item) => ({ item, score: score(block, item) }))
    .sort((a, b) => b.score - a.score)[0]
  if (dup && dup.score >= 0.6) {
    return {
      ok: false,
      reason: "Duplicate lesson detected. Existing lesson already covers this mistake.",
      duplicate: one(dup.item.raw),
    }
  }
  return {
    ok: true,
    normalized: block,
  }
}

export namespace LessonGuard {
  export async function observe(input: { sessionID: string; text: string }) {
    const s = await state()
    const cur = s.stats[input.sessionID] ?? { total: 0, repeats: 0, map: {}, seen: {} }
    cur.total += 1
    const top = matches(input.text, 1)[0]
    if (top && top.score >= 0.12) {
      cur.last = top
      cur.map[top.item.key] = (cur.map[top.item.key] ?? 0) + 1
      if (cur.seen[top.item.key]) cur.repeats += 1
      cur.seen[top.item.key] = true
    }
    s.stats[input.sessionID] = cur
    return {
      total: cur.total,
      repeats: cur.repeats,
      rate: cur.total ? Number((cur.repeats / cur.total).toFixed(3)) : 0,
    }
  }

  export async function seed(input: { sessionID: string; text: string }) {
    const s = await state()
    const cur = s.stats[input.sessionID] ?? { total: 0, repeats: 0, map: {}, seen: {} }
    const top = matches(input.text, 1)[0]
    if (!top || top.score < 0.12) {
      s.stats[input.sessionID] = cur
      return
    }
    cur.last = top
    cur.map[top.item.key] = (cur.map[top.item.key] ?? 0) + 1
    cur.seen[top.item.key] = true
    s.stats[input.sessionID] = cur
  }

  export async function stats(sessionID: string) {
    const s = await state()
    const cur = s.stats[sessionID] ?? { total: 0, repeats: 0, map: {}, seen: {} }
    return {
      total: cur.total,
      repeats: cur.repeats,
      rate: cur.total ? Number((cur.repeats / cur.total).toFixed(3)) : 0,
    }
  }

  export async function block(input: { sessionID: string; tool: string; args: unknown }) {
    if (!RISK.has(input.tool)) return
    const s = await state()
    const cur = s.stats[input.sessionID]
    if (!cur?.last) return
    if (cur.repeats < 1) return
    const text = `${input.tool}\n${JSON.stringify(input.args ?? {})}`
    const sc = score(text, cur.last.item)
    if (sc < 0.25) return
    return {
      score: Number(sc.toFixed(3)),
      rule: cur.last.item.rule,
      lesson: one(cur.last.item.raw),
    }
  }
}

export function __resetLessonGuardForTests() {
  const s = state()
  s.stats = {}
}
