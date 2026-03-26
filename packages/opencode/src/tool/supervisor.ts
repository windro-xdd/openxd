import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./supervisor.txt"
import { TaskTool } from "./task"

const step = z.object({
  description: z.string().min(3).describe("Short task label"),
  prompt: z.string().min(1).describe("Detailed task prompt"),
  subagent_type: z.string().min(1).describe("Subagent type to execute"),
  task_id: z.string().optional().describe("Optional existing task session ID to resume"),
})

const params = z.object({
  steps: z.array(step).min(1).max(12).describe("Subtasks to dispatch"),
  max_parallel: z.number().int().min(1).max(8).default(4).describe("Maximum parallel subagents"),
})

type Step = z.infer<typeof step>

type RunResult = {
  idx: number
  ok: boolean
  description: string
  output?: string
  title?: string
  metadata?: Record<string, unknown>
  error?: string
}

async function run(task: Awaited<ReturnType<typeof TaskTool.init>>, s: Step, ctx: Tool.Context) {
  const res = await task.execute(
    {
      description: s.description,
      prompt: s.prompt,
      subagent_type: s.subagent_type,
      task_id: s.task_id,
    },
    ctx,
  )
  return res
}

async function worker(input: {
  task: Awaited<ReturnType<typeof TaskTool.init>>
  steps: Step[]
  start: number
  stride: number
  ctx: Tool.Context
}) {
  const out: RunResult[] = []
  for (let i = input.start; i < input.steps.length; i += input.stride) {
    const s = input.steps[i]
    try {
      const res = await run(input.task, s, input.ctx)
      out.push({
        idx: i,
        ok: true,
        description: s.description,
        title: res.title,
        output: res.output,
        metadata: res.metadata as Record<string, unknown>,
      })
    } catch (err) {
      out.push({
        idx: i,
        ok: false,
        description: s.description,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}

export const SupervisorTool = Tool.define("supervisor", {
  description: DESCRIPTION,
  parameters: params,
  async execute(input, ctx) {
    const task = await TaskTool.init()

    const n = Math.min(input.max_parallel, input.steps.length)
    const parts = await Promise.all(
      Array.from({ length: n }, (_, k) => worker({ task, steps: input.steps, start: k, stride: n, ctx })),
    )
    const rows = parts.flat().sort((a, b) => a.idx - b.idx)
    const ok = rows.filter((x) => x.ok)
    const fail = rows.filter((x) => !x.ok)

    const lines = rows.map((r, i) => {
      if (!r.ok) return `${i + 1}. FAIL - ${r.description}: ${r.error}`
      const sid = (r.metadata?.sessionId as string | undefined) ?? "n/a"
      return `${i + 1}. OK - ${r.description} (task_id: ${sid})`
    })

    return {
      title: `Supervisor (${ok.length}/${rows.length} successful)`,
      output: [
        `Dispatched ${rows.length} subtask(s) with max_parallel=${n}.`,
        "",
        ...lines,
        ...(fail.length
          ? [
              "",
              "Failed subtasks retained progress from successful ones.",
              "Retry only failed items with updated prompts.",
            ]
          : []),
      ].join("\n"),
      metadata: {
        total: rows.length,
        successful: ok.length,
        failed: fail.length,
        task_ids: ok
          .map((r) => r.metadata?.sessionId)
          .filter((x): x is string => typeof x === "string"),
      },
    }
  },
})
