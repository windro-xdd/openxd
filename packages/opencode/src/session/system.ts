import { Ripgrep } from "../file/ripgrep"

import { Instance } from "../project/instance"

import PROMPT_ANTHROPIC from "./prompt/anthropic.txt"
import PROMPT_ANTHROPIC_WITHOUT_TODO from "./prompt/qwen.txt"
import PROMPT_BEAST from "./prompt/beast.txt"
import PROMPT_GEMINI from "./prompt/gemini.txt"

import PROMPT_CODEX from "./prompt/codex_header.txt"
import PROMPT_TRINITY from "./prompt/trinity.txt"
import PROMPT_TOOL_INTELLIGENCE from "./prompt/tool-intelligence.txt"
import type { Provider } from "@/provider/provider"

export namespace SystemPrompt {
  export function instructions() {
    return PROMPT_CODEX.trim()
  }

  export function provider(model: Provider.Model) {
    const base = (() => {
      if (model.api.id.includes("gpt-5")) return [PROMPT_CODEX]
      if (model.api.id.includes("gpt-") || model.api.id.includes("o1") || model.api.id.includes("o3"))
        return [PROMPT_BEAST]
      if (model.api.id.includes("gemini-")) return [PROMPT_GEMINI]
      if (model.api.id.includes("claude")) return [PROMPT_ANTHROPIC]
      if (model.api.id.toLowerCase().includes("trinity")) return [PROMPT_TRINITY]
      return [PROMPT_ANTHROPIC_WITHOUT_TODO]
    })()
    return [...base, PROMPT_TOOL_INTELLIGENCE]
  }

  export async function environment(model: Provider.Model) {
    const project = Instance.project
    return [
      [
        `You are powered by the model named ${model.api.id}. The exact model ID is ${model.providerID}/${model.api.id}`,
        `Here is some useful information about the environment you are running in:`,
        `<env>`,
        `  Working directory: ${Instance.directory}`,
        `  Is directory a git repo: ${project.vcs === "git" ? "yes" : "no"}`,
        `  Platform: ${process.platform}`,
        `  Today's date: ${new Date().toDateString()}`,
        `</env>`,
        `<directories>`,
        `  ${
          project.vcs === "git" && false
            ? await Ripgrep.tree({
                cwd: Instance.directory,
                limit: 50,
              })
            : ""
        }`,
        `</directories>`,
      ].join("\n"),
      ORCHESTRATOR_PROMPT,
    ]
  }

  const ORCHESTRATOR_PROMPT = `<orchestrator>
You have access to the orchestrate tool for complex, multi-step projects. AUTO-DETECT when to use it.

USE the orchestrate tool when ANY of these are true:
- The request involves 4+ files that need coordinated changes
- The work has clear independent parts that could run in parallel
- The task would take more than 15-20 tool calls to complete manually
- You estimate the work would consume more than 40% of your context window
- The user describes a "feature", "system", "refactor", "migration", or "project"
- Multiple components need to be created/modified in concert (API + UI + tests + config)
- The request involves both backend and frontend changes
- The user says "build", "implement", "create", or "set up" followed by something complex

DO NOT use the orchestrate tool when:
- It's a single file edit or bug fix
- It's a search/read/explore task
- The work is clearly under 5 tool calls
- The user is asking a question, not requesting work
- The change is confined to 1-2 files

When you detect orchestration is needed:
1. Tell the user you're going to orchestrate this as a project
2. Call the orchestrate tool with auto_execute=false to show the plan first
3. After user approves (or says "go", "do it", "yes"), call orchestrate_execute
4. If user says "just do it" or seems confident, use auto_execute=true

The orchestrator gives each task a FRESH context window (full token budget), runs independent tasks in PARALLEL, and verifies results. This is dramatically more efficient and higher quality than doing everything sequentially in one context.
</orchestrator>`
}
