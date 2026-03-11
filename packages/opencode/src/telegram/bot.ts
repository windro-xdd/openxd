import { Log } from "../util/log"
import { Session } from "../session"
import { SessionPrompt } from "../session/prompt"
import { MessageV2 } from "../session/message-v2"
import { Bus } from "../bus"
import { Config } from "../config/config"
import { TelegramState } from "./state"

const log = Log.create({ service: "telegram" })

const API = "https://api.telegram.org/bot"

export namespace TelegramBot {
  let token: string
  let allowedUsers: number[] | undefined
  let offset = 0
  let running = false

  async function api(method: string, body?: Record<string, unknown>) {
    const url = `${API}${token}/${method}`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = (await res.json()) as any
    if (!data.ok) {
      log.error("telegram api error", { method, error: data.description })
    }
    return data
  }

  async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
    // Telegram has a 4096 char limit per message
    const MAX = 4096
    if (text.length <= MAX) {
      return api("sendMessage", { chat_id: chatId, text, parse_mode: "Markdown", ...extra })
    }
    // Split into chunks
    const chunks: string[] = []
    for (let i = 0; i < text.length; i += MAX) {
      chunks.push(text.slice(i, i + MAX))
    }
    for (const chunk of chunks) {
      await api("sendMessage", { chat_id: chatId, text: chunk, parse_mode: "Markdown", ...extra })
    }
  }

  async function sendChatAction(chatId: number, action = "typing") {
    await api("sendChatAction", { chat_id: chatId, action })
  }

  async function handleCommand(chatId: number, command: string, userId: number) {
    switch (command.split("@")[0]) {
      case "/start":
      case "/new": {
        const session = await Session.create({ title: "Telegram Session" })
        await TelegramState.set(chatId, { userId, currentSessionId: session.id })
        await sendMessage(chatId, `🆕 New session created.\nSession: \`${session.id}\``)
        return true
      }

      case "/sessions": {
        const sessions: Session.Info[] = []
        for await (const s of Session.list({ limit: 10 })) {
          sessions.push(s)
        }
        if (sessions.length === 0) {
          await sendMessage(chatId, "No sessions found.")
          return true
        }
        const state = TelegramState.get(chatId)
        const currentId = state?.currentSessionId
        const keyboard = sessions.map((s) => {
          const prefix = s.id === currentId ? "🟢 " : "   "
          const title = s.title || s.id.slice(0, 12)
          return [{ text: `${prefix}${title}`, callback_data: `switch:${s.id}` }]
        })
        keyboard.push([{ text: "➕ New Session", callback_data: "new_session" }])
        await api("sendMessage", {
          chat_id: chatId,
          text: "📋 *Your Sessions:*",
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: keyboard },
        })
        return true
      }

      case "/current": {
        const state = TelegramState.get(chatId)
        if (!state?.currentSessionId) {
          await sendMessage(chatId, "No active session. Send a message to start one.")
          return true
        }
        try {
          const session = await Session.get(state.currentSessionId)
          await sendMessage(chatId, `📌 *Current Session*\nTitle: ${session.title || "Untitled"}\nID: \`${session.id}\``, )
        } catch {
          await sendMessage(chatId, "Session not found. Send a message to create a new one.")
          await TelegramState.setSession(chatId, "")
        }
        return true
      }

      default:
        return false
    }
  }

  async function handleCallbackQuery(callbackQuery: any) {
    const chatId = callbackQuery.message?.chat?.id
    const data = callbackQuery.data as string
    const userId = callbackQuery.from?.id

    if (!chatId || !data) return

    // Answer the callback to remove loading state
    await api("answerCallbackQuery", { callback_query_id: callbackQuery.id })

    if (data === "new_session") {
      const session = await Session.create({ title: "Telegram Session" })
      await TelegramState.set(chatId, { userId, currentSessionId: session.id })
      await api("editMessageText", {
        chat_id: chatId,
        message_id: callbackQuery.message.message_id,
        text: `🆕 Switched to new session.\nSession: \`${session.id}\``,
        parse_mode: "Markdown",
      })
      return
    }

    if (data.startsWith("switch:")) {
      const sessionId = data.slice(7)
      try {
        const session = await Session.get(sessionId)
        await TelegramState.set(chatId, { userId, currentSessionId: sessionId })
        await api("editMessageText", {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: `✅ Switched to: *${session.title || "Untitled"}*\nSession: \`${session.id}\``,
          parse_mode: "Markdown",
        })
      } catch {
        await sendMessage(chatId, "Session not found.")
      }
    }
  }

  async function handleMessage(chatId: number, text: string, userId: number, from: any) {
    // Check allowed users
    if (allowedUsers && allowedUsers.length > 0 && !allowedUsers.includes(userId)) {
      log.warn("unauthorized telegram user", { userId, username: from?.username })
      await sendMessage(chatId, "⛔ Unauthorized. Your user ID is not in the allowed list.")
      return
    }

    // Handle commands
    if (text.startsWith("/")) {
      const handled = await handleCommand(chatId, text, userId)
      if (handled) return
    }

    // Get or create session
    let state = TelegramState.get(chatId)
    if (!state?.currentSessionId) {
      const session = await Session.create({ title: "Telegram Session" })
      await TelegramState.set(chatId, {
        userId,
        currentSessionId: session.id,
        username: from?.username,
        firstName: from?.first_name,
      })
      state = TelegramState.get(chatId)
      log.info("created new session for telegram chat", { chatId, sessionId: session.id })
    }

    const sessionId = state!.currentSessionId!

    // Send typing indicator
    await sendChatAction(chatId)

    // Set up a typing interval to keep showing "typing..."
    const typingInterval = setInterval(() => {
      sendChatAction(chatId).catch(() => {})
    }, 4000)

    try {
      // Collect the assistant's full response via bus events
      let assistantText = ""
      let resolved = false

      const responsePromise = new Promise<string>((resolve) => {
        // Listen for text deltas on this session
        const unsub = Bus.subscribe(MessageV2.Event.PartDelta, (event) => {
          if (event.properties.sessionID !== sessionId) return
          if (event.properties.field === "text") {
            assistantText += event.properties.delta
          }
        })

        // Listen for message completion
        const unsubMsg = Bus.subscribe(MessageV2.Event.Updated, (event) => {
          const info = event.properties.info
          if (info.role !== "assistant") return
          if (!("sessionID" in info) || info.sessionID !== sessionId) return
          if (info.finish && !resolved) {
            resolved = true
            unsub()
            unsubMsg()
            // Give a small delay for final deltas to arrive
            setTimeout(() => resolve(assistantText), 200)
          }
        })

        // Timeout after 5 minutes
        setTimeout(() => {
          if (!resolved) {
            resolved = true
            unsub()
            unsubMsg()
            resolve(assistantText || "⏱️ Response timed out.")
          }
        }, 300_000)
      })

      // Send the prompt
      SessionPrompt.prompt({
        sessionID: sessionId,
        parts: [{ type: "text", text }],
      }).catch((err) => {
        log.error("prompt failed", { sessionId, error: err })
      })

      // Wait for the response
      const response = await responsePromise

      if (response.trim()) {
        await sendMessage(chatId, response)
      }
    } catch (err) {
      log.error("failed to handle telegram message", { chatId, error: err })
      await sendMessage(chatId, "❌ Error processing your message.")
    } finally {
      clearInterval(typingInterval)
    }
  }

  async function poll() {
    while (running) {
      try {
        const result = await api("getUpdates", {
          offset,
          timeout: 30,
          allowed_updates: ["message", "callback_query"],
        })

        if (result.ok && result.result) {
          for (const update of result.result) {
            offset = update.update_id + 1

            if (update.callback_query) {
              handleCallbackQuery(update.callback_query).catch((err) => {
                log.error("callback query error", { error: err })
              })
              continue
            }

            const msg = update.message
            if (!msg?.text) continue

            const chatId = msg.chat.id
            const userId = msg.from?.id
            const text = msg.text

            handleMessage(chatId, text, userId, msg.from).catch((err) => {
              log.error("message handler error", { chatId, error: err })
            })
          }
        }
      } catch (err) {
        log.error("polling error", { error: err })
        // Wait before retrying on error
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  }

  async function setCommands() {
    await api("setMyCommands", {
      commands: [
        { command: "new", description: "Create a new session" },
        { command: "sessions", description: "List and switch sessions" },
        { command: "current", description: "Show current session info" },
      ],
    })
  }

  export async function start() {
    const config = await Config.get()
    const tgConfig = (config as any).telegram
    if (!tgConfig?.botToken) {
      log.info("telegram not configured, skipping")
      return
    }

    token = tgConfig.botToken
    allowedUsers = tgConfig.allowedUsers
    running = true

    TelegramState.init()
    await setCommands()

    const me = await api("getMe")
    if (me.ok) {
      log.info("telegram bot started", { username: me.result.username })
    }

    // Start polling in background
    poll()
  }

  export function stop() {
    running = false
  }
}
