import z from "zod"

export namespace OrchestratorTypes {
  // ─── Task Graph ───────────────────────────────────────────────────────

  export const TaskStatus = z.enum([
    "pending",    // waiting for dependencies
    "ready",      // dependencies met, can execute
    "running",    // subagent is working on it
    "done",       // completed successfully
    "failed",     // execution failed
    "skipped",    // skipped (dependency failed)
    "verified",   // passed verification
  ])
  export type TaskStatus = z.infer<typeof TaskStatus>

  export const Task = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    /** Which tasks must complete before this one starts */
    dependsOn: z.array(z.string()).default([]),
    /** Which files this task will modify (for conflict detection) */
    files: z.array(z.string()).default([]),
    /** Verification criteria — how to confirm this task worked */
    verify: z.string().optional(),
    status: TaskStatus.default("pending"),
    /** Session ID of the subagent executing this task */
    sessionID: z.string().optional(),
    /** Wave number (computed from dependencies) */
    wave: z.number().default(0),
    /** Error message if failed */
    error: z.string().optional(),
    /** Output summary from the subagent */
    output: z.string().optional(),
    /** Start/end timestamps */
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
  })
  export type Task = z.infer<typeof Task>

  // ─── Project Spec ─────────────────────────────────────────────────────

  export const Spec = z.object({
    /** What we're building — one sentence */
    goal: z.string(),
    /** Key requirements extracted from user input */
    requirements: z.array(z.string()),
    /** Technical constraints / preferences */
    constraints: z.array(z.string()).default([]),
    /** Out of scope — explicitly excluded */
    outOfScope: z.array(z.string()).default([]),
    /** Verification: how to know the whole project is done */
    doneWhen: z.string(),
  })
  export type Spec = z.infer<typeof Spec>

  // ─── Orchestration State ──────────────────────────────────────────────

  export const ProjectState = z.object({
    id: z.string(),
    spec: Spec,
    tasks: z.array(Task),
    /** Current wave being executed */
    currentWave: z.number().default(0),
    /** Total waves computed */
    totalWaves: z.number().default(0),
    status: z.enum(["planning", "executing", "verifying", "done", "failed"]).default("planning"),
    createdAt: z.number(),
    updatedAt: z.number(),
    /** Parent session that owns this project */
    sessionID: z.string(),
    /** Git commit before project started (for rollback) */
    baseCommit: z.string().optional(),
  })
  export type ProjectState = z.infer<typeof ProjectState>

  // ─── Decomposition Request/Result ─────────────────────────────────────

  export const DecompositionResult = z.object({
    spec: Spec,
    tasks: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      dependsOn: z.array(z.string()).default([]),
      files: z.array(z.string()).default([]),
      verify: z.string().optional(),
    })),
  })
  export type DecompositionResult = z.infer<typeof DecompositionResult>
}
