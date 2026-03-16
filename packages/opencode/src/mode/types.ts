import z from "zod"

export namespace ModeTypes {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      /** Enable autonomous loop — agent keeps working until task is complete */
      loop: z.boolean().default(false),
      /** Disable write/edit tools — read-only exploration */
      readOnly: z.boolean().default(false),
      /** Maximum loop iterations before forced stop */
      maxIterations: z.number().default(50),
      /** System prompt injection when mode is active */
      prompt: z.string().optional(),
      /** Override specific tool permissions */
      tools: z.record(z.string(), z.boolean()).optional(),
      /** Override model for this mode */
      model: z
        .object({
          providerID: z.string(),
          modelID: z.string(),
        })
        .optional(),
    })
    .meta({ ref: "Mode" })

  export type Info = z.infer<typeof Info>

  export const DetectionResult = z.object({
    mode: z.string(),
    cleanText: z.string(),
  })
  export type DetectionResult = z.infer<typeof DetectionResult>
}
