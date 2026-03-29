import { Effect, Layer, ServiceMap } from "effect"
import { Bus } from "@/bus"
import { Session } from "."
import { SessionID, MessageID, PartID } from "./schema"
import { MessageV2 } from "./message-v2"
import { Token } from "../util/token"
import { Log } from "../util/log"
import { Provider } from "../provider/provider"
import z from "zod"
import * as fs from "fs/promises"
import { getDefaultConfig } from "./compaction-v3-config"

/**
 * 3-Layer Context Compaction System
 * 
 * Layer 1: Microcompaction
 *   - Offload large tool outputs to disk immediately
 *   - Keep only references in context
 *   - Non-blocking, happens per-tool-call
 * 
 * Layer 2: Headroom-Based Auto-Compaction  
 *   - Monitor free context space
 *   - Trigger compaction only when headroom < threshold
 *   - Respect task boundaries (wait for natural pause)
 * 
 * Layer 3: File Rehydration
 *   - After compaction, re-read recent files
 *   - Restore file context so agent knows what it was editing
 *   - Inject continuation prompt to resume work
 */

export namespace CompactionV3 {
  const log = Log.create({ service: "session.compaction.v3" })

  // ===== Layer 1: Microcompaction Configuration =====
  export const MicrocompactionConfig = z.object({
    enabled: z.boolean().default(true),
    outputThresholdTokens: z.number().default(5000),
    hotTailSize: z.number().default(5).describe("Keep last N tool outputs inline"),
    cachePath: z.string().default("./.openxd/tool_cache"),
  })
  export type MicrocompactionConfig = z.infer<typeof MicrocompactionConfig>

  // ===== Layer 2: Headroom-Based Trigger Configuration =====
  export const HeadroomConfig = z.object({
    enabled: z.boolean().default(true),
    minimumHeadroom: z.number().default(30000).describe("Minimum free tokens to maintain"),
    outputHeadroom: z.number().default(20000).describe("Reserve for agent output"),
    compactionHeadroom: z.number().default(10000).describe("Reserve for compaction process itself"),
    respectTaskBoundaries: z.boolean().default(true),
  })
  export type HeadroomConfig = z.infer<typeof HeadroomConfig>

  // ===== Layer 3: Rehydration Configuration =====
  export const RehydrationConfig = z.object({
    enabled: z.boolean().default(true),
    recentFileCount: z.number().default(5).describe("Re-read N most recent files"),
    rehydrateConfig: z.boolean().default(true).describe("Re-read .openxd/openxd.jsonc"),
    rehydrateTodoList: z.boolean().default(true).describe("Restore todo list"),
  })
  export type RehydrationConfig = z.infer<typeof RehydrationConfig>

  // ===== Full Configuration =====
  export const Config = z.object({
    microcompaction: MicrocompactionConfig.optional(),
    headroom: HeadroomConfig.optional(),
    rehydration: RehydrationConfig.optional(),
  })
  export type Config = z.infer<typeof Config>

  // ===== Layer 1: Tool Output Offloading =====
  export class MicrocompactionService {
    constructor(private cfg: MicrocompactionConfig) {}

    async offloadToolOutput(input: {
      output: string
      toolName: string
      timestamp: number
      partID: PartID
    }): Promise<{ reference: string; cachePath: string } | { reference: string; stored: false }> {
      if (!this.cfg.enabled) {
        return { reference: input.output, stored: false }
      }

      const outputTokens = Token.estimate(input.output)
      if (outputTokens < this.cfg.outputThresholdTokens) {
        return { reference: input.output, stored: false }
      }

      const cacheDir = this.cfg.cachePath
      await fs.mkdir(cacheDir, { recursive: true })

      const filename = `${input.toolName}_${input.timestamp}_${input.partID}.json`
      const filePath = `${cacheDir}/${filename}`

      const cacheEntry = {
        tool: input.toolName,
        timestamp: input.timestamp,
        tokens: outputTokens,
        size: input.output.length,
        partID: input.partID,
      }

      await fs.writeFile(
        filePath,
        JSON.stringify({
          metadata: cacheEntry,
          output: input.output,
        }, null, 2),
        "utf-8"
      )

      const reference = `[Output cached: ${input.toolName}, ${outputTokens} tokens, at ${filePath}]`
      log.info("microcompaction.offload", {
        toolName: input.toolName,
        tokens: outputTokens,
        filePath,
      })

      return { reference, cachePath: filePath }
    }

