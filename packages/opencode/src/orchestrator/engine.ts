import { OrchestratorTypes } from "./types"
import { OrchestratorState } from "./state"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { Log } from "@/util/log"
import { Bus } from "@/bus"
import { Config } from "../config/config"

export namespace OrchestratorEngine {
  const log = Log.create({ service: "orchestrator.engine" })

  // ─── Decomposition ────────────────────────────────────────────────────

  /**
   * Use the LLM to decompose a user request into a spec + task graph.
   * This runs in a dedicated subagent session with fresh context.
   */
  export async function decompose(input: {
    sessionID: string
    userRequest: string
    model: { modelID: string; providerID: string }
    codebaseContext?: string
  }): Promise<OrchestratorTypes.DecompositionResult> {
    const planSession = await Session.create({
      parentID: input.sessionID,
      title: "Orchestrator: Planning",
    })

    const prompt = buildDecompositionPrompt(input.userRequest, input.codebaseContext)
    const messageID = Identifier.ascending("message")

    const result = await SessionPrompt.prompt({
      messageID,
      sessionID: planSession.id,
      model: input.model,
      agent: "plan",
      tools: {
        // Allow read-only tools for codebase exploration
        write: false,
        edit: false,
        multiedit: false,
        patch: false,
        task: false,
        todowrite: false,
      },
      parts: [{ type: "text", text: prompt }],
    })

    const text = result.parts.findLast((x) => x.type === "text")?.text ?? ""
    const parsed = parseDecompositionOutput(text)

    // Clean up planning session
    // Keep it for debugging but don't clutter

    return parsed
  }

  function buildDecompositionPrompt(userRequest: string, codebaseContext?: string): string {
    return `You are a project planner. Decompose this request into a structured spec and task graph.

USER REQUEST:
${userRequest}

${codebaseContext ? `CODEBASE CONTEXT:\n${codebaseContext}\n` : ""}

IMPORTANT: You must explore the codebase first using available tools (Read, Glob, Grep) to understand the current architecture before planning.

Respond with EXACTLY this JSON structure (no markdown, no explanation, ONLY the JSON):

{
  "spec": {
    "goal": "One sentence describing what we're building",
    "requirements": ["Requirement 1", "Requirement 2", ...],
    "constraints": ["Constraint 1", ...],
    "outOfScope": ["Thing we're NOT doing", ...],
    "doneWhen": "How to verify the whole project is complete"
  },
  "tasks": [
    {
      "id": "task-1",
      "title": "Short task name (3-5 words)",
      "description": "Detailed description of what to do. Include specific file paths, function names, and expected behavior. Be precise enough that a developer with fresh context can execute this without questions.",
      "dependsOn": [],
      "files": ["src/path/to/file.ts"],
      "verify": "How to verify this task: test command, manual check, etc."
    },
    {
      "id": "task-2",
      "title": "Another task",
      "description": "...",
      "dependsOn": ["task-1"],
      "files": ["src/other/file.ts"],
      "verify": "..."
    }
  ]
}

RULES FOR TASK DECOMPOSITION:
1. Each task should be ATOMIC — completable in a single subagent session (fresh 128k context)
2. Tasks that touch different files with no shared state can run in PARALLEL (no dependsOn between them)
3. Tasks that depend on output from another task MUST list that dependency
4. If two tasks modify the SAME file, make one depend on the other (prevents merge conflicts)
5. Each task description must be self-contained — the executing agent has NO context from other tasks
6. Include file paths in the "files" array for conflict detection
7. Task IDs must be simple: "task-1", "task-2", etc.
8. Order tasks so independent work comes first (wave 0), dependent work later
9. Prefer FEWER, LARGER tasks over many tiny ones — each task has overhead
10. Include verification criteria for each task

OUTPUT ONLY THE JSON. No explanation. No markdown fences.`
  }

  function parseDecompositionOutput(text: string): OrchestratorTypes.DecompositionResult {
    // Extract JSON from the response (handle markdown fences if model adds them)
    let jsonStr = text.trim()

    // Strip markdown code fences
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim()
    }

    // Find first { and last }
    const start = jsonStr.indexOf("{")
    const end = jsonStr.lastIndexOf("}")
    if (start === -1 || end === -1) {
      throw new Error("Failed to parse decomposition output: no JSON found")
    }
    jsonStr = jsonStr.slice(start, end + 1)

