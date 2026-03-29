import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { Session } from "../../session"
import { SessionID } from "../../session/schema"
import { bootstrap } from "../bootstrap"
import { UI } from "../ui"
import { Locale } from "../../util/locale"
import { Flag } from "../../flag/flag"
import { Filesystem } from "../../util/filesystem"
import { Process } from "../../util/process"
import { EOL } from "os"
import path from "path"
import { which } from "../../util/which"
import { getDefaultConfig } from "../../session/compaction-v3-config"
import { ToolCache } from "../../session/tool-cache"

function pagerCmd(): string[] {
  const lessOptions = ["-R", "-S"]
  if (process.platform !== "win32") {
    return ["less", ...lessOptions]
  }

  // user could have less installed via other options
  const lessOnPath = which("less")
  if (lessOnPath) {
    if (Filesystem.stat(lessOnPath)?.size) return [lessOnPath, ...lessOptions]
  }

  if (Flag.OPENXD_GIT_BASH_PATH) {
    const less = path.join(Flag.OPENXD_GIT_BASH_PATH, "..", "..", "usr", "bin", "less.exe")
    if (Filesystem.stat(less)?.size) return [less, ...lessOptions]
  }

  const git = which("git")
  if (git) {
    const less = path.join(git, "..", "..", "usr", "bin", "less.exe")
    if (Filesystem.stat(less)?.size) return [less, ...lessOptions]
  }

  // Fall back to Windows built-in more (via cmd.exe)
  return ["cmd", "/c", "more"]
}

export const SessionCommand = cmd({
  command: "session",
  describe: "manage sessions",
  builder: (yargs: Argv) =>
    yargs
      .command(SessionListCommand)
      .command(SessionDeleteCommand)
      .command(SessionCompactCommand)
      .command(SessionContextCommand)
      .command(SessionReadCacheCommand)
      .demandCommand(),
  async handler() {},
})

