import path from "path"
import { Bus } from "@/bus"
import { FileWatcher } from "@/file/watcher"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import { Hash } from "@/util/hash"
import { Log } from "@/util/log"
import { chunks } from "./chunk"
import { kind, list, source, type Kind } from "./paths"
import { KnowledgeRepo } from "./repo"

const log = Log.create({ service: "knowledge.sync" })
const TAG = "opencode:knowledge-sync"

function esc(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

type Mark = {
  version: number
  hash: string
  source: string
  time: number
}

type Read = {
  raw: string
  hash: string
  mark?: Mark
  time_source_updated?: number
}

function normalize(raw: string) {
  const text = raw.replaceAll("\r\n", "\n").replaceAll("\r", "\n").trimEnd()
  return text ? text + "\n" : ""
}

function marker(mark: Mark) {
  return `<!-- ${TAG} v=${mark.version} h=${mark.hash} s=${mark.source} t=${mark.time} -->`
}

function parse(raw: string) {
  const match = raw.match(
    new RegExp(`\\n?<!--\\s*${esc(TAG)}\\s+v=(\\d+)\\s+h=([a-f0-9]+)\\s+s=([^\\s]+)\\s+t=(\\d+)\\s*-->\\s*$`),
  )
  if (!match) return { body: raw, mark: undefined }
  return {
    body: raw.slice(0, match.index),
    mark: {
      version: Number(match[1]),
      hash: match[2],
      source: match[3],
      time: Number(match[4]),
    } satisfies Mark,
  }
}

async function read(file: string): Promise<Read | undefined> {
  const text = await Filesystem.readText(file).catch(() => undefined)
  if (typeof text !== "string") return
  const parsed = parse(text)
  const raw = normalize(parsed.body)
  const hash = Hash.fast(raw)
  const stat = Filesystem.stat(file)
  return {
    raw,
    hash,
    mark: parsed.mark,
    time_source_updated: Number(stat?.mtimeMs ?? Date.now()),
  }
}

function choose(input: {
  current: { version: number; source: string; time_source_updated: number | null }
  mark?: Mark
  incoming_source: string
  incoming_time?: number
}) {
  if (!input.mark) return "incoming" as const
  if (input.mark.version > input.current.version) return "incoming" as const
  if (input.mark.version < input.current.version) return "current" as const
  const a = input.mark.source
  const b = input.current.source
  if (a !== b) {
    if (a === "disk") return "incoming" as const
    if (b === "disk") return "current" as const
    if (a > b) return "incoming" as const
    return "current" as const
  }
  const t0 = input.mark.time || input.incoming_time || 0
  const t1 = input.current.time_source_updated || 0
  if (t0 >= t1) return "incoming" as const
  return "current" as const
}

export namespace KnowledgeSync {
  const state = Instance.state(
    async () => {
      const writes = new Map<string, { hash: string; until: number }>()

      const unsub = Bus.subscribe(FileWatcher.Event.Updated, async (evt) => {
        if (!evt.properties.file.endsWith(".md")) return
        const file = path.resolve(evt.properties.file)
        const k = kind(file)
        if (!k) return
        if (evt.properties.event === "unlink") {
          KnowledgeRepo.remove(file)
          writes.delete(file)
          return
        }
        await upsert_from_file(file, k)
      })

      return { writes, unsub }
    },
    async (s) => s.unsub?.(),
  )

  export async function init() {
    await state()
    const scan = await list()
    await Promise.all(scan.map((item) => upsert_from_file(item.path, item.kind)))
  }

  export async function upsert_from_file(file: string, kindHint?: Kind) {
    const full = path.resolve(file)
    const k = kindHint ?? kind(full)
    if (!k) return

    const exists = await Filesystem.exists(full)
    if (!exists) {
      KnowledgeRepo.remove(full)
      const s = await state()
      s.writes.delete(full)
      return
    }

    const input = await read(full)
    if (!input) return

    const s = await state()
    const self = s.writes.get(full)
    if (self && Date.now() <= self.until && self.hash === input.hash) {
      return
    }
    if (self && Date.now() > self.until) {
      s.writes.delete(full)
    }

    const cur = KnowledgeRepo.get(full)
    if (cur && cur.raw_hash === input.hash) {
      return
    }

    if (cur && input.mark) {
      const win = choose({
        current: {
          version: cur.version,
          source: cur.source,
          time_source_updated: cur.time_source_updated,
        },
        mark: input.mark,
        incoming_source: input.mark.source,
        incoming_time: input.time_source_updated,
      })
      if (win === "current") {
        KnowledgeRepo.markConflict({
          id: cur.id,
          state: input.mark.version < cur.version ? "stale_marker" : "deterministic_keep_current",
          raw: input.raw,
          hash: input.hash,
        })
        return
      }
    }

    const next = KnowledgeRepo.upsert({
      kind: k,
      path: full,
      source: input.mark?.source || source(full),
      raw: input.raw,
      raw_hash: input.hash,
      metadata: JSON.stringify({ marker: input.mark ?? null }),
      time_source_updated: input.time_source_updated,
    })

    if (!next) return
    if (next.conflict_state !== "none") {
      KnowledgeRepo.markConflict({
        id: next.id,
        state: next.conflict_state,
        raw: input.raw,
        hash: input.hash,
      })
      log.warn("knowledge conflict", { path: full, state: next.conflict_state })
      return
    }

    KnowledgeRepo.replaceChunks(next.id, k, full, next.version, chunks(next.raw))
  }

  export async function write_document(input: {
    path: string
    raw: string
    kind?: Kind
    source?: "disk" | "mirror"
    expected?: number
  }) {
    const full = path.resolve(input.path)
    const k = input.kind ?? kind(full)
    if (!k) throw new Error(`unsupported knowledge path: ${full}`)

    const raw = normalize(input.raw)
    const hash = Hash.fast(raw)
    const next = KnowledgeRepo.upsert({
      kind: k,
      path: full,
      source: input.source ?? source(full),
      raw,
      raw_hash: hash,
      metadata: JSON.stringify({ written: true }),
      expected: input.expected,
      time_source_updated: Date.now(),
    })

    if (!next) return
    if (next.conflict_state !== "none") {
      KnowledgeRepo.markConflict({
        id: next.id,
        state: next.conflict_state,
        raw,
        hash,
      })
      return {
        state: "conflict" as const,
        document: KnowledgeRepo.get(full),
      }
    }

    KnowledgeRepo.replaceChunks(next.id, k, full, next.version, chunks(next.raw))

    const tail = marker({
      version: next.version,
      hash,
      source: input.source ?? source(full),
      time: Date.now(),
    })
    await Filesystem.write(full, raw + "\n" + tail + "\n")
    const s = await state()
    s.writes.set(full, { hash, until: Date.now() + 10_000 })

    return {
      state: "ok" as const,
      document: next,
    }
  }

  export function search_chunks(input: { query: string; kind?: Kind; limit?: number }) {
    return KnowledgeRepo.search(input)
  }

  export function get_document(path: string) {
    return KnowledgeRepo.document(path)
  }
}
