import { type Tool as AITool, asSchema, jsonSchema, tool, type ToolCallOptions } from "ai"
import { Identifier } from "../id/id"
import { Session } from "."
import { Tool } from "@/tool/tool"
import { PermissionNext } from "@/permission/next"
import { ToolRegistry } from "../tool/registry"
import type { Agent } from "../agent/agent"
import type { Provider } from "../provider/provider"
import type { SessionProcessor } from "./processor"
import { ProviderTransform } from "../provider/transform"
import { Plugin } from "../plugin"
import { Observation } from "../observation/observation"
import { Instance } from "../project/instance"
import { MCP } from "../mcp"
import { Truncate } from "@/tool/truncation"
import { MessageV2 } from "./message-v2"
import z from "zod"

type Input = {
  agent: Agent.Info
  model: Provider.Model
  session: Session.Info
  tools?: Record<string, boolean>
  processor: SessionProcessor.Info
  bypassAgentCheck: boolean
  messages: MessageV2.WithParts[]
  beforeExecute?: (ctx: { tool: string; callID: string; args: unknown }) => Promise<void>
}

type CtxArgs = Record<string, unknown>
type CtxMeta = { title?: string; metadata?: Record<string, unknown> }

type Logger = {
  time(msg: string): { [Symbol.dispose](): void }
  debug(msg: string, data?: Record<string, unknown>): void
}

function toolCtx(input: Input) {
  return (args: CtxArgs, options: ToolCallOptions): Tool.Context => ({
    sessionID: input.session.id,
    abort: options.abortSignal!,
    messageID: input.processor.message.id,
    callID: options.toolCallId,
    extra: { model: input.model, bypassAgentCheck: input.bypassAgentCheck },
    agent: input.agent.name,
    messages: input.messages,
    metadata: async (val: CtxMeta) => {
      const match = input.processor.partFromToolCall(options.toolCallId)
      if (!match || match.state.status !== "running") return
      await Session.updatePart({
        ...match,
        state: {
          title: val.title,
          metadata: val.metadata,
          status: "running",
          input: args,
          time: {
            start: Date.now(),
          },
        },
      })
    },
    async ask(req) {
      await PermissionNext.ask({
        ...req,
        sessionID: input.session.id,
        tool: { messageID: input.processor.message.id, callID: options.toolCallId },
        ruleset: PermissionNext.merge(input.agent.permission, input.session.permission ?? []),
      })
    },
  })
}

function maybe(input: Input, tool: string, callID: string, args: unknown) {
  return input.beforeExecute?.({ tool, callID, args })
}

export async function resolveTools(input: Input, log: Logger): Promise<Record<string, AITool>> {
  using _ = log.time("resolveTools")
  const tools: Record<string, AITool> = {}
  const context = toolCtx(input)

  for (const item of await ToolRegistry.tools(
    { modelID: input.model.api.id, providerID: input.model.providerID },
    input.agent,
  )) {
    const schema = ProviderTransform.schema(input.model, z.toJSONSchema(item.parameters))
    tools[item.id] = tool({
      description: item.description,
      inputSchema: jsonSchema(schema as Parameters<typeof jsonSchema>[0]),
      async execute(args, options) {
        const ctx = context(args as CtxArgs, options)
        await maybe(input, item.id, ctx.callID ?? options.toolCallId, args)
        await Plugin.trigger(
          "tool.execute.before",
          {
            tool: item.id,
            sessionID: ctx.sessionID,
            callID: ctx.callID,
          },
          {
            args,
          },
        )
        const result = await item.execute(args, ctx)
        const output = {
          ...result,
          attachments: result.attachments?.map((attachment) => ({
            ...attachment,
            id: Identifier.ascending("part"),
            sessionID: ctx.sessionID,
            messageID: input.processor.message.id,
          })),
        }
        await Plugin.trigger(
          "tool.execute.after",
          {
            tool: item.id,
            sessionID: ctx.sessionID,
            callID: ctx.callID,
            args,
          },
          output,
        )

        if (output.output) {
          Observation.capture({
            projectId: Instance.project.id,
            sessionId: ctx.sessionID,
            tool: item.id,
            input: args,
            output: output.output,
          }).catch((err) => {
            log.debug("observation capture failed", { err })
          })
        }

        return output
      },
    })
  }

  for (const [key, item] of Object.entries(await MCP.tools())) {
    const execute = item.execute
    if (!execute) continue

    const transformed = ProviderTransform.schema(input.model, asSchema(item.inputSchema).jsonSchema)
    item.inputSchema = jsonSchema(transformed as Parameters<typeof jsonSchema>[0])
    item.execute = async (args, opts) => {
      const ctx = context(args as CtxArgs, opts)
      await maybe(input, key, ctx.callID ?? opts.toolCallId, args)

      await Plugin.trigger(
        "tool.execute.before",
        {
          tool: key,
          sessionID: ctx.sessionID,
          callID: opts.toolCallId,
        },
        {
          args,
        },
      )

      await ctx.ask({
        permission: key,
        metadata: {},
        patterns: ["*"],
        always: ["*"],
      })

      const result = await execute(args, opts)

      await Plugin.trigger(
        "tool.execute.after",
        {
          tool: key,
          sessionID: ctx.sessionID,
          callID: opts.toolCallId,
          args,
        },
        result,
      )

      const text: string[] = []
      const files: Omit<MessageV2.FilePart, "id" | "sessionID" | "messageID">[] = []

      for (const item of result.content) {
        if (item.type === "text") {
          text.push(item.text)
          continue
        }
        if (item.type === "image") {
          files.push({
            type: "file",
            mime: item.mimeType,
            url: `data:${item.mimeType};base64,${item.data}`,
          })
          continue
        }
        if (item.type !== "resource") continue
        if (item.resource.text) {
          text.push(item.resource.text)
        }
        if (item.resource.blob) {
          const mime = item.resource.mimeType ?? "application/octet-stream"
          files.push({
            type: "file",
            mime,
            url: `data:${mime};base64,${item.resource.blob}`,
            filename: item.resource.uri,
          })
        }
      }

      const truncated = await Truncate.output(text.join("\n\n"), {}, input.agent)
      const metadata = {
        ...(result.metadata ?? {}),
        truncated: truncated.truncated,
        ...(truncated.truncated && { outputPath: truncated.outputPath }),
      }

      return {
        title: "",
        metadata,
        output: truncated.content,
        attachments: files.map((attachment) => ({
          ...attachment,
          id: Identifier.ascending("part"),
          sessionID: ctx.sessionID,
          messageID: input.processor.message.id,
        })),
        content: result.content,
      }
    }
    tools[key] = item
  }

  return tools
}
