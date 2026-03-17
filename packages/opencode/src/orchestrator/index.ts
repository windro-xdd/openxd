import { OrchestratorTypes } from "./types"
import { OrchestratorState } from "./state"
import { OrchestratorEngine } from "./engine"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { Instance } from "../project/instance"
import path from "path"
import fs from "fs/promises"

export namespace Orchestrator {
  const log = Log.create({ service: "orchestrator" })

  // Re-export types
  export type ProjectState = OrchestratorTypes.ProjectState
  export type Task = OrchestratorTypes.Task
  export type Spec = OrchestratorTypes.Spec

  // Re-export state operations
  export const getProject = OrchestratorState.get
  export const getProjectBySession = OrchestratorState.getBySession
  export const listProjects = OrchestratorState.list
  export const summary = OrchestratorState.summary

  // ─── Main Entry Point ─────────────────────────────────────────────────

  /**
   * Plan and execute a project from a user's natural language request.
   *
   * This is the single entry point. It:
   * 1. Decomposes the request into spec + tasks
   * 2. Computes wave dependencies
   * 3. Executes waves sequentially (tasks within waves run in parallel)
   * 4. Reports results
   */
  export async function run(input: {
    sessionID: string
    request: string
    model: { modelID: string; providerID: string }
    /** If true, pause after planning for user approval before executing */
    requireApproval?: boolean
  }): Promise<OrchestratorTypes.ProjectState> {
    const { sessionID, request, model } = input

    log.info("orchestrator starting", { sessionID, requestLength: request.length })

    // ─── Phase 1: Plan ────────────────────────────────────────────────

    const decomposition = await OrchestratorEngine.decompose({
      sessionID,
      userRequest: request,
      model,
    })

    // Build project state
    const projectID = `proj_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const tasks: OrchestratorTypes.Task[] = decomposition.tasks.map((t) => ({
      ...t,
      status: "pending" as const,
      wave: 0,
    }))

    // Compute waves
    const totalWaves = OrchestratorState.computeWaves(tasks)

    // Capture base commit for rollback
    const baseCommit = await getBaseCommit()

    const project: OrchestratorTypes.ProjectState = {
      id: projectID,
      spec: decomposition.spec,
      tasks,
      currentWave: 0,
      totalWaves,
      status: "planning",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sessionID,
      baseCommit,
    }

    OrchestratorState.set(project)
    Bus.publish(OrchestratorState.Event.ProjectCreated, { projectID, sessionID })

    // Save plan to disk for persistence
    await savePlan(project)

    log.info("plan created", {
      projectID,
      taskCount: tasks.length,
      totalWaves,
      waveSizes: Array.from({ length: totalWaves }, (_, i) =>
        OrchestratorState.getWaveTasks(project, i).length
      ),
    })

    // If approval required, stop here and return the plan
    if (input.requireApproval) {
      return project
    }

    // ─── Phase 2: Execute ─────────────────────────────────────────────

    return execute(project, model)
  }

  /**
   * Execute a planned project (after approval if needed).
   */
  export async function execute(
    project: OrchestratorTypes.ProjectState,
    model: { modelID: string; providerID: string },
  ): Promise<OrchestratorTypes.ProjectState> {
    project.status = "executing"
    OrchestratorState.set(project)

    for (let wave = 0; wave < project.totalWaves; wave++) {
      project.currentWave = wave
      OrchestratorState.set(project)

      log.info("starting wave", { projectID: project.id, wave, totalWaves: project.totalWaves })

      await OrchestratorEngine.executeWave({
        project,
        wave,
        model,
      })

      // Check if wave had failures
      if (OrchestratorState.hasWaveFailure(project, wave)) {
        const failedTasks = OrchestratorState.getWaveTasks(project, wave)
          .filter((t) => t.status === "failed")

        // If ALL tasks in wave failed, abort
        const waveTasks = OrchestratorState.getWaveTasks(project, wave)
        if (failedTasks.length === waveTasks.length) {
          project.status = "failed"
          OrchestratorState.set(project)
          Bus.publish(OrchestratorState.Event.ProjectFailed, {
            projectID: project.id,
            reason: `All tasks in wave ${wave} failed`,
          })
          await savePlan(project)
          return project
        }

        // Some tasks failed but not all — continue with what succeeded
        log.warn("partial wave failure, continuing", {
          projectID: project.id,
          wave,
          failed: failedTasks.length,
          total: waveTasks.length,
        })
      }

      await savePlan(project)
    }

    // ─── Phase 3: Complete ──────────────────────────────────────────────

    const s = OrchestratorState.summary(project)
    if (s.failed > 0) {
      project.status = "failed"
    } else {
      project.status = "done"
    }
    OrchestratorState.set(project)

    Bus.publish(OrchestratorState.Event.ProjectCompleted, {
      projectID: project.id,
      tasksCompleted: s.done,
    })

    await savePlan(project)
    log.info("orchestrator complete", { projectID: project.id, ...s })

    return project
  }

  // ─── Plan Persistence ─────────────────────────────────────────────────

  async function savePlan(project: OrchestratorTypes.ProjectState): Promise<void> {
    try {
      const planDir = path.join(Instance.worktree, ".opencode", "plans")
      await fs.mkdir(planDir, { recursive: true })

      const planFile = path.join(planDir, `${project.id}.json`)
      await fs.writeFile(planFile, JSON.stringify(project, null, 2))

      // Also write a human-readable summary
      const summaryFile = path.join(planDir, `${project.id}.md`)
      await fs.writeFile(summaryFile, renderPlanMarkdown(project))
    } catch (e) {
      log.warn("failed to save plan", { error: String(e) })
    }
  }

  function renderPlanMarkdown(project: OrchestratorTypes.ProjectState): string {
    const s = OrchestratorState.summary(project)
    const statusEmoji: Record<string, string> = {
      pending: "⏳",
      ready: "🔜",
      running: "🔄",
      done: "✅",
      verified: "✅",
      failed: "❌",
      skipped: "⏭️",
    }

    const lines: string[] = [
      `# Project: ${project.spec.goal}`,
      "",
      `**Status:** ${project.status} | **Progress:** ${s.done}/${s.total} tasks | **Wave:** ${s.currentWave + 1}/${s.totalWaves}`,
      "",
      "## Spec",
      "",
      `**Goal:** ${project.spec.goal}`,
      "",
      "### Requirements",
      ...project.spec.requirements.map((r) => `- ${r}`),
      "",
      ...(project.spec.constraints.length > 0
        ? ["### Constraints", ...project.spec.constraints.map((c) => `- ${c}`), ""]
        : []),
      ...(project.spec.outOfScope.length > 0
        ? ["### Out of Scope", ...project.spec.outOfScope.map((o) => `- ${o}`), ""]
        : []),
      `**Done When:** ${project.spec.doneWhen}`,
      "",
      "## Tasks",
      "",
    ]

