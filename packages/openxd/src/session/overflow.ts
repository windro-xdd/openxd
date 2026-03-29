import type { Config } from "@/config/config"
import type { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import type { MessageV2 } from "./message-v2"

// V3 Headroom Configuration (replaces old fixed buffer approach)
const HEADROOM_OUTPUT = 20_000      // Reserve for agent output
const HEADROOM_COMPACTION = 10_000  // Reserve for compaction process itself
const HEADROOM_MINIMUM = 30_000     // Absolute minimum free space

/**
 * V3 Overflow Detection: Headroom-Based Trigger
 * 
 * Instead of fixed threshold, we calculate:
 *   free_space = context_limit - current_tokens
 * 
 * Compaction triggers when:
 *   free_space < (HEADROOM_OUTPUT + HEADROOM_COMPACTION)
 * 
 * This ensures:
 * - Agent has space to respond
 * - Compaction itself has space to run
 * - No mid-reasoning interruption if we respect task boundaries
 */
export function isOverflow(input: { cfg: Config.Info; tokens: MessageV2.Assistant["tokens"]; model: Provider.Model }) {
  if (input.cfg.compaction?.auto === false) return false
  const context = input.model.limit.context
  if (context === 0) return false

  const count =
    input.tokens.total || input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

  // V3: Headroom-based calculation
  const freeSpace = context - count
  const requiredHeadroom = HEADROOM_OUTPUT + HEADROOM_COMPACTION

  // Critical: Not enough space even for compaction to run
  if (freeSpace < HEADROOM_MINIMUM) {
    return true
  }

  // Standard: Not enough headroom for output + compaction
  if (freeSpace < requiredHeadroom) {
    return true
  }

  return false
}

/**
 * Get detailed headroom metrics (for /context command and monitoring)
 */
export function getHeadroomMetrics(input: {
  cfg: Config.Info
  tokens: MessageV2.Assistant["tokens"]
  model: Provider.Model
}) {
  const context = input.model.limit.context || 200_000
  const count =
    input.tokens.total || input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write
  const freeSpace = context - count
  const requiredHeadroom = HEADROOM_OUTPUT + HEADROOM_COMPACTION

  return {
    contextLimit: context,
    tokensUsed: count,
    freeSpace,
    percentUsed: (count / context) * 100,
    percentFree: (freeSpace / context) * 100,
    requiredHeadroom,
    status:
      freeSpace < HEADROOM_MINIMUM ? "CRITICAL" :
      freeSpace < requiredHeadroom ? "COMPACTING" :
      freeSpace < HEADROOM_MINIMUM * 1.5 ? "WARNING" :
      "HEALTHY",
  }
}
