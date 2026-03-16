import z from "zod"

export namespace LoopTypes {
  export const State = z.object({
    active: z.boolean(),
    iteration: z.number(),
    maxIterations: z.number(),
    sessionID: z.string(),
    modeName: z.string(),
    /** Hash of last assistant output for stuck detection */
    lastOutputHash: z.string().nullable(),
    /** Consecutive iterations with same output */
    sameOutputCount: z.number(),
    /** File change count at last check */
    lastFileChangeCount: z.number(),
    /** Consecutive iterations with no file changes */
    noChangeCount: z.number(),
    /** Timestamp when loop started */
    startTime: z.number(),
  })
  export type State = z.infer<typeof State>

  export const Evaluation = z.discriminatedUnion("action", [
    z.object({
      action: z.literal("continue"),
      reason: z.string(),
    }),
    z.object({
      action: z.literal("stop"),
      reason: z.string(),
    }),
    z.object({
      action: z.literal("pause"),
      reason: z.string(),
    }),
  ])
  export type Evaluation = z.infer<typeof Evaluation>
}
