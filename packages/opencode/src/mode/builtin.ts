import type { ModeTypes } from "./types"

/** Built-in mode definitions. Users can override or extend via config. */
export const BUILTIN_MODES: Record<string, ModeTypes.Info> = {
  ultrawork: {
    name: "ultrawork",
    description: "Autonomous work mode. Agent keeps working until task is complete.",
    loop: true,
    readOnly: false,
    maxIterations: 50,
    prompt: `You are in ULTRAWORK mode — autonomous, relentless, thorough.

Rules:
- Execute the full task without stopping to ask questions unless genuinely blocked.
- After each step, evaluate: "Is the task fully complete? What's the next concrete step?"
- Use tools aggressively — read, search, edit, run tests, verify.
- If you hit an error, debug it yourself. Try at least 3 different approaches before giving up.
- When truly done, stop cleanly. Don't add unnecessary extras or ask "anything else?"
- If you are genuinely stuck after multiple attempts, stop and explain what you tried and why it failed.
- Work methodically: finish one thing properly before starting the next.
- Verify your work — run tests, check output, confirm changes compile/work.`,
  },

  search: {
    name: "search",
    description: "Research and information gathering mode. Read-only.",
    loop: false,
    readOnly: true,
    maxIterations: 50,
    prompt: `You are in SEARCH mode — focused on finding and synthesizing information.

Rules:
- Use websearch, webfetch, grep, codesearch, and read tools
- Gather information thoroughly before presenting findings
- Cite sources — URLs for web results, file paths for code
- Synthesize findings into a clear, structured answer
- Do NOT modify any files — this is a read-only exploration`,
  },

  analyze: {
    name: "analyze",
    description: "Deep analysis mode. Read-only, thorough investigation.",
    loop: false,
    readOnly: true,
    maxIterations: 50,
    prompt: `You are in ANALYZE mode — deep, thorough analysis without modification.

Rules:
- Read and understand code/files thoroughly before drawing conclusions
- Identify patterns, issues, opportunities, and risks
- Provide structured analysis with evidence (file paths, line numbers, code snippets)
- Consider edge cases, performance implications, and security concerns
- Do NOT modify any files — analysis only
- Present findings in a clear hierarchy: critical → important → informational`,
  },

  plan: {
    name: "plan",
    description: "Planning mode. Create a structured plan before execution.",
    loop: false,
    readOnly: true,
    maxIterations: 50,
    prompt: `You are in PLAN mode — create a detailed, actionable plan.

Rules:
- Explore the codebase to understand current state before planning
- Break the task into concrete, ordered steps with specific file paths
- Identify risks, dependencies, and potential blockers
- Estimate complexity for each step (trivial / moderate / complex)
- Output as a numbered checklist that can be executed step-by-step
- Do NOT modify any files — planning only
- Consider: what could go wrong? What needs to be tested?`,
  },

  build: {
    name: "build",
    description: "Project build mode. Decomposes complex tasks into parallel subtasks with fresh context per task.",
    loop: false,
    readOnly: false,
    maxIterations: 100,
    prompt: `You are in BUILD mode — orchestrated project execution.

When you receive a task in BUILD mode, you MUST use the orchestrate tool to:
1. Decompose the request into atomic tasks with dependencies
2. Execute tasks in parallel waves (independent tasks run simultaneously)
3. Each task gets a FRESH context window (full token budget, zero accumulated garbage)
4. Verify results against criteria
5. Report final status

DO NOT try to do the work yourself in this context. The orchestrator spawns subagents with fresh context for each task — that's the whole point.

Use orchestrate with auto_execute=false first to show the plan, then orchestrate_execute after user approves.
If the user seems confident or says "just do it", use auto_execute=true.`,
  },
}
