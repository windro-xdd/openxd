import { Tool } from "./tool"
import DESCRIPTION from "./also.txt"
import z from "zod"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
import { Identifier } from "../id/id"
import { Agent } from "../agent/agent"
import { SessionPrompt } from "../session/prompt"
import { Log } from "../util/log"
import { Bus } from "../bus"

const log = Log.create({ service: "also" })

const parameters = z.object({
  task: z.string().describe("The task to run in parallel. Be specific about what needs to be done."),
  description: z.string().describe("A short (3-5 words) label for this parallel task"),
})

export const AlsoTool = Tool.define("also", async (ctx) => {
  return {
    description: DESCRIPTION,
    parameters,
    async execute(params: z.infer<typeof parameters>, ctx) {
      // 1. Fork the current session — copies full conversation context
      const forkedSession = await Session.fork({
        sessionID: ctx.sessionID,
      })

      log.info("forked session for /also", {
        parentSession: ctx.sessionID,
        forkedSession: forkedSession.id,
        task: params.description,
      })

      // 2. Get the current model from the triggering message
      const msg = await MessageV2.get({
        sessionID: ctx.sessionID,
        messageID: ctx.messageID,
      })
      if (msg.info.role !== "assistant") throw new Error("Not an assistant message")

      const model = {
        modelID: (msg.info as any).modelID as string,
        providerID: (msg.info as any).providerID as string,
      }

      // 3. Get the agent for the forked session
      const agents = await Agent.list()
      const coder = agents.find((a) => a.mode === "subagent") ?? agents.find((a) => a.mode === "primary")
      const agentName = coder?.name ?? "coder"

      ctx.metadata({
        title: `⚡ ${params.description}`,
        metadata: {
          sessionId: forkedSession.id,
          model,
          status: "running",
        },
      })

      // 4. Run the task asynchronously in the forked session
      const taskPromise = (async () => {
        try {
          const messageID = Identifier.ascending("message")
          const result = await SessionPrompt.prompt({
            messageID,
            sessionID: forkedSession.id,
            model: {
              modelID: model.modelID,
              providerID: model.providerID,
            },
            agent: agentName,
            parts: [
              {
                type: "text",
                text: params.task,
              },
            ],
          })

          const resultText =
            result.parts.findLast((x) => x.type === "text")?.text ?? "Task completed (no text output)"

          // 5. Inject the result back into the parent session
          const parentMessageID = Identifier.ascending("message")
          await Session.updateMessage({
            id: parentMessageID,
            sessionID: ctx.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: agentName,
            model,
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            messageID: parentMessageID,
            sessionID: ctx.sessionID,
            type: "text",
            text: [
              `## ⚡ Parallel Task Completed: ${params.description}`,
              "",
              `The following work was done in parallel:`,
              "",
              resultText,
              "",
              "---",
              "_Merged from /also session._",
            ].join("\n"),
          })

          // 6. Notify via bus event
          Bus.publish(Session.Event.Updated, {
            info: await Session.get(ctx.sessionID).then((s) => s!),
          })

          log.info("/also task completed", {
            parentSession: ctx.sessionID,
            forkedSession: forkedSession.id,
            task: params.description,
          })

          // 7. Clean up — delete the forked session
          await Session.remove(forkedSession.id)

          return resultText
        } catch (error) {
          log.error("/also task failed", {
            parentSession: ctx.sessionID,
            forkedSession: forkedSession.id,
            error,
          })

          // Inject error into parent
          const parentMessageID = Identifier.ascending("message")
          await Session.updateMessage({
            id: parentMessageID,
            sessionID: ctx.sessionID,
            role: "user",
            time: { created: Date.now() },
            agent: agentName,
            model,
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            messageID: parentMessageID,
            sessionID: ctx.sessionID,
            type: "text",
            text: [
              `## ❌ Parallel Task Failed: ${params.description}`,
              "",
              `Error: ${error instanceof Error ? error.message : String(error)}`,
              "",
              "_From /also session._",
            ].join("\n"),
          })

          await Session.remove(forkedSession.id).catch(() => {})
          throw error
        }
      })()

      // Don't await — runs in background
      taskPromise.catch(() => {})

      return {
        title: `⚡ ${params.description}`,
        metadata: {
          sessionId: forkedSession.id,
          model,
          status: "running",
        },
        output: [
          `Parallel task started: **${params.description}**`,
          "",
          `Task: ${params.task}`,
          "",
          `Running in background with full conversation context.`,
          `Results will merge back when complete. Continue working.`,
          "",
          `Session: ${forkedSession.id}`,
        ].join("\n"),
      }
    },
  }
})