    async retrieveToolOutput(cachePath: string): Promise<string | null> {
      try {
        const content = await fs.readFile(cachePath, "utf-8")
        const data = JSON.parse(content)
        return data.output ?? null
      } catch (err) {
        log.warn("microcompaction.retrieve_failed", { cachePath, error: String(err) })
        return null
      }
    }
  }

  // ===== Layer 2: Headroom-Based Trigger =====
  export interface ContextMetrics {
    totalTokens: number
    inputTokens: number
    outputTokens: number
    cacheRead: number
    cacheWrite: number
    contextLimit: number
    freeSpace: number
  }

  export class HeadroomService {
    constructor(private cfg: HeadroomConfig) {}

    calculateMetrics(input: {
      tokens: MessageV2.Assistant["tokens"]
      model: Provider.Model
    }): ContextMetrics {
      const total = input.tokens.total ?? 
        (input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write)
      
      const contextLimit = input.model.limit.context || 200000
      const freeSpace = contextLimit - total

      return {
        totalTokens: total,
        inputTokens: input.tokens.input,
        outputTokens: input.tokens.output,
        cacheRead: input.tokens.cache.read,
        cacheWrite: input.tokens.cache.write,
        contextLimit,
        freeSpace,
      }
    }

    shouldTriggerCompaction(metrics: ContextMetrics): {
      shouldCompact: boolean
      reason: string
      urgency: "low" | "medium" | "high"
    } {
      if (!this.cfg.enabled) {
        return { shouldCompact: false, reason: "headroom check disabled", urgency: "low" }
      }

      const needed = this.cfg.outputHeadroom + this.cfg.compactionHeadroom
      const available = metrics.freeSpace

      if (available < this.cfg.minimumHeadroom) {
        return {
          shouldCompact: true,
          reason: `Critical: ${available} free tokens < ${this.cfg.minimumHeadroom} minimum`,
          urgency: "high",
        }
      }

      if (available < needed) {
        return {
          shouldCompact: true,
          reason: `Warning: ${available} free tokens < ${needed} needed (output + compaction)`,
          urgency: "medium",
        }
      }

      if (available < this.cfg.minimumHeadroom * 1.5) {
        return {
          shouldCompact: false,
          reason: `Approaching limit: ${available} free tokens, monitor closely`,
          urgency: "low",
        }
      }

      return {
        shouldCompact: false,
        reason: `Healthy: ${available} free tokens available`,
        urgency: "low",
      }
    }
  }

  // ===== Layer 3: File Rehydration =====
  export class RehydrationService {
    constructor(private cfg: RehydrationConfig) {}

    async rehydrateContext(input: {
      sessionID: SessionID
      recentFiles: string[]
      projectRoot: string
    }): Promise<{
      recentFiles: string[]
      configContent: string | null
      todoItems: string[]
    }> {
      if (!this.cfg.enabled) {
        return { recentFiles: [], configContent: null, todoItems: [] }
      }

      const recentFiles = input.recentFiles.slice(0, this.cfg.recentFileCount)
      const todoItems: string[] = []
      let configContent: string | null = null

      // Restore config
      if (this.cfg.rehydrateConfig) {
        try {
          const configPath = `${input.projectRoot}/.openxd/openxd.jsonc`
          configContent = await fs.readFile(configPath, "utf-8")
          log.info("rehydration.config_restored")
        } catch (err) {
          log.debug("rehydration.config_not_found", { error: String(err) })
        }
      }

      // Restore todo list
      if (this.cfg.rehydrateTodoList) {
        try {
          const todoPath = `${input.projectRoot}/.openxd/todo.md`
          const content = await fs.readFile(todoPath, "utf-8")
          const todos = content.split("\n").filter(line => line.trim().startsWith("-"))
          todoItems.push(...todos)
          log.info("rehydration.todos_restored", { count: todoItems.length })
        } catch (err) {
          log.debug("rehydration.todos_not_found", { error: String(err) })
        }
      }

      return { recentFiles, configContent, todoItems }
    }

