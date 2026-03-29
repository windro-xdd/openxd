import { Effect, Layer } from "effect"
import { Bus } from "@/bus"
import { Session } from "."
import { MessageV2 } from "./message-v2"
import { PartID, SessionID } from "./schema"
import { Log } from "@/util/log"
import { Token } from "@/util/token"
import { ToolCache } from "./tool-cache"
import { getDefaultConfig } from "./compaction-v3-config"

/**
 * Integration layer that hooks compaction V3 into the message processor
 *
 * This handles:
 * 1. Intercepting tool outputs before they're stored
 * 2. Deciding whether to cache or inline them
 * 3. Replacing large outputs with references
 */

export namespace CompactionV3Integration {
  const log = Log.create({ service: "session.compaction-v3-integration" })

  export interface Interface {
    processToolOutput(input: {
      output: string
      toolName: string
      partID: PartID
      sessionID: SessionID
    }): Effect.Effect<{
      output: string
      wasCached: boolean
      cacheLocation?: string
    }>
  }

  export const processToolOutput = Effect.fn("CompactionV3Integration.processToolOutput")(
    function* (input: {
      output: string
      toolName: string
      partID: PartID
      sessionID: SessionID
    }) {
      // Get config
      const cfg = getDefaultConfig()
      if (!cfg.microcompaction?.enabled) {
        return { output: input.output, wasCached: false }
      }

      const outputTokens = Token.estimate(input.output)
      const threshold = cfg.microcompaction.outputThresholdTokens

      // Small outputs stay inline
      if (outputTokens < threshold) {
        log.debug("tool_output.inline", {
          tool: input.toolName,
          tokens: outputTokens,
          threshold,
        })
        return { output: input.output, wasCached: false }
      }

      // Large outputs get cached
      const cachePath = cfg.microcompaction.cachePath
      const cacheResult = yield* Effect.promise(() =>
        ToolCache.save({
          cachePath,
          output: input.output,
          toolName: input.toolName,
          partID: input.partID,
        })
      )

      if (!cacheResult.success) {
        log.warn("tool_output.cache_failed", {
          tool: input.toolName,
          tokens: outputTokens,
          error: cacheResult.error,
        })
        // Fall back to inline if cache fails
        return { output: input.output, wasCached: false }
      }

      const reference = `[Tool output cached: ${input.toolName}, ${outputTokens} tokens]\n[Location: ${cacheResult.path}]\n[To retrieve: use /read-cache ${cacheResult.path}]`

      log.info("tool_output.cached", {
        tool: input.toolName,
        tokens: outputTokens,
        originalSize: input.output.length,
        referenceSizeSaved: input.output.length - reference.length,
      })

      return {
        output: reference,
        wasCached: true,
        cacheLocation: cacheResult.path,
      }
    }
  )
}