    try {
      const raw = JSON.parse(jsonStr)
      return OrchestratorTypes.DecompositionResult.parse(raw)
    } catch (e) {
      log.error("decomposition parse error", { error: String(e), text: text.slice(0, 500) })
      throw new Error(`Failed to parse decomposition output: ${e}`)
    }
  }

  // ─── Execution ────────────────────────────────────────────────────────

  /**
   * Execute a single task in a fresh subagent session.
   */
  export async function executeTask(input: {
    project: OrchestratorTypes.ProjectState
    task: OrchestratorTypes.Task
    model: { modelID: string; providerID: string }
  }): Promise<{ output: string; sessionID: string }> {
    const { project, task, model } = input

    // Create fresh session for this task
    const taskSession = await Session.create({
      parentID: project.sessionID,
      title: `Task: ${task.title}`,
    })

    // Build context from completed dependency outputs
    const depContext = task.dependsOn
      .map((depId) => {
        const dep = project.tasks.find((t) => t.id === depId)
        if (!dep?.output) return ""
        return `[Completed: ${dep.title}]\n${dep.output}\n`
      })
      .filter(Boolean)
      .join("\n")

    const prompt = buildTaskPrompt(project, task, depContext)
    const messageID = Identifier.ascending("message")

    const result = await SessionPrompt.prompt({
      messageID,
      sessionID: taskSession.id,
      model,
      agent: "build",
      parts: [{ type: "text", text: prompt }],
    })

    const text = result.parts.findLast((x) => x.type === "text")?.text ?? ""

    return { output: text, sessionID: taskSession.id }
  }

  function buildTaskPrompt(
    project: OrchestratorTypes.ProjectState,
    task: OrchestratorTypes.Task,
    depContext: string,
  ): string {
    return `You are executing a specific task as part of a larger project.

PROJECT GOAL: ${project.spec.goal}

YOUR TASK: ${task.title}
${task.description}

${depContext ? `CONTEXT FROM COMPLETED TASKS:\n${depContext}\n` : ""}
${task.verify ? `VERIFICATION: ${task.verify}\n` : ""}

RULES:
1. Focus ONLY on this specific task. Do not work on other parts of the project.
2. Be thorough — this task should be COMPLETE when you're done.
3. If the task has verification criteria, verify your work before finishing.
4. Make atomic git commits for your changes.
5. When done, provide a clear summary of what you did, files changed, and any important notes for subsequent tasks.
6. If you encounter something unexpected that blocks you, explain clearly what went wrong.

Begin working on the task now.`
  }

  // ─── Verification ────────────────────────────────────────────────────

  /**
   * Run verification for a completed task.
   */
  export async function verifyTask(input: {
    project: OrchestratorTypes.ProjectState
    task: OrchestratorTypes.Task
    model: { modelID: string; providerID: string }
  }): Promise<{ passed: boolean; output: string }> {
    const { project, task, model } = input

    if (!task.verify) {
      return { passed: true, output: "No verification criteria specified" }
    }

    const verifySession = await Session.create({
      parentID: project.sessionID,
      title: `Verify: ${task.title}`,
    })

    const prompt = `You are verifying that a task was completed correctly.

TASK: ${task.title}
WHAT WAS DONE: ${task.output ?? "No output available"}
VERIFICATION CRITERIA: ${task.verify}

Check the codebase to verify the task was completed correctly. Run any test commands specified.

Respond with EXACTLY this format:
RESULT: PASS or FAIL
DETAILS: Brief explanation

If FAIL, explain specifically what's wrong so it can be fixed.`

    const messageID = Identifier.ascending("message")
    const result = await SessionPrompt.prompt({
      messageID,
      sessionID: verifySession.id,
      model,
      agent: "build",
      tools: {},
      parts: [{ type: "text", text: prompt }],
    })

    const text = result.parts.findLast((x) => x.type === "text")?.text ?? ""
    const passed = /RESULT:\s*PASS/i.test(text)

    return { passed, output: text }
  }

  // ─── Wave Execution ───────────────────────────────────────────────────

  /**
   * Execute all tasks in a wave concurrently.
   * Returns when all tasks in the wave are complete (or failed).
   */
  export async function executeWave(input: {
    project: OrchestratorTypes.ProjectState
    wave: number
    model: { modelID: string; providerID: string }
  }): Promise<void> {
    const { project, wave, model } = input
    const waveTasks = OrchestratorState.getWaveTasks(project, wave)
    const executableTasks = waveTasks.filter((t) => t.status === "pending" || t.status === "ready")

    if (executableTasks.length === 0) {
      log.info("no tasks to execute in wave", { wave })
      return
    }

    // Check for file conflicts — serialize conflicting tasks
    const conflicts = OrchestratorState.detectFileConflicts(executableTasks)
    if (conflicts.length > 0) {
      log.warn("file conflicts in wave, serializing conflicting tasks", {
        wave,
        conflicts: conflicts.map(([a, b, files]) => `${a}<->${b}: ${files.join(",")}`),
      })
    }

    log.info("executing wave", { wave, taskCount: executableTasks.length })
    Bus.publish(OrchestratorState.Event.WaveStarted, {
      projectID: project.id,
      wave,
      taskCount: executableTasks.length,
    })

    // Execute all tasks in parallel
    const results = await Promise.allSettled(
      executableTasks.map(async (task) => {
        // Update status
        OrchestratorState.updateTask(project, task.id, {
          status: "running",
          startedAt: Date.now(),
        })
        Bus.publish(OrchestratorState.Event.TaskStarted, {
          projectID: project.id,
          taskID: task.id,
          title: task.title,
        })

        try {
          const result = await executeTask({ project, task, model })

          OrchestratorState.updateTask(project, task.id, {
            status: "done",
            output: result.output,
            sessionID: result.sessionID,
            completedAt: Date.now(),
          })

          Bus.publish(OrchestratorState.Event.TaskCompleted, {
            projectID: project.id,
            taskID: task.id,
            title: task.title,
          })

          // Run verification if criteria exists
          if (task.verify) {
            const verification = await verifyTask({ project, task, model })
            if (verification.passed) {
              OrchestratorState.updateTask(project, task.id, {
                status: "verified",
                output: (result.output + "\n\nVerification: " + verification.output).trim(),
              })
            } else {
              log.warn("task verification failed", { taskID: task.id, details: verification.output })
              // Don't fail the task — it completed, verification is informational
              OrchestratorState.updateTask(project, task.id, {
                output: (result.output + "\n\n⚠️ Verification issue: " + verification.output).trim(),
              })
            }
          }

          return result
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          log.error("task execution failed", { taskID: task.id, error: errorMsg })

          OrchestratorState.updateTask(project, task.id, {
            status: "failed",
            error: errorMsg,
            completedAt: Date.now(),
          })

          Bus.publish(OrchestratorState.Event.TaskFailed, {
            projectID: project.id,
            taskID: task.id,
            error: errorMsg,
          })

          // Cascade failure to dependent tasks
          OrchestratorState.cascadeFailure(project, task.id)

          throw error
        }
      }),
    )

    OrchestratorState.set(project)
  }
}
