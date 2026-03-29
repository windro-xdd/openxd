import { promises as fs } from "fs"
import { join } from "path"
import { Log } from "@/util/log"
import { Token } from "@/util/token"
import { PartID } from "./schema"

const log = Log.create({ service: "session.tool-cache" })

export namespace ToolCache {
  export interface CacheEntry {
    metadata: {
      tool: string
      timestamp: number
      tokens: number
      size: number
      partID: PartID
    }
    output: string
  }

  /**
   * Save large tool output to disk cache
   */
  export async function save(input: {
    cachePath: string
    output: string
    toolName: string
    partID: PartID
  }): Promise<{
    success: boolean
    path: string
    tokens: number
    error?: string
  }> {
    try {
      const tokens = Token.estimate(input.output)
      
      await fs.mkdir(input.cachePath, { recursive: true })

      const timestamp = Date.now()
      const filename = `${input.toolName}_${timestamp}_${input.partID}.json`
      const filePath = join(input.cachePath, filename)

      const entry: CacheEntry = {
        metadata: {
          tool: input.toolName,
          timestamp,
          tokens,
          size: input.output.length,
          partID: input.partID,
        },
        output: input.output,
      }

      await fs.writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8")

      log.info("tool_cache.saved", {
        tool: input.toolName,
        tokens,
        path: filePath,
      })

      return { success: true, path: filePath, tokens }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      log.error("tool_cache.save_failed", { tool: input.toolName, error })
      return { success: false, path: "", tokens: 0, error }
    }
  }

  /**
   * Retrieve tool output from cache
   */
  export async function retrieve(cachePath: string): Promise<{
    success: boolean
    output?: string
    entry?: CacheEntry
    error?: string
  }> {
    try {
      const content = await fs.readFile(cachePath, "utf-8")
      const entry = JSON.parse(content) as CacheEntry

      log.debug("tool_cache.retrieved", {
        tool: entry.metadata.tool,
        tokens: entry.metadata.tokens,
        size: entry.metadata.size,
      })

      return { success: true, output: entry.output, entry }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      log.warn("tool_cache.retrieve_failed", { cachePath, error })
      return { success: false, error }
    }
  }

  /**
   * List all cached tool outputs
   */
  export async function list(cachePath: string): Promise<{
    success: boolean
    entries: CacheEntry[]
    totalTokens: number
    error?: string
  }> {
    try {
      const files = await fs.readdir(cachePath, { recursive: false })
      const entries: CacheEntry[] = []
      let totalTokens = 0

      for (const file of files) {
        if (typeof file !== "string" || !file.endsWith(".json")) continue
        const filePath = join(cachePath, file)
        try {
          const content = await fs.readFile(filePath, "utf-8")
          const entry = JSON.parse(content) as CacheEntry
          entries.push(entry)
          totalTokens += entry.metadata.tokens
        } catch {
          // Skip malformed entries
          continue
        }
      }

      return { success: true, entries, totalTokens }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      log.warn("tool_cache.list_failed", { cachePath, error })
      return { success: false, entries: [], totalTokens: 0, error }
    }
  }

  /**
   * Clean old cache entries (older than maxAgeMs)
   */
  export async function cleanup(input: {
    cachePath: string
    maxAgeMs: number
  }): Promise<{
    success: boolean
    cleaned: number
    freedTokens: number
    error?: string
  }> {
    try {
      const files = await fs.readdir(input.cachePath, { recursive: false })
      const now = Date.now()
      let cleaned = 0
      let freedTokens = 0

      for (const file of files) {
        if (typeof file !== "string" || !file.endsWith(".json")) continue
        const filePath = join(input.cachePath, file)
        try {
          const content = await fs.readFile(filePath, "utf-8")
          const entry = JSON.parse(content) as CacheEntry
          const age = now - entry.metadata.timestamp

          if (age > input.maxAgeMs) {
            await fs.unlink(filePath)
            cleaned++
            freedTokens += entry.metadata.tokens
          }
        } catch {
          continue
        }
      }

      log.info("tool_cache.cleanup", { cleaned, freedTokens })
      return { success: true, cleaned, freedTokens }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      log.warn("tool_cache.cleanup_failed", { cachePath: input.cachePath, error })
      return { success: false, cleaned: 0, freedTokens: 0, error }
    }
  }
}