export const SessionDeleteCommand = cmd({
  command: "delete <sessionID>",
  describe: "delete a session",
  builder: (yargs: Argv) => {
    return yargs.positional("sessionID", {
      describe: "session ID to delete",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const sessionID = SessionID.make(args.sessionID)
      try {
        await Session.get(sessionID)
      } catch {
        UI.error(`Session not found: ${args.sessionID}`)
        process.exit(1)
      }
      await Session.remove(sessionID)
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Session ${args.sessionID} deleted` + UI.Style.TEXT_NORMAL)
    })
  },
})

export const SessionListCommand = cmd({
  command: "list",
  describe: "list sessions",
  builder: (yargs: Argv) => {
    return yargs
      .option("max-count", {
        alias: "n",
        describe: "limit to N most recent sessions",
        type: "number",
      })
      .option("format", {
        describe: "output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const sessions = [...Session.list({ roots: true, limit: args.maxCount })]

      if (sessions.length === 0) {
        return
      }

      let output: string
      if (args.format === "json") {
        output = formatSessionJSON(sessions)
      } else {
        output = formatSessionTable(sessions)
      }

      const shouldPaginate = process.stdout.isTTY && !args.maxCount && args.format === "table"

      if (shouldPaginate) {
        const proc = Process.spawn(pagerCmd(), {
          stdin: "pipe",
          stdout: "inherit",
          stderr: "inherit",
        })

        if (!proc.stdin) {
          console.log(output)
          return
        }

        proc.stdin.write(output)
        proc.stdin.end()
        await proc.exited
      } else {
        console.log(output)
      }
    })
  },
})

function formatSessionTable(sessions: Session.Info[]): string {
  const lines: string[] = []

  const maxIdWidth = Math.max(20, ...sessions.map((s) => s.id.length))
  const maxTitleWidth = Math.max(25, ...sessions.map((s) => s.title.length))

  const header = `Session ID${" ".repeat(maxIdWidth - 10)}  Title${" ".repeat(maxTitleWidth - 5)}  Updated`
  lines.push(header)
  lines.push("─".repeat(header.length))
  for (const session of sessions) {
    const truncatedTitle = Locale.truncate(session.title, maxTitleWidth)
    const timeStr = Locale.todayTimeOrDateTime(session.time.updated)
    const line = `${session.id.padEnd(maxIdWidth)}  ${truncatedTitle.padEnd(maxTitleWidth)}  ${timeStr}`
    lines.push(line)
  }

  return lines.join(EOL)
}

function formatSessionJSON(sessions: Session.Info[]): string {
  const jsonData = sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updated: session.time.updated,
    created: session.time.created,
    projectId: session.projectID,
    directory: session.directory,
  }))
  return JSON.stringify(jsonData, null, 2)
}

export const SessionCompactCommand = cmd({
  command: "compact [sessionID]",
  describe: "manually trigger context compaction for a session",
  builder: (yargs: Argv) => {
    return yargs
      .positional("sessionID", {
        describe: "session ID (optional, shows current if not provided)",
        type: "string",
      })
      .option("focus", {
        describe: "focus hint for what to keep (e.g., 'recent-files', 'todos')",
        type: "string",
      })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const cfg = getDefaultConfig()
      if (!cfg.microcompaction?.enabled) {
        UI.error("Microcompaction is disabled in config")
        process.exit(1)
      }

      const cacheDir = cfg.microcompaction.cachePath
      try {
        const stats = await Filesystem.stat(cacheDir)
        if (!stats) {
          UI.println("No cached tool outputs found")
          return
        }

        UI.println(UI.Style.TEXT_SUCCESS + `Compaction cache: ${cacheDir}` + UI.Style.TEXT_NORMAL)
        UI.println(`Status: Ready for compaction`)
        if (args.focus) {
          UI.println(`Focus hint: ${args.focus}`)
        }
        UI.println(`To trigger automatic compaction, the session must reach the headroom threshold`)
      } catch (err) {
        UI.println("No cached tool outputs found yet")
      }
    })
  },
})

export const SessionContextCommand = cmd({
  command: "context [sessionID]",
  describe: "show context headroom metrics and cache statistics",
  builder: (yargs: Argv) => {
    return yargs.positional("sessionID", {
      describe: "session ID (optional)",
      type: "string",
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const cfg = getDefaultConfig()

      UI.println(UI.Style.TEXT_NORMAL_BOLD + "Compaction V3 Configuration" + UI.Style.TEXT_NORMAL)
      UI.println("")

      // Microcompaction
      UI.println(UI.Style.TEXT_NORMAL_BOLD + "Layer 1: Microcompaction" + UI.Style.TEXT_NORMAL)
      if (cfg.microcompaction?.enabled) {
        UI.println(`  Enabled: ${UI.Style.TEXT_SUCCESS}yes${UI.Style.TEXT_NORMAL}`)
        UI.println(`  Output threshold: ${cfg.microcompaction.outputThresholdTokens} tokens`)
        UI.println(`  Cache path: ${cfg.microcompaction.cachePath}`)
        UI.println(`  Hot tail size: ${cfg.microcompaction.hotTailSize} recent outputs`)
      } else {
        UI.println(`  Enabled: ${UI.Style.TEXT_DANGER}no${UI.Style.TEXT_NORMAL}`)
      }
      UI.println("")

      // Headroom
      UI.println(UI.Style.TEXT_NORMAL_BOLD + "Layer 2: Headroom-Based Trigger" + UI.Style.TEXT_NORMAL)
      if (cfg.headroom?.enabled) {
        UI.println(`  Enabled: ${UI.Style.TEXT_SUCCESS}yes${UI.Style.TEXT_NORMAL}`)
        UI.println(`  Minimum headroom: ${cfg.headroom.minimumHeadroom} tokens`)
        UI.println(`  Output reserve: ${cfg.headroom.outputHeadroom} tokens`)
        UI.println(`  Compaction reserve: ${cfg.headroom.compactionHeadroom} tokens`)
        UI.println(`  Trigger urgency: ${cfg.headroom.triggerUrgency}`)
      } else {
        UI.println(`  Enabled: ${UI.Style.TEXT_DANGER}no${UI.Style.TEXT_NORMAL}`)
      }
      UI.println("")

      // Rehydration
      UI.println(UI.Style.TEXT_NORMAL_BOLD + "Layer 3: Rehydration" + UI.Style.TEXT_NORMAL)
      if (cfg.rehydration?.enabled) {
        UI.println(`  Enabled: ${UI.Style.TEXT_SUCCESS}yes${UI.Style.TEXT_NORMAL}`)
        UI.println(`  Recent files: ${cfg.rehydration.recentFileCount}`)
        UI.println(`  Restore config: ${cfg.rehydration.rehydrateConfig ? "yes" : "no"}`)
        UI.println(`  Restore todos: ${cfg.rehydration.rehydrateTodoList ? "yes" : "no"}`)
      } else {
        UI.println(`  Enabled: ${UI.Style.TEXT_DANGER}no${UI.Style.TEXT_NORMAL}`)
      }
      UI.println("")

      // Cache stats
      UI.println(UI.Style.TEXT_NORMAL_BOLD + "Cache Statistics" + UI.Style.TEXT_NORMAL)
      try {
        const cacheDir = cfg.microcompaction?.cachePath || "./.openxd/tool_cache"
        const cacheResult = await ToolCache.list(cacheDir)
        if (cacheResult.success) {
          UI.println(`  Cached outputs: ${cacheResult.entries.length}`)
          UI.println(`  Total tokens: ${cacheResult.totalTokens}`)
          if (cacheResult.entries.length > 0) {
            UI.println(`  Recent entries:`)
            cacheResult.entries.slice(-5).forEach((e) => {
              UI.println(`    - ${e.metadata.tool}: ${e.metadata.tokens} tokens`)
            })
          }
        } else {
          UI.println(`  Cache not found or inaccessible`)
        }
      } catch (err) {
        UI.println(`  Cache not found or inaccessible`)
      }
    })
  },
})

export const SessionReadCacheCommand = cmd({
  command: "read-cache <path>",
  describe: "retrieve and display a cached tool output",
  builder: (yargs: Argv) => {
    return yargs.positional("path", {
      describe: "path to cached file (relative to cache dir or absolute)",
      type: "string",
      demandOption: true,
    })
  },
  handler: async (args) => {
    await bootstrap(process.cwd(), async () => {
      const cfg = getDefaultConfig()
      const cacheDir = cfg.microcompaction?.cachePath || "./.openxd/tool_cache"

      try {
        const result = await ToolCache.retrieve(args.path as string)

        if (!result.success) {
          UI.error(`Failed to retrieve cache: ${result.error}`)
          process.exit(1)
        }

        UI.println(UI.Style.TEXT_NORMAL_BOLD + `Cached output from: ${args.path}` + UI.Style.TEXT_NORMAL)
        if (result.entry) {
          UI.println(`Tool: ${result.entry.metadata.tool}`)
          UI.println(`Tokens: ${result.entry.metadata.tokens}`)
          UI.println(`Size: ${result.entry.metadata.size} bytes`)
          UI.println("")
        }
        UI.println(result.output || "")
      } catch (err) {
        UI.error(`Failed to retrieve cache: ${String(err)}`)
        process.exit(1)
      }
    })
  },
})
