import { type Tool as AITool, tool, jsonSchema } from "ai"

const STRUCTURED_OUTPUT_DESCRIPTION = `Use this tool to return your final response in the requested structured format.

IMPORTANT:
- You MUST call this tool exactly once at the end of your response
- The input must be valid JSON matching the required schema
- Complete all necessary research and tool calls BEFORE calling this tool
- This tool provides your final answer - no further actions are taken after calling it`

export const STRUCTURED_OUTPUT_SYSTEM_PROMPT = `IMPORTANT: The user has requested structured output. You MUST use the StructuredOutput tool to provide your final response. Do NOT respond with plain text - you MUST call the StructuredOutput tool with your answer formatted according to the schema.`

type Schema = Record<string, unknown>

export function createStructuredOutputTool(input: { schema: Schema; onSuccess: (output: unknown) => void }): AITool {
  const raw = input.schema
  const toolSchema = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== "$schema"))

  const result = tool({
    description: STRUCTURED_OUTPUT_DESCRIPTION,
    inputSchema: jsonSchema(toolSchema),
    async execute(args) {
      input.onSuccess(args)
      return {
        output: "Structured output captured successfully.",
        title: "Structured Output",
        metadata: { valid: true },
      }
    },
    toModelOutput(result) {
      return {
        type: "text",
        value: result.output,
      }
    },
  })
  Object.assign(result, { id: "StructuredOutput" })
  return result
}
