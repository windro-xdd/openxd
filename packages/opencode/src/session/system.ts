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
      SUPERVISOR_PROMPT,
    ]
  }

  const SUPERVISOR_PROMPT = `<execution>
For complex implementation work, act as a parent coordinator inside the current session:
- Create a short task wave.
- Spawn specialized subagents with the task tool.
- Run independent subtasks in parallel.
- Merge outputs, verify, and launch the next wave.
- Repeat until acceptance criteria are met.

Communication rule:
- Keep this internal. Do not describe orchestration mechanics unless the user asks.
</execution>`
}
