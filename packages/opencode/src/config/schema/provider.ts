import z from "zod"
import { ModelsDev } from "../../provider/models"

export const Provider = ModelsDev.Provider.partial()
  .extend({
    whitelist: z.array(z.string()).optional(),
    blacklist: z.array(z.string()).optional(),
    models: z
      .record(
        z.string(),
        ModelsDev.Model.partial().extend({
          variants: z
            .record(
              z.string(),
              z
                .object({
                  disabled: z.boolean().optional().describe("Disable this variant for the model"),
                })
                .catchall(z.any()),
            )
            .optional()
            .describe("Variant-specific configuration"),
        }),
      )
      .optional(),
    options: z
      .object({
        apiKey: z.string().optional(),
        baseURL: z.string().optional(),
        enterpriseUrl: z.string().optional().describe("GitHub Enterprise URL for copilot authentication"),
        setCacheKey: z.boolean().optional().describe("Enable promptCacheKey for this provider (default false)"),
        timeout: z
          .union([
            z
              .number()
              .int()
              .positive()
              .describe(
                "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
              ),
            z.literal(false).describe("Disable timeout for this provider entirely."),
          ])
          .optional()
          .describe(
            "Timeout in milliseconds for requests to this provider. Default is 300000 (5 minutes). Set to false to disable timeout.",
          ),
        chunkTimeout: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Timeout in milliseconds between streamed SSE chunks for this provider. If no chunk arrives within this window, the request is aborted.",
          ),
      })
      .catchall(z.any())
      .optional(),
  })
  .strict()
  .meta({
    ref: "ProviderConfig",
  })
export type Provider = z.infer<typeof Provider>
