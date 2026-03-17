import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { Server } from "../../server/server"
import { UI } from "../ui"
import path from "path"
import os from "os"
import fs from "fs/promises"
import { Global } from "../../global"
import { Filesystem } from "../../util/filesystem"

const IDENTITY_FILES = ["SOUL.md", "USER.md", "IDENTITY.md"]

function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "Unknown"
  }
}

function prompt() {
  const dir = Global.Path.config
  const tz = timezone()
  const username = os.userInfo().username

  return `You are being set up for the first time. This is your BOOTSTRAP conversation — a one-time ritual to get to know your human.

## Context
- Config directory: ${dir}
- System timezone: ${tz}
- OS username: ${username}
- OS: ${process.platform} ${process.arch}

## How this works
Have a natural, relaxed conversation. Don't interrogate. Don't be robotic. Just... talk.

Ask ONE question at a time. Wait for the answer before asking the next.

## What to discover (in roughly this order)

1. **Who they are** — their name, what to call them
2. **What they do** — main domain (web dev, security, data science, devops, mobile, etc.), languages/frameworks they use most
3. **How they want you to be** — your name, personality (direct? casual? snarky? warm?), emoji usage, verbosity level
4. **Preferences** — any strong opinions on code style, tools, workflow they want you to know

Don't ask about timezone — you already know it's ${tz}.

## What to create

After gathering enough info (usually 4-6 exchanges), write these files to \`${dir}/\`:

### ${dir}/USER.md
\`\`\`markdown
# USER.md
- Name: [their name]
- Timezone: ${tz}
- Preferences: [their stated preferences]
- Domain: [their main focus]
- Stack: [languages/frameworks they mentioned]
\`\`\`

### ${dir}/SOUL.md
\`\`\`markdown
# SOUL.md
[personality definition based on what vibe they want — keep it 2-4 lines, punchy]
\`\`\`

### ${dir}/IDENTITY.md
\`\`\`markdown
# IDENTITY.md
- Name: [the name they chose for you]
- Vibe: [one-line description]
\`\`\`

### ${dir}/MEMORY.md
\`\`\`markdown
# MEMORY.md
[initial memory — summarize setup conversation, key facts about the user]
\`\`\`

### ${dir}/memory/
Create this directory too.

## Rules
- Write ALL files to ${dir}/ — not the current working directory
- Be warm but not cringe. No "I'm SO excited to meet you!" energy.
- Start with a brief, natural intro. Something like "Hey — I'm your new coding assistant. Let's get set up. What's your name?"
- After creating files, tell them they're good to go — just run \`openxd\` to start.
- If they seem impatient, skip ahead and create files with reasonable defaults.`
}

export async function needsBoot(): Promise<boolean> {
  for (const file of IDENTITY_FILES) {
    const paths = [
      path.join(Global.Path.config, file),
      path.join(process.cwd(), ".opencode", file),
      path.join(process.cwd(), file),
    ]
    for (const p of paths) {
      if (await Filesystem.exists(p)) return false
    }
  }
  return true
}

export const BootCommand = cmd({
  command: "boot",
  describe: "first-time setup — introduce yourself to your assistant",
  builder: (yargs) =>
    yargs.option("reset", {
      type: "boolean",
      describe: "start fresh, overwrite existing identity files",
    }),
  handler: async (args) => {
    const reset = args.reset as boolean | undefined
    const fresh = await needsBoot()

    if (!fresh && !reset) {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "!",
        UI.Style.TEXT_NORMAL +
          " Identity files already exist. Run " +
          UI.Style.TEXT_INFO_BOLD +
          "openxd boot --reset" +
          UI.Style.TEXT_NORMAL +
          " to start fresh.",
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

    if (reset) {
      // Remove existing files so the model creates fresh ones
      for (const file of [...IDENTITY_FILES, "MEMORY.md"]) {
        const p = path.join(Global.Path.config, file)
        if (await Filesystem.exists(p)) await fs.rm(p)
      }
    }

    UI.empty()
    UI.println(UI.Style.TEXT_INFO_BOLD + "  Setting up your assistant..." + UI.Style.TEXT_NORMAL)
    UI.println(UI.Style.TEXT_DIM + "  Answer a few questions and you'll be ready to go." + UI.Style.TEXT_NORMAL)
    UI.empty()

    await bootstrap(process.cwd(), async () => {
      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        return Server.Default().fetch(request)
      }) as typeof globalThis.fetch
      const sdk = createOpencodeClient({ baseUrl: "http://opencode.internal", fetch: fetchFn })

      const session = await sdk.session.create({ title: "First-Time Setup" })
      const sessionID = session.data?.id
      if (!sessionID) {
        UI.error("Failed to create session")
        process.exit(1)
      }

      const events = await sdk.event.subscribe()
      const readline = await import("readline")
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

      let waiting = false

      await sdk.session.prompt({
        sessionID,
        parts: [{ type: "text", text: prompt() }],
      })

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
          const perm = event.properties
          if (perm.sessionID !== sessionID) continue
          // Auto-approve all file writes during boot
          await sdk.permission.reply({ requestID: perm.id, reply: "always" })
        }

        if (
          event.type === "session.status" &&
          event.properties.sessionID === sessionID &&
          event.properties.status.type === "idle"
        ) {
          if (waiting) continue
          waiting = true

          // Check if setup is done
          if (!(await needsBoot())) {
            UI.empty()
            UI.println(UI.Style.TEXT_SUCCESS_BOLD + "  Setup complete!" + UI.Style.TEXT_NORMAL)
            UI.println(
              UI.Style.TEXT_DIM +
                "  Run " +
                UI.Style.TEXT_INFO_BOLD +
                "openxd" +
                UI.Style.TEXT_DIM +
                " to start." +
                UI.Style.TEXT_NORMAL,
            )
            UI.empty()
            rl.close()
            process.exit(0)
          }

          const answer = await new Promise<string>((resolve) => {
            rl.question(UI.Style.TEXT_INFO_BOLD + "You: " + UI.Style.TEXT_NORMAL, resolve)
          })

          if (answer.toLowerCase() === "quit" || answer.toLowerCase() === "exit") {
            rl.close()
            process.exit(0)
          }

          waiting = false

          await sdk.session.prompt({
            sessionID,
            parts: [{ type: "text", text: answer }],
          })
        }
      }
    })
  },
})
