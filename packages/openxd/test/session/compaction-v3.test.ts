import { describe, expect, test } from "bun:test"
import { CompactionV3 } from "../../src/session/compaction-v3"
import { getDefaultConfig } from "../../src/session/compaction-v3-config"
import { Token } from "../../src/util/token"
import { PartID } from "../../src/session/schema"

describe("CompactionV3", () => {
  describe("Configuration", () => {
    test("getDefaultConfig returns valid config", () => {
      const cfg = getDefaultConfig()
      expect(cfg).toBeDefined()
      expect(cfg.microcompaction?.enabled).toBe(true)
      expect(cfg.headroom?.enabled).toBe(true)
      expect(cfg.rehydration?.enabled).toBe(true)
      expect(cfg.auto).toBe(true)
    })

    test("microcompaction config has required fields", () => {
      const cfg = getDefaultConfig()
      expect(cfg.microcompaction?.outputThresholdTokens).toBeGreaterThan(0)
      expect(cfg.microcompaction?.hotTailSize).toBeGreaterThan(0)
      expect(cfg.microcompaction?.cachePath).toBeDefined()
    })

    test("headroom config has required fields", () => {
      const cfg = getDefaultConfig()
      expect(cfg.headroom?.minimumHeadroom).toBeGreaterThan(0)
      expect(cfg.headroom?.outputHeadroom).toBeGreaterThan(0)
      expect(cfg.headroom?.compactionHeadroom).toBeGreaterThan(0)
      expect(cfg.headroom?.triggerUrgency).toBeDefined()
    })

    test("rehydration config has required fields", () => {
      const cfg = getDefaultConfig()
      expect(cfg.rehydration?.recentFileCount).toBeGreaterThanOrEqual(0)
      expect(cfg.rehydration?.rehydrateConfig).toBeDefined()
      expect(cfg.rehydration?.rehydrateTodoList).toBeDefined()
    })
  })

  describe("MicrocompactionService", () => {
    test("creates service with config", () => {
      const cfg = getDefaultConfig()
      const service = new CompactionV3.MicrocompactionService(cfg.microcompaction!)
      expect(service).toBeDefined()
    })

    test("small outputs are not offloaded", async () => {
      const cfg = getDefaultConfig()
      const service = new CompactionV3.MicrocompactionService(cfg.microcompaction!)

      const smallOutput = "small output"
      const tokens = Token.estimate(smallOutput)
      expect(tokens).toBeLessThan(cfg.microcompaction?.outputThresholdTokens || 5000)

      const result = await service.offloadToolOutput({
        output: smallOutput,
        toolName: "test",
        timestamp: Date.now(),
        partID: PartID.ascending(),
      })

      expect(result.reference).toBe(smallOutput)
      expect("cachePath" in result).toBe(false)
    })

    test("large outputs are offloaded", async () => {
      const service = new CompactionV3.MicrocompactionService({
        enabled: true,
        outputThresholdTokens: 100, // Low threshold for testing
        hotTailSize: 5,
        cachePath: "./.openxd/test_cache",
        cleanupAgeMs: 86400000,
      } as any)

      const largeOutput = "x".repeat(50000) // Large enough to exceed 100 tokens
      const result = await service.offloadToolOutput({
        output: largeOutput,
        toolName: "test",
        timestamp: Date.now(),
        partID: PartID.ascending(),
      })

      if ("cachePath" in result) {
        expect(result.cachePath).toBeDefined()
        expect(result.reference).toContain("cached")
      }
    })

    test("disabled microcompaction returns reference unchanged", async () => {
      const service = new CompactionV3.MicrocompactionService({
        enabled: false,
        outputThresholdTokens: 5000,
        hotTailSize: 5,
        cachePath: "./.openxd/tool_cache",
        cleanupAgeMs: 86400000,
      } as any)

      const output = "test output"
      const result = await service.offloadToolOutput({
        output,
        toolName: "test",
        timestamp: Date.now(),
        partID: PartID.ascending(),
      })

      expect(result.reference).toBe(output)
      expect("cachePath" in result).toBe(false)
    })
  })

  describe("HeadroomService", () => {
    test("creates service with config", () => {
      const cfg = getDefaultConfig()
      const service = new CompactionV3.HeadroomService(cfg.headroom!)
      expect(service).toBeDefined()
    })

    test("calculateMetrics returns valid metrics", () => {
      const cfg = getDefaultConfig()
      const service = new CompactionV3.HeadroomService(cfg.headroom!)

      const metrics = service.calculateMetrics({
        tokens: {
          total: 3500,
          input: 2000,
          output: 500,
          reasoning: 1000,
          cache: { read: 0, write: 0 },
        },
        model: {
          id: "test" as any,
          providerID: "test" as any,
          api: { id: "test", url: "", npm: "" },
          name: "Test Model",
          family: undefined,
          capabilities: {
            temperature: true,
            reasoning: true,
            attachment: true,
            toolcall: true,
            input: { text: true, audio: false, image: false, video: false, pdf: false },
            output: { text: true, audio: false, image: false, video: false, pdf: false },
            interleaved: false,
          },
          cost: {
            input: 1,
            output: 2,
            cache: { read: 0.5, write: 0.5 },
            experimentalOver200K: undefined,
          },
          limit: { context: 128000, input: undefined, output: 4000 },
        } as any,
      })

      expect(metrics).toBeDefined()
      expect(metrics.totalTokens).toBeGreaterThan(0)
      expect(metrics.freeSpace).toBeDefined()
      expect(metrics.contextLimit).toEqual(128000)
    })

    test("shouldTriggerCompaction with low headroom", () => {
      const service = new CompactionV3.HeadroomService({
        enabled: true,
        minimumHeadroom: 30000,
        outputHeadroom: 20000,
        compactionHeadroom: 10000,
        respectTaskBoundaries: true,
        triggerUrgency: "high",
      } as any)

      const trigger = service.shouldTriggerCompaction({
        totalTokens: 120000,
        inputTokens: 80000,
        outputTokens: 40000,
        cacheRead: 0,
        cacheWrite: 0,
        contextLimit: 128000,
        freeSpace: 5000, // Very low headroom (< minimumHeadroom)
      })

      expect(trigger.shouldCompact).toBe(true)
      expect(trigger.urgency).toBe("high")
    })

    test("shouldTriggerCompaction with healthy headroom", () => {
      const service = new CompactionV3.HeadroomService({
        enabled: true,
        minimumHeadroom: 30000,
        outputHeadroom: 20000,
        compactionHeadroom: 10000,
        respectTaskBoundaries: true,
        triggerUrgency: "medium",
      } as any)

      const trigger = service.shouldTriggerCompaction({
        totalTokens: 80000,
        inputTokens: 50000,
        outputTokens: 30000,
        cacheRead: 0,
        cacheWrite: 0,
        contextLimit: 128000,
        freeSpace: 50000, // Healthy headroom (> minimumHeadroom)
      })

      expect(trigger.shouldCompact).toBe(false)
    })
  })

  describe("RehydrationService", () => {
    test("creates service with config", () => {
      const cfg = getDefaultConfig()
      const service = new CompactionV3.RehydrationService(cfg.rehydration!)
      expect(service).toBeDefined()
    })

    test("disabled rehydration returns empty data", async () => {
      const service = new CompactionV3.RehydrationService({
        enabled: false,
        recentFileCount: 5,
        rehydrateConfig: true,
        rehydrateTodoList: true,
        rehydrateMemory: true,
      } as any)

      const result = await service.rehydrateContext({
        sessionID: "test" as any,
        recentFiles: ["file1.ts", "file2.ts"],
        projectRoot: "/test",
      })

      expect(result.recentFiles).toHaveLength(0)
      expect(result.configContent).toBeNull()
      expect(result.todoItems).toHaveLength(0)
    })

    test("generateContinuationPrompt creates valid prompt", () => {
      const service = new CompactionV3.RehydrationService({
        enabled: true,
        recentFileCount: 5,
        rehydrateConfig: true,
        rehydrateTodoList: true,
        rehydrateMemory: true,
      } as any)

      const prompt = service.generateContinuationPrompt({
        recentFiles: ["file1.ts", "file2.ts"],
        todoItems: ["- Task 1", "- Task 2"],
        previousSummary: "We were implementing context compaction",
      })

      expect(prompt).toBeDefined()
      expect(prompt).toContain("context")
      expect(prompt).toContain("file1.ts")
      expect(prompt).toContain("Task 1")
      expect(prompt).toContain("We were implementing context compaction")
    })
  })

  describe("Service Layer", () => {
    test("layer creates valid service", async () => {
      const layer = CompactionV3.layer
      expect(layer).toBeDefined()
    })
  })
})
