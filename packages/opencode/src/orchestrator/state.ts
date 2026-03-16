import { OrchestratorTypes } from "./types"
import { Log } from "@/util/log"
import { Instance } from "@/project/instance"
import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"

export namespace OrchestratorState {
  const log = Log.create({ service: "orchestrator" })

  export const Event = {
    ProjectCreated: BusEvent.define(
      "orchestrator.project.created",
      z.object({ projectID: z.string(), sessionID: z.string() }),
    ),
    WaveStarted: BusEvent.define(
      "orchestrator.wave.started",
      z.object({ projectID: z.string(), wave: z.number(), taskCount: z.number() }),
    ),
    TaskStarted: BusEvent.define(
      "orchestrator.task.started",
      z.object({ projectID: z.string(), taskID: z.string(), title: z.string() }),
    ),
    TaskCompleted: BusEvent.define(
      "orchestrator.task.completed",
      z.object({ projectID: z.string(), taskID: z.string(), title: z.string() }),
    ),
    TaskFailed: BusEvent.define(
      "orchestrator.task.failed",
      z.object({ projectID: z.string(), taskID: z.string(), error: z.string() }),
    ),
    ProjectCompleted: BusEvent.define(
      "orchestrator.project.completed",
      z.object({ projectID: z.string(), tasksCompleted: z.number() }),
    ),
    ProjectFailed: BusEvent.define(
      "orchestrator.project.failed",
      z.object({ projectID: z.string(), reason: z.string() }),
    ),
  }

  // In-memory project states
  const projects = Instance.state(() => new Map<string, OrchestratorTypes.ProjectState>())

  /** Store a project state */
  export function set(project: OrchestratorTypes.ProjectState): void {
    project.updatedAt = Date.now()
    projects().set(project.id, project)
  }

  /** Get a project state by ID */
  export function get(projectID: string): OrchestratorTypes.ProjectState | undefined {
    return projects().get(projectID)
  }

  /** Get project by session ID (finds the active project for a session) */
  export function getBySession(sessionID: string): OrchestratorTypes.ProjectState | undefined {
    for (const project of projects().values()) {
      if (project.sessionID === sessionID && project.status !== "done" && project.status !== "failed") {
        return project
      }
    }
    return undefined
  }

  /** Delete a project state */
  export function remove(projectID: string): void {
    projects().delete(projectID)
  }

  /** List all active projects */
  export function list(): OrchestratorTypes.ProjectState[] {
    return Array.from(projects().values())
  }

  // ─── Task Graph Operations ────────────────────────────────────────────

  /** Compute wave numbers from dependencies */
  export function computeWaves(tasks: OrchestratorTypes.Task[]): number {
    const taskMap = new Map(tasks.map((t) => [t.id, t]))

    function getWave(taskId: string, visited: Set<string> = new Set()): number {
      if (visited.has(taskId)) {
        log.warn("circular dependency detected", { taskId })
        return 0
      }
      visited.add(taskId)

      const task = taskMap.get(taskId)
      if (!task) return 0
      if (task.dependsOn.length === 0) return 0

      let maxDepWave = 0
      for (const depId of task.dependsOn) {
        const depWave = getWave(depId, new Set(visited))
        maxDepWave = Math.max(maxDepWave, depWave + 1)
      }
      return maxDepWave
    }

    let maxWave = 0
    for (const task of tasks) {
      task.wave = getWave(task.id)
      maxWave = Math.max(maxWave, task.wave)
    }
    return maxWave + 1
  }

  /** Get all tasks in a specific wave */
  export function getWaveTasks(project: OrchestratorTypes.ProjectState, wave: number): OrchestratorTypes.Task[] {
    return project.tasks.filter((t) => t.wave === wave)
  }

  /** Check if all dependencies of a task are met */
  export function areDependenciesMet(project: OrchestratorTypes.ProjectState, task: OrchestratorTypes.Task): boolean {
    return task.dependsOn.every((depId) => {
      const dep = project.tasks.find((t) => t.id === depId)
      return dep && (dep.status === "done" || dep.status === "verified")
    })
  }

  /** Get ready tasks (dependencies met, not yet running) */
  export function getReadyTasks(project: OrchestratorTypes.ProjectState): OrchestratorTypes.Task[] {
    return project.tasks.filter(
      (t) => t.status === "pending" && areDependenciesMet(project, t),
    )
  }

  /** Check for file conflicts between tasks in the same wave */
  export function detectFileConflicts(tasks: OrchestratorTypes.Task[]): Array<[string, string, string[]]> {
    const conflicts: Array<[string, string, string[]]> = []

    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const shared = tasks[i].files.filter((f) => tasks[j].files.includes(f))
        if (shared.length > 0) {
          conflicts.push([tasks[i].id, tasks[j].id, shared])
        }
      }
    }
    return conflicts
  }

  /** Update a task's status */
  export function updateTask(
    project: OrchestratorTypes.ProjectState,
    taskID: string,
    update: Partial<OrchestratorTypes.Task>,
  ): OrchestratorTypes.Task | undefined {
    const task = project.tasks.find((t) => t.id === taskID)
    if (!task) return undefined

    Object.assign(task, update)
    project.updatedAt = Date.now()
    return task
  }

  /** Check if all tasks in a wave are done */
  export function isWaveComplete(project: OrchestratorTypes.ProjectState, wave: number): boolean {
    const waveTasks = getWaveTasks(project, wave)
    return waveTasks.every((t) => t.status === "done" || t.status === "verified" || t.status === "failed" || t.status === "skipped")
  }

  /** Check if any task in the wave failed */
  export function hasWaveFailure(project: OrchestratorTypes.ProjectState, wave: number): boolean {
    return getWaveTasks(project, wave).some((t) => t.status === "failed")
  }

  /** Skip tasks that depend on a failed task */
  export function cascadeFailure(project: OrchestratorTypes.ProjectState, failedTaskID: string): string[] {
    const skipped: string[] = []
    for (const task of project.tasks) {
      if (task.status === "pending" && task.dependsOn.includes(failedTaskID)) {
        task.status = "skipped"
        task.error = `Skipped: dependency "${failedTaskID}" failed`
        skipped.push(task.id)
        // Cascade further
        skipped.push(...cascadeFailure(project, task.id))
      }
    }
    return skipped
  }

  /** Get a summary of project progress */
  export function summary(project: OrchestratorTypes.ProjectState): {
    total: number
    pending: number
    running: number
    done: number
    failed: number
    skipped: number
    currentWave: number
    totalWaves: number
  } {
    const counts = { total: 0, pending: 0, running: 0, done: 0, failed: 0, skipped: 0 }
    for (const task of project.tasks) {
      counts.total++
      if (task.status === "pending" || task.status === "ready") counts.pending++
      else if (task.status === "running") counts.running++
      else if (task.status === "done" || task.status === "verified") counts.done++
      else if (task.status === "failed") counts.failed++
      else if (task.status === "skipped") counts.skipped++
    }
    return { ...counts, currentWave: project.currentWave, totalWaves: project.totalWaves }
  }
}