    generateContinuationPrompt(input: {
      recentFiles: string[]
      todoItems: string[]
      previousSummary: string
    }): string {
      let prompt = `This session is being continued from a previous conversation that ran out of context.

The summary below covers the earlier portion of the conversation.

${input.previousSummary}

---

**Recently accessed files:**
${input.recentFiles.map(f => `- ${f}`).join("\n")}

**Pending tasks:**
${input.todoItems.length > 0 ? input.todoItems.join("\n") : "- No pending tasks"}

---

Please continue the conversation from where we left off without asking the user any further clarifying questions. 
Continue with the last task that you were asked to work on. Use the recently accessed files and context above to pick up where you left off.`

      return prompt
    }
  }

  // ===== Unified Service =====
  export interface Interface {
    readonly microcompaction: MicrocompactionService
    readonly headroom: HeadroomService
    readonly rehydration: RehydrationService
    
    readonly processToolOutput: (input: {
      output: string
      toolName: string
      partID: PartID
    }) => Effect.Effect<{ reference: string; cached: boolean }>
    
    readonly checkHeadroom: (input: {
      tokens: MessageV2.Assistant["tokens"]
      model: Provider.Model
    }) => Effect.Effect<{
      shouldCompact: boolean
      metrics: ContextMetrics
      reason: string
      urgency: "low" | "medium" | "high"
    }>
    
    readonly rehydrateAfterCompaction: (input: {
      recentFiles: string[]
      projectRoot: string
      previousSummary: string
    }) => Effect.Effect<string>
  }

  export class Service extends ServiceMap.Service<Service, Interface>()("@opencode-ai/CompactionV3") {}

  export const layer: Layer.Layer<Service, never, never> = Layer.effect(
    Service,
    Effect.gen(function* () {
      const defaultCfg = getDefaultConfig()
      const microCfg = defaultCfg.microcompaction ?? MicrocompactionConfig.parse({})
      const headroomCfg = defaultCfg.headroom ?? HeadroomConfig.parse({})
      const rehydrationCfg = defaultCfg.rehydration ?? RehydrationConfig.parse({})

      const microcompaction = new MicrocompactionService(microCfg)
      const headroom = new HeadroomService(headroomCfg)
      const rehydration = new RehydrationService(rehydrationCfg)

      return Service.of({
        microcompaction,
        headroom,
        rehydration,

        processToolOutput: Effect.fn("CompactionV3.processToolOutput")(function* (input: {
          output: string
          toolName: string
          partID: PartID
        }) {
          const result = yield* Effect.promise(() =>
            microcompaction.offloadToolOutput({
              output: input.output,
              toolName: input.toolName,
              timestamp: Date.now(),
              partID: input.partID,
            })
          )

          return {
            reference: result.reference,
            cached: "cachePath" in result,
          }
        }),

        checkHeadroom: Effect.fn("CompactionV3.checkHeadroom")(function* (input: {
          tokens: MessageV2.Assistant["tokens"]
          model: Provider.Model
        }) {
          const metrics = headroom.calculateMetrics(input)
          const trigger = headroom.shouldTriggerCompaction(metrics)

          return {
            shouldCompact: trigger.shouldCompact,
            metrics,
            reason: trigger.reason,
            urgency: trigger.urgency,
          }
        }),

        rehydrateAfterCompaction: Effect.fn("CompactionV3.rehydrateAfterCompaction")(function* (input: {
          recentFiles: string[]
          projectRoot: string
          previousSummary: string
        }) {
          const rehydrated = yield* Effect.promise(() =>
            rehydration.rehydrateContext({
              recentFiles: input.recentFiles,
              projectRoot: input.projectRoot,
              sessionID: "" as any as SessionID,
            })
          )

          const continuationPrompt = rehydration.generateContinuationPrompt({
            recentFiles: rehydrated.recentFiles,
            todoItems: rehydrated.todoItems,
            previousSummary: input.previousSummary,
          })

          return continuationPrompt
        }),
      })
    })
  )
}
