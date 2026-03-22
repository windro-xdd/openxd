import { Hash } from "@/util/hash"

export type Chunk = {
  ordinal: number
  heading: string | null
  raw: string
  raw_hash: string
  tokens: number
  start_line: number
  end_line: number
}

const MAX = 1800

function words(input: string) {
  const list = input.trim().split(/\s+/).filter(Boolean)
  return list.length
}

function split(section: { heading: string | null; lines: string[]; start: number; end: number }) {
  const text = section.lines.join("\n").trim()
  if (!text) return [] as Chunk[]
  if (text.length <= MAX) {
    return [
      {
        ordinal: 0,
        heading: section.heading,
        raw: text,
        raw_hash: Hash.fast(text),
        tokens: words(text),
        start_line: section.start,
        end_line: section.end,
      },
    ]
  }

  const out: Chunk[] = []
  const rows = text.split(/\n\n+/)
  let buf: string[] = []
  let len = 0
  let st = section.start
  let line = section.start
  for (const row of rows) {
    const size = row.length + (buf.length ? 2 : 0)
    if (buf.length && len + size > MAX) {
      const raw = buf.join("\n\n").trim()
      out.push({
        ordinal: 0,
        heading: section.heading,
        raw,
        raw_hash: Hash.fast(raw),
        tokens: words(raw),
        start_line: st,
        end_line: Math.max(st, line - 1),
      })
      st = line
      buf = []
      len = 0
    }
    buf.push(row)
    len += size
    line += row.split(/\n/).length + 1
  }

  if (buf.length) {
    const raw = buf.join("\n\n").trim()
    out.push({
      ordinal: 0,
      heading: section.heading,
      raw,
      raw_hash: Hash.fast(raw),
      tokens: words(raw),
      start_line: st,
      end_line: Math.max(st, section.end),
    })
  }

  return out
}

export function chunks(raw: string) {
  const rows = raw.split(/\r?\n/)
  const parts: { heading: string | null; lines: string[]; start: number; end: number }[] = []
  let head: string | null = null
  let buf: string[] = []
  let start = 1
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const h = /^#{1,6}\s+(.+)$/.exec(row)
    if (h && buf.length) {
      parts.push({
        heading: head,
        lines: buf,
        start,
        end: i,
      })
      buf = [row]
      head = h[1].trim()
      start = i + 1
      continue
    }
    if (h) head = h[1].trim()
    buf.push(row)
  }

  if (buf.length) {
    parts.push({
      heading: head,
      lines: buf,
      start,
      end: rows.length,
    })
  }

  const out = parts.flatMap(split)
  return out.map((item, i) => ({ ...item, ordinal: i }))
}
