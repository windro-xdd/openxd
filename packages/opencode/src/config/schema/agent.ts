import z from "zod"
import { Permission } from "./permission"

const ModelId = z.string().meta({ $ref: "https://models.dev/model-schema.json#/$defs/Model" })

export const Agent = z
  .object({
    model: ModelId.optional(),
    variant: z
      .string()
      .optional()
      .describe("Default model variant for this agent (applies only when using the agent's configured model)."),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    prompt: z.string().optional(),
    tools: z.record(z.string(), z.boolean()).optional().describe("@deprecated Use 'permission' field instead"),
    disable: z.boolean().optional(),
    description: z.string().optional().describe("Description of when to use the agent"),
    mode: z.enum(["subagent", "primary", "all"]).optional(),
    hidden: z
      .boolean()
      .optional()
      .describe("Hide this subagent from the @ autocomplete menu (default: false, only applies to mode: subagent)"),
    options: z.record(z.string(), z.any()).optional(),
    color: z
      .union([
        z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color format"),
        z.enum(["primary", "secondary", "accent", "success", "warning", "error", "info"]),
      ])
      .optional()
      .describe("Hex color code (e.g., #FF5733) or theme color (e.g., primary)"),
    steps: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of agentic iterations before forcing text-only response"),
    maxSteps: z.number().int().positive().optional().describe("@deprecated Use 'steps' field instead."),
    permission: Permission.optional(),
  })
  .catchall(z.any())
  .transform((agent) => {
    const knownKeys = new Set([
      "name",
      "model",
      "variant",
      "prompt",
      "description",
      "temperature",
      "top_p",
      "mode",
      "hidden",
      "tools",
      "disable",
      "options",
      "color",
      "steps",
      "maxSteps",
      "permission",
    ])

    const options: Record<string, unknown> = { ...agent.options }
    for (const [key, value] of Object.entries(agent)) {
      if (!knownKeys.has(key)) options[key] = value
    }

    const permission: Record<string, "ask" | "allow" | "deny" | Record<string, "ask" | "allow" | "deny">> = {}
    for (const [tool, enabled] of Object.entries(agent.tools ?? {})) {
      const action = enabled ? "allow" : "deny"
      if (tool === "write" || tool === "edit" || tool === "patch" || tool === "multiedit") {
        permission.edit = action
      } else {
        permission[tool] = action
      }
    }
    Object.assign(permission, agent.permission)

    const steps = agent.steps ?? agent.maxSteps

    return {
      ...agent,
      options,
      permission,
      steps,
    } as typeof agent & {
      options?: Record<string, unknown>
      permission?: Record<string, "ask" | "allow" | "deny" | Record<string, "ask" | "allow" | "deny">>
      steps?: number
    }
  })
  .meta({
    ref: "AgentConfig",
  })
export type Agent = z.infer<typeof Agent>

export const Command = z.object({
  template: z.string(),
  description: z.string().optional(),
  agent: z.string().optional(),
  model: ModelId.optional(),
  subtask: z.boolean().optional(),
})
export type Command = z.infer<typeof Command>

export const Skills = z.object({
  paths: z.array(z.string()).optional().describe("Additional paths to skill folders"),
  urls: z
    .array(z.string())
    .optional()
    .describe("URLs to fetch skills from (e.g., https://example.com/.well-known/skills/)"),
})
export type Skills = z.infer<typeof Skills>
