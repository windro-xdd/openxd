import z from "zod"

/**
 * Compaction V3 Configuration Schema
 * 
 * Three-layer compaction system with full customization
 */

export const CompactionV3Config = z
  .object({
    // === Layer 1: Microcompaction ===
    microcompaction: z
      .object({
        enabled: z.boolean().default(true).describe("Enable tool output offloading"),
        outputThresholdTokens: z
          .number()
          .int()
          .min(1000)
          .default(5000)
          .describe("Offload tool outputs larger than this (tokens)"),
        hotTailSize: z
          .number()
          .int()
          .min(1)
          .default(5)
          .describe("Keep last N tool results inline in context"),
        cachePath: z
          .string()
          .default("./.openxd/tool_cache")
          .describe("Directory for cached tool outputs"),
        cleanupAgeMs: z
          .number()
          .int()
          .default(86400000) // 24 hours
          .describe("Auto-clean cache entries older than this (ms)"),
      })
      .optional(),

    // === Layer 2: Headroom-Based Trigger ===
    headroom: z
      .object({
        enabled: z.boolean().default(true).describe("Enable headroom-based compaction trigger"),
        minimumHeadroom: z
          .number()
          .int()
          .min(5000)
          .default(30000)
          .describe("Absolute minimum free tokens to maintain"),
        outputHeadroom: z
          .number()
          .int()
          .default(20000)
          .describe("Reserve for agent output generation"),
        compactionHeadroom: z
          .number()
          .int()
          .default(10000)
          .describe("Reserve for compaction process itself"),
        respectTaskBoundaries: z
          .boolean()
          .default(true)
          .describe("Wait for task completion before auto-compacting"),
        triggerUrgency: z
          .enum(["immediate", "high", "medium", "low"])
          .default("medium")
          .describe("How aggressively to trigger compaction"),
      })
      .optional(),

    // === Layer 3: Rehydration ===
    rehydration: z
      .object({
        enabled: z.boolean().default(true).describe("Re-hydrate context after compaction"),
        recentFileCount: z
          .number()
          .int()
          .min(0)
          .default(5)
          .describe("Re-read N most recent files after compaction"),
        rehydrateConfig: z
          .boolean()
          .default(true)
          .describe("Re-load .openxd/openxd.jsonc after compaction"),
        rehydrateTodoList: z
          .boolean()
          .default(true)
          .describe("Restore todo list after compaction"),
        rehydrateMemory: z
          .boolean()
          .default(true)
          .describe("Restore persistent memory files"),
      })
      .optional(),

    // === Global Settings ===
    auto: z
      .boolean()
      .default(true)
      .describe("Enable automatic compaction (all layers)"),
    manualCommand: z
      .boolean()
      .default(true)
      .describe("Enable /compact user command"),
  })
  .describe("Compaction V3: 3-layer context management system")
  .strict()

export type CompactionV3Config = z.infer<typeof CompactionV3Config>

/**
 * Get default compaction config
 */
export function getDefaultConfig(): CompactionV3Config {
  return {
    microcompaction: {
      enabled: true,
      outputThresholdTokens: 5000,
      hotTailSize: 5,
      cachePath: "./.openxd/tool_cache",
      cleanupAgeMs: 86400000,
    },
    headroom: {
      enabled: true,
      minimumHeadroom: 30000,
      outputHeadroom: 20000,
      compactionHeadroom: 10000,
      respectTaskBoundaries: true,
      triggerUrgency: "medium",
    },
    rehydration: {
      enabled: true,
      recentFileCount: 5,
      rehydrateConfig: true,
      rehydrateTodoList: true,
      rehydrateMemory: true,
    },
    auto: true,
    manualCommand: true,
  }
}
