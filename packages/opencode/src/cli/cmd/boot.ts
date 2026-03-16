import { cmd } from "./cmd"
import { Instance } from "../../project/instance"
import { bootstrap } from "../bootstrap"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { Server } from "../../server/server"
import { UI } from "../ui"
import { EOL } from "os"
import path from "path"
import { Global } from "../../global"
import { Filesystem } from "../../util/filesystem"

const BOOT_PROMPT = `You are setting up as a new personal assistant. This is your FIRST conversation with your user.

Your job is to:
1. Introduce yourself warmly — you're their new coding assistant that lives on their machine
2. Ask their name and what they'd like to be called
3. Ask about their main focus areas (what kind of work they do — web dev, security, data science, etc.)
4. Ask about their timezone (or detect from system if possible)
5. Ask about their communication preferences (direct/casual/formal, emoji usage, verbosity)
6. Ask what they'd like to name you (their assistant) and what vibe/personality they want
7. Ask about any tools/languages/frameworks they use most

Based on their answers, create these files:
- USER.md — their profile (name, preferences, timezone, focus areas)
- SOUL.md — your personality definition (based on what vibe they want)
- IDENTITY.md — your name, creature type, emoji, description
- MEMORY.md — initial long-term memory with setup notes

Write these files to the working directory using the write tool.

Be conversational and natural. Don't dump all questions at once — have a real back-and-forth conversation.
Start with a brief intro and your first question.

IMPORTANT: After creating all files, tell the user they're all set and how to start using you (just run opencode normally).`

export const BootCommand = cmd({
  command: "boot",
  describe: "first-time setup — introduce yourself to your assistant",
  handler: async () => {
    // Check if already bootstrapped
    const identityFiles = ["SOUL.md", "USER.md", "IDENTITY.md"]
    const projectDir = process.cwd()

    let alreadySetup = false
    for (const file of identityFiles) {
      // Check in project dir, .opencode/, and global config
      const paths = [
        path.join(projectDir, file),
        path.join(projectDir, ".opencode", file),
        path.join(Global.Path.config, file),
      ]
      for (const p of paths) {
        if (await Filesystem.exists(p)) {
          alreadySetup = true
          break
        }
      }
      if (alreadySetup) break
    }

    if (alreadySetup) {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "!",
        UI.Style.TEXT_NORMAL + "Identity files already exist. Run " +
        UI.Style.TEXT_INFO_BOLD + "opencode boot --reset" +
        UI.Style.TEXT_NORMAL + " to start fresh."
      )

      const readline = await import("readline")
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise<string>((resolve) => {
        rl.question("Continue anyway? (y/N) ", resolve)
      })
      rl.close()

      if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
        process.exit(0)
      }
    }

    UI.empty()
    UI.println(UI.Style.TEXT_INFO_BOLD + "⚡" + UI.Style.TEXT_NORMAL + " Starting first-time setup...")
    UI.println(UI.Style.TEXT_DIM + "  Your assistant will ask you a few questions to get to know you." + UI.Style.TEXT_NORMAL)
    UI.empty()

    await bootstrap(process.cwd(), async () => {
      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        return Server.Default().fetch(request)
      }) as typeof globalThis.fetch
      const sdk = createOpencodeClient({ baseUrl: "http://opencode.internal", fetch: fetchFn })

      // Create a session with the boot prompt as system context
      const session = await sdk.session.create({ title: "🚀 First-Time Setup" })
      const sessionID = session.data?.id
      if (!sessionID) {
        UI.error("Failed to create session")
        process.exit(1)
      }

      const events = await sdk.event.subscribe()
      const readline = await import("readline")
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

      let currentText = ""
      let waitingForInput = false

      // Send the boot prompt
      await sdk.session.prompt({
        sessionID,
        parts: [{ type: "text", text: BOOT_PROMPT }],
      })

      // Event loop
      for await (const event of events.stream) {
        if (event.type === "message.part.updated") {
          const part = event.properties.part
          if (part.sessionID !== sessionID) continue

          if (part.type === "text" && part.time?.end) {
            const text = part.text.trim()
            if (!text) continue
            UI.empty()
            UI.println(text)
            UI.empty()
            currentText = text
          }

          if (part.type === "tool" && (part.state.status === "completed" || part.state.status === "error")) {
            const state = part.state
            if (state.status === "completed") {
              const title = ("title" in state ? state.title : "") || part.tool
              UI.println(UI.Style.TEXT_DIM + `  ✓ ${title}` + UI.Style.TEXT_NORMAL)
            } else {
              UI.println(UI.Style.TEXT_DANGER_BOLD + `  ✗ ${part.tool} failed: ${state.error}`)
            }
          }
        }

        if (event.type === "permission.asked") {
          const permission = event.properties
          if (permission.sessionID !== sessionID) continue
          // Auto-approve writes during boot
          if (permission.permission === "write" || permission.permission === "edit") {
            await sdk.permission.reply({ requestID: permission.id, reply: "approve" })
          } else {
            await sdk.permission.reply({ requestID: permission.id, reply: "approve" })
          }
        }

        if (
          event.type === "session.status" &&
          event.properties.sessionID === sessionID &&
          event.properties.status.type === "idle"
        ) {
          if (!waitingForInput) {
            waitingForInput = true

            // Check if setup is complete (all identity files created)
            const allCreated = await checkFilesCreated(projectDir)
            if (allCreated) {
              UI.empty()
              UI.println(UI.Style.TEXT_INFO_BOLD + "✨ Setup complete!" + UI.Style.TEXT_NORMAL)
              UI.println(UI.Style.TEXT_DIM + "  Run " + UI.Style.TEXT_INFO_BOLD + "opencode" + UI.Style.TEXT_DIM + " to start chatting with your assistant." + UI.Style.TEXT_NORMAL)
              UI.empty()
              rl.close()
              process.exit(0)
            }

            // Get user input
            const answer = await new Promise<string>((resolve) => {
              rl.question(UI.Style.TEXT_INFO_BOLD + "You: " + UI.Style.TEXT_NORMAL, resolve)
            })

            if (answer.toLowerCase() === "quit" || answer.toLowerCase() === "exit") {
              rl.close()
              process.exit(0)
            }

            waitingForInput = false

            // Send the user's response
            await sdk.session.prompt({
              sessionID,
              parts: [{ type: "text", text: answer }],
            })
          }
        }
      }
    })
  },
})

async function checkFilesCreated(dir: string): Promise<boolean> {
  const required = ["SOUL.md", "USER.md", "IDENTITY.md"]
  for (const file of required) {
    const paths = [
      path.join(dir, file),
      path.join(dir, ".opencode", file),
      path.join(Global.Path.config, file),
    ]
    let found = false
    for (const p of paths) {
      if (await Filesystem.exists(p)) { found = true; break }
    }
    if (!found) return false
  }
  return true
}
