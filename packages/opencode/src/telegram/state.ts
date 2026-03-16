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

  interface PairingRequest {
    code: string
    userId: number
    chatId: number
    username?: string
    firstName?: string
    createdAt: number
  }

  interface StateFile {
    chats: Record<string, ChatState>
    pairedUsers: number[] // user IDs that have been approved
    pendingPairings: PairingRequest[]
  }

  let data: StateFile = { chats: {}, pairedUsers: [], pendingPairings: [] }
  let statePath: string

  export function init() {
    statePath = path.join(Global.Path.data, "telegram-state.json")
    load()
  }

  function load() {
    try {
      const raw = require("fs").readFileSync(statePath, "utf-8")
      const parsed = JSON.parse(raw)
      // Migrate old format (flat chat state) to new format
      if (!parsed.chats && !parsed.pairedUsers) {
        data = { chats: parsed, pairedUsers: [], pendingPairings: [] }
        // Auto-pair any existing users
        for (const [, chat] of Object.entries(parsed) as [string, ChatState][]) {
          if (chat.userId && !data.pairedUsers.includes(chat.userId)) {
            data.pairedUsers.push(chat.userId)
          }
        }
        save()
      } else {
        data = { chats: {}, pairedUsers: [], pendingPairings: [], ...parsed }
      }
    } catch {
      data = { chats: {}, pairedUsers: [], pendingPairings: [] }
    }
  }

  async function save() {
    await Filesystem.writeJson(statePath, data)
  }

  // --- Pairing ---

  function generateCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I confusion
    let code = ""
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  export function isPaired(userId: number): boolean {
    return data.pairedUsers.includes(userId)
  }

  export function createPairingRequest(userId: number, chatId: number, username?: string, firstName?: string): string {
    // Remove any existing pending request for this user
    data.pendingPairings = data.pendingPairings.filter((p) => p.userId !== userId)
    const code = generateCode()
    data.pendingPairings.push({
      code,
      userId,
      chatId,
      username,
      firstName,
      createdAt: Date.now(),
    })
    // Clean up expired requests (older than 10 minutes)
    const tenMinAgo = Date.now() - 10 * 60 * 1000
    data.pendingPairings = data.pendingPairings.filter((p) => p.createdAt > tenMinAgo)
    save()
    return code
  }

  export function approvePairing(code: string): { success: boolean; userId?: number; chatId?: number; username?: string; firstName?: string } {
    const upper = code.toUpperCase().trim()
    const request = data.pendingPairings.find((p) => p.code === upper)
    if (!request) {
      return { success: false }
    }
    // Check expiry (10 minutes)
    if (Date.now() - request.createdAt > 10 * 60 * 1000) {
      data.pendingPairings = data.pendingPairings.filter((p) => p.code !== upper)
      save()
      return { success: false }
    }
    // Approve
    if (!data.pairedUsers.includes(request.userId)) {
      data.pairedUsers.push(request.userId)
    }
    data.pendingPairings = data.pendingPairings.filter((p) => p.code !== upper)
    save()
    return { success: true, userId: request.userId, chatId: request.chatId, username: request.username, firstName: request.firstName }
  }

  export function removePairedUser(userId: number): boolean {
    const idx = data.pairedUsers.indexOf(userId)
    if (idx === -1) return false
    data.pairedUsers.splice(idx, 1)
    // Also remove chat state
    for (const [key, chat] of Object.entries(data.chats)) {
      if (chat.userId === userId) {
        delete data.chats[key]
      }
    }
    save()
    return true
  }

  export function listPairedUsers(): number[] {
    return [...data.pairedUsers]
  }

  export function getPendingPairings(): PairingRequest[] {
    // Clean expired
    const tenMinAgo = Date.now() - 10 * 60 * 1000
    data.pendingPairings = data.pendingPairings.filter((p) => p.createdAt > tenMinAgo)
    return [...data.pendingPairings]
  }

  // --- Chat state ---

  export function get(chatId: number): ChatState | undefined {
    return data.chats[String(chatId)]
  }

  export async function set(chatId: number, info: Partial<ChatState> & { userId: number }) {
    const existing = data.chats[String(chatId)]
    data.chats[String(chatId)] = { ...existing, currentSessionId: null, ...info }
    await save()
  }

  export async function setSession(chatId: number, sessionId: string) {
    const existing = data.chats[String(chatId)]
    if (existing) {
      existing.currentSessionId = sessionId
      await save()
    }
  }

  export function all(): Record<string, ChatState> {
    return data.chats
  }
}
