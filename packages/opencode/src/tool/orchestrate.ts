import { Tool } from "./tool"
import z from "zod"
import { Orchestrator } from "../orchestrator"
import { OrchestratorState } from "../orchestrator/state"
import { withTimeout } from "../util/timeout"

const parameters = z.object({
  request: z.string().describe("The full project description — what to build, requirements, constraints"),
  auto_execute: z
    .boolean()
    .describe("If true, execute immediately after planning. If false, show plan for approval first.")
    .default(true),
})

export const OrchestratorTool = Tool.define("orchestrate", {
  description: `Orchestrate a complex, multi-step project by decomposing it into atomic tasks with dependency-aware parallel execution.

Use this tool when:
- The user describes a project with multiple interconnected parts
- Work spans 3+ files or requires coordinated changes
- The task would benefit from parallel execution
- You detect the work is too large for a single context window

Do NOT use for:
- Simple single-file edits
- Quick bug fixes
- Read/search operations
- Tasks completable in under 5 tool calls

The orchestrator will:
1. Analyze the codebase to understand current architecture
2. Decompose the request into atomic tasks with dependencies
3. Compute execution waves (independent tasks run in parallel)
4. Execute each task in a fresh context window (full 128k tokens per task)
5. Verify completed tasks against criteria
6. Report results with progress tracking`,
  parameters,
  async execute(params, ctx) {
    const { MessageV2 } = await import("../session/message-v2")
    const msg = await MessageV2.get({
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
    })

    if (msg.info.role !== "assistant") throw new Error("Not an assistant message")

    const model = {
      modelID: (msg.info as any).modelID as string,
      providerID: (msg.info as any).providerID as string,
    }

    // Check if there's already an active project for this session
    const existing = OrchestratorState.getBySession(ctx.sessionID)
    if (existing) {
      return {
        title: "Project already active",
        metadata: {},
        output: `There's already an active project: "${existing.spec.goal}"\n\n${Orchestrator.formatProgress(existing)}\n\nComplete or cancel the current project before starting a new one.`,
      }
    }

    ctx.metadata({
      title: "Planning project...",
      metadata: { request: params.request.slice(0, 100) },
    })

    const start = Date.now()
    const pulse = setInterval(() => {
      const sec = Math.max(1, Math.floor((Date.now() - start) / 1000))
      ctx.metadata({
        title: `Planning project... (${sec}s)`,
        metadata: { request: params.request.slice(0, 100) },
      })
    }, 2000)
    pulse.unref?.()

    const project = await withTimeout(
      Orchestrator.run({
        sessionID: ctx.sessionID,
        request: params.request,
        model,
        requireApproval: true,
      }),
      180000,
    ).finally(() => clearInterval(pulse))

    if (params.auto_execute) {
      void Orchestrator.execute(project, model).catch(() => {})
      return {
        title: `Started: ${project.spec.goal}`,
        metadata: { projectID: project.id } as Record<string, any>,
        output: [
          `Started orchestration in background for: ${project.spec.goal}`,
          "",
          `Project ID: ${project.id}`,
          "",
          "Use orchestrate_status to track progress.",
        ].join("\n"),
      }
    }

    const s = Orchestrator.summary(project)

    const output = [
      Orchestrator.formatPlan(project),
      "",
      `Project ID: ${project.id}`,
      "",
      "To execute this plan, use the orchestrate_execute tool with this project ID.",
    ].join("\n")

    return {
      title: `Plan: ${project.spec.goal}`,
      metadata: { projectID: project.id, ...s } as Record<string, any>,
      output,
    }
  },
})

// ─── Execute Tool (for approval flow) ─────────────────────────────────

const executeParams = z.object({
  project_id: z.string().describe("The project ID from a previous orchestrate plan"),
})

export const OrchestratorExecuteTool = Tool.define("orchestrate_execute", {
  description: `Execute a previously planned orchestration project. Use after showing a plan to the user and getting approval.`,
  parameters: executeParams,
  async execute(params, ctx) {
    const project = OrchestratorState.get(params.project_id)
    if (!project) {
      return {
        title: "Project not found",
        metadata: {} as Record<string, any>,
        output: `No project found with ID: ${params.project_id}`,
      }
    }

    const { MessageV2 } = await import("../session/message-v2")
    const msg = await MessageV2.get({
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
    })

    const model = {
      modelID: (msg.info as any).modelID as string,
      providerID: (msg.info as any).providerID as string,
    }

    ctx.metadata({
      title: `Executing: ${project.spec.goal}`,
      metadata: { projectID: project.id },
    })

    void Orchestrator.execute(project, model).catch(() => {})

    return {
      title: `Started: ${project.spec.goal}`,
      metadata: { projectID: project.id } as Record<string, any>,
      output: [
        `Started execution for: ${project.spec.goal}`,
        "",
        `Project ID: ${project.id}`,
        "",
        "Use orchestrate_status to track progress.",
      ].join("\n"),
    }
  },
})

// ─── Status Tool ────────────────────────────────────────────────────────

const statusParams = z.object({
  project_id: z.string().describe("The project ID to check status for").optional(),
})

export const OrchestratorStatusTool = Tool.define("orchestrate_status", {
  description: `Check the status of an active orchestration project.`,
  parameters: statusParams,
  async execute(params, ctx) {
    const project = params.project_id
      ? OrchestratorState.get(params.project_id)
      : OrchestratorState.getBySession(ctx.sessionID)

    if (!project) {
      return {
        title: "No active project",
        metadata: {} as Record<string, any>,
        output: "No active orchestration project found.",
      }
    }

    return {
      title: `Status: ${project.spec.goal}`,
      metadata: { projectID: project.id } as Record<string, any>,
      output: Orchestrator.formatProgress(project),
    }
  },
})
