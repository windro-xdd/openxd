import { cmd } from "./cmd"
import { Config } from "../../config/config"
import { UI } from "../ui"

const DEFAULT_MODELS = [
  "github-copilot/claude-opus-4.6",
  "github-copilot/claude-sonnet-4.6",
  "github-copilot/claude-opus-4.5",
  "github-copilot/claude-sonnet-4.5",
  "github-copilot/gpt-5.3-codex",
  "github-copilot/gpt-5.4",
]

const OnCommand = cmd({
  command: "on",
  describe: "Enable rate limit fallback — agent will cycle through fallback models when rate limited",
  builder: (yargs) => yargs,
  handler: async () => {
    const cfg = await Config.get()
    const models = cfg.rateLimitFallback?.models ?? DEFAULT_MODELS
    await Config.updateGlobal({
      rateLimitFallback: { enabled: true, models },
    } as any)
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + "Rate limit fallback: ON" + UI.Style.TEXT_NORMAL)
    UI.println("Fallback cycle:")
    for (const [i, m] of models.entries()) {
      UI.println(`  ${i + 1}. ${m}`)
    }
  },
})

const OffCommand = cmd({
  command: "off",
  describe: "Disable rate limit fallback — agent will sleep-retry on the same model when rate limited",
  builder: (yargs) => yargs,
  handler: async () => {
    await Config.updateGlobal({
      rateLimitFallback: { enabled: false },
    } as any)
    UI.println(UI.Style.TEXT_WARNING_BOLD + "Rate limit fallback: OFF" + UI.Style.TEXT_NORMAL)
  },
})

const StatusCommand = cmd({
  command: "status",
  describe: "Show current rate limit fallback configuration",
  builder: (yargs) => yargs,
  handler: async () => {
    const cfg = await Config.get()
    const fallback = cfg.rateLimitFallback
    const on = fallback?.enabled === true
    UI.println(
      `Rate limit fallback: ${on ? UI.Style.TEXT_SUCCESS_BOLD + "ON" : UI.Style.TEXT_DANGER_BOLD + "OFF"}${UI.Style.TEXT_NORMAL}`,
    )
    if (fallback?.models?.length) {
      UI.println("Fallback cycle:")
      for (const [i, m] of fallback.models.entries()) {
        UI.println(`  ${i + 1}. ${m}`)
      }
    } else {
      UI.println("No fallback models configured (defaults will be used when enabled)")
    }
  },
})

export const FallbackCommand = cmd({
  command: "fallback <action>",
  describe: "Toggle automatic model cycling on rate limits — use before leaving agent unattended",
  builder: (yargs) => yargs.command(OnCommand).command(OffCommand).command(StatusCommand).demandCommand(),
  handler: async () => {},
})
