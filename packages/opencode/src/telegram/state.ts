import { Log } from "../util/log"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import path from "path"

const log = Log.create({ service: "telegram.state" })

export namespace TelegramState {
  interface ChatState {
    currentSessionId: string | null
    userId: number
    username?: string
    firstName?: string
  }

  let state: Record<string, ChatState> = {}
  let statePath: string

  export function init() {
    statePath = path.join(Global.Path.data, "telegram-state.json")
    load()
  }

  function load() {
    try {
      const raw = require("fs").readFileSync(statePath, "utf-8")
      state = JSON.parse(raw)
    } catch {
      state = {}
    }
  }

  async function save() {
    await Filesystem.writeJson(statePath, state)
  }

  export function get(chatId: number): ChatState | undefined {
    return state[String(chatId)]
  }

  export async function set(chatId: number, data: Partial<ChatState> & { userId: number }) {
    const existing = state[String(chatId)]
    state[String(chatId)] = { ...existing, currentSessionId: null, ...data }
    await save()
  }

  export async function setSession(chatId: number, sessionId: string) {
    const existing = state[String(chatId)]
    if (existing) {
      existing.currentSessionId = sessionId
      await save()
    }
  }

  export function all(): Record<string, ChatState> {
    return state
  }
}