    for (let wave = 0; wave < project.totalWaves; wave++) {
      const waveTasks = OrchestratorState.getWaveTasks(project, wave)
      lines.push(`### Wave ${wave + 1} ${wave < project.totalWaves - 1 ? "(parallel)" : ""}`)
      lines.push("")

      for (const task of waveTasks) {
        const emoji = statusEmoji[task.status] ?? "❓"
        lines.push(`${emoji} **${task.title}** (${task.id})`)
        if (task.dependsOn.length > 0) {
          lines.push(`  - Depends on: ${task.dependsOn.join(", ")}`)
        }
        if (task.files.length > 0) {
          lines.push(`  - Files: ${task.files.join(", ")}`)
        }
        if (task.error) {
          lines.push(`  - ❌ Error: ${task.error}`)
        }
        lines.push("")
      }
    }

    if (project.baseCommit) {
      lines.push(`\n---\n**Base commit:** \`${project.baseCommit}\` (for rollback)`)
    }

    return lines.join("\n")
  }

  async function getBaseCommit(): Promise<string | undefined> {
    try {
      const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
        cwd: Instance.worktree,
        stdout: "pipe",
        stderr: "pipe",
      })
      const output = await new Response(proc.stdout).text()
      await proc.exited
      return output.trim() || undefined
    } catch {
      return undefined
    }
  }

  // ─── Formatting ───────────────────────────────────────────────────────

  /**
   * Format a project plan for display to the user (for approval).
   */
  export function formatPlan(project: OrchestratorTypes.ProjectState): string {
    const s = OrchestratorState.summary(project)

    const lines: string[] = [
      `📋 **Project Plan: ${project.spec.goal}**`,
      "",
      `**${s.total} tasks** across **${s.totalWaves} waves**`,
      "",
    ]

    for (let wave = 0; wave < project.totalWaves; wave++) {
      const waveTasks = OrchestratorState.getWaveTasks(project, wave)
      const parallel = waveTasks.length > 1 ? " (parallel)" : ""
      lines.push(`**Wave ${wave + 1}${parallel}:**`)

      for (const task of waveTasks) {
        const deps = task.dependsOn.length > 0 ? ` ← ${task.dependsOn.join(", ")}` : ""
        lines.push(`  ${task.id}. ${task.title}${deps}`)
      }
      lines.push("")
    }

    lines.push("**Requirements:**")
    for (const req of project.spec.requirements) {
      lines.push(`  • ${req}`)
    }

    if (project.spec.outOfScope.length > 0) {
      lines.push("")
      lines.push("**Out of scope:**")
      for (const oos of project.spec.outOfScope) {
        lines.push(`  • ${oos}`)
      }
    }

    lines.push("")
    lines.push(`**Done when:** ${project.spec.doneWhen}`)

    return lines.join("\n")
  }

  /**
   * Format progress for display during execution.
   */
  export function formatProgress(project: OrchestratorTypes.ProjectState): string {
    const s = OrchestratorState.summary(project)
    const pct = Math.round((s.done / s.total) * 100)
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5))

    const lines = [
      `[${bar}] ${pct}% — ${s.done}/${s.total} tasks`,
      `Wave ${s.currentWave + 1}/${s.totalWaves} | Running: ${s.running} | Failed: ${s.failed}`,
    ]

    // Show currently running tasks
    const running = project.tasks.filter((t) => t.status === "running")
    if (running.length > 0) {
      lines.push("")
      lines.push("Active:")
      for (const t of running) {
        const elapsed = t.startedAt ? Math.round((Date.now() - t.startedAt) / 1000) : 0
        lines.push(`  🔄 ${t.title} (${elapsed}s)`)
      }
    }

    return lines.join("\n")
  }
}
