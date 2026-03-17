import { Log } from "../util/log"
import { Config } from "../config/config"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { Global } from "../global"
import path from "path"

const log = Log.create({ service: "heartbeat" })

const HEARTBEAT_PROMPT = `Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer tasks from prior context. If nothing needs attention, reply HEARTBEAT_OK.`

export namespace Heartbeat {
  let timer: ReturnType<typeof setInterval> | null = null
  let heartbeatSessionId: string | null = null

  function isQuietHours(start: string, end: string): boolean {
    const now = new Date()
    const [startH, startM] = start.split(":").map(Number)
    const [endH, endM] = end.split(":").map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (startMinutes <= endMinutes) {
      // Same day range (e.g., 09:00 - 17:00)
      return currentMinutes >= startMinutes && currentMinutes < endMinutes
    } else {
      // Overnight range (e.g., 23:00 - 08:00)
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
  }

  async function findHeartbeatFile(): Promise<string | null> {
    const candidates = [
      path.join(Instance.directory, ".opencode", "HEARTBEAT.md"),
      path.join(Instance.directory, "HEARTBEAT.md"),
      path.join(Global.Path.config, "HEARTBEAT.md"),
    ]

    for (const candidate of candidates) {
      if (await Filesystem.exists(candidate)) {
        return candidate
      }
    }
    return null
  }

  function isEmptyOrComments(content: string): boolean {
    const lines = content.split("\n")
    return lines.every((line) => {
      const trimmed = line.trim()
      return trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("//") || trimmed.startsWith("<!--")
    })
  }

  async function tick() {
    try {
      const config = await Config.get()
      const hbConfig = config.daemon?.heartbeat
      if (!hbConfig?.enabled) return

      // Check quiet hours
      if (hbConfig.quietHours?.start && hbConfig.quietHours?.end) {
        if (isQuietHours(hbConfig.quietHours.start, hbConfig.quietHours.end)) {
          log.info("skipping heartbeat — quiet hours")
          return
        }
      }

      // Find and read HEARTBEAT.md
      const filePath = await findHeartbeatFile()
      if (!filePath) {
        log.info("no HEARTBEAT.md found, skipping")
        return
      }

      const content = await Filesystem.readText(filePath).catch(() => "")
      if (!content || isEmptyOrComments(content)) {
        log.info("HEARTBEAT.md is empty or comments-only, skipping")
        return
      }

      log.info("heartbeat triggered, processing tasks")

      // Create or reuse heartbeat session
      if (!heartbeatSessionId) {
        const session = await Session.create({ title: "Heartbeat" })
        heartbeatSessionId = session.id
        log.info("created heartbeat session", { sessionId: heartbeatSessionId })
      }

      // Verify session still exists
      try {
        await Session.get(heartbeatSessionId)
      } catch {
        const session = await Session.create({ title: "Heartbeat" })
        heartbeatSessionId = session.id
      }

      // Send heartbeat prompt
      await SessionPrompt.prompt({
        sessionID: heartbeatSessionId,
        parts: [
          {
            type: "text",
            text: HEARTBEAT_PROMPT,
          },
        ],
      })
    } catch (err) {
      log.error("heartbeat tick failed", { error: err })
    }
  }

  export async function start() {
    const config = await Config.get()
    const hbConfig = (config as any).daemon?.heartbeat

    if (!hbConfig?.enabled) {
      log.info("heartbeat not enabled, skipping")
      return
    }

    const intervalMs = (hbConfig.intervalMinutes ?? 30) * 60 * 1000
    log.info("starting heartbeat", { intervalMinutes: hbConfig.intervalMinutes ?? 30 })

    // Run first tick after a short delay (let server fully start)
    setTimeout(() => tick(), 10_000)

    timer = setInterval(tick, intervalMs)
  }

  export function stop() {
    if (timer) {
      clearInterval(timer)
      timer = null
      log.info("heartbeat stopped")
    }
  }
}
