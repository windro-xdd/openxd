import { Log } from "../util/log"
import { Config } from "../config/config"
import { Instance } from "../project/instance"

const log = Log.create({ service: "browser.relay" })

export namespace BrowserRelay {
  interface Tab {
    id: string
    url: string
    title: string
  }

  interface PendingRequest {
    resolve: (data: any) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }

  let server: any = null
  let connectedSocket: any = null
  let requestId = 0
  const pending = new Map<number, PendingRequest>()
  const tabs = new Map<string, Tab>()

  export function isConnected(): boolean {
    return connectedSocket !== null
  }

  export function getConnectedTabs(): Tab[] {
    return Array.from(tabs.values())
  }

  export async function send(action: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<any> {
    if (!connectedSocket) {
      throw new Error("No browser extension connected. Install the OpenCode Chrome extension and click the toolbar button to attach a tab.")
    }

    const id = ++requestId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Browser action '${action}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      pending.set(id, { resolve, reject, timer })

      const message = JSON.stringify({ id, action, ...params })
      connectedSocket.send(message)
    })
  }

  function handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw)

      // Response to a pending request
      if (msg.id && pending.has(msg.id)) {
        const req = pending.get(msg.id)!
        pending.delete(msg.id)
        clearTimeout(req.timer)

        if (msg.error) {
          req.reject(new Error(msg.error))
        } else {
          req.resolve(msg.data)
        }
        return
      }

      // Unsolicited events from extension
      if (msg.type === "tab.attached") {
        tabs.set(msg.tab.id, msg.tab)
        log.info("tab attached", { url: msg.tab.url, title: msg.tab.title })
      } else if (msg.type === "tab.detached") {
        tabs.delete(msg.tabId)
        log.info("tab detached", { tabId: msg.tabId })
      } else if (msg.type === "tab.updated") {
        if (tabs.has(msg.tab.id)) {
          tabs.set(msg.tab.id, msg.tab)
        }
      }
    } catch (err) {
      log.error("failed to parse browser message", { error: err })
    }
  }

  export async function start() {
    const config = await Config.get()
    const browserConfig = (config as any).browser?.relay
    if (!browserConfig?.enabled) {
      log.info("browser relay not enabled, skipping")
      return
    }

    const port = browserConfig.port ?? 4097

    server = Bun.serve({
      port,
      fetch(req, server) {
        const url = new URL(req.url)
        if (url.pathname === "/ws") {
          const upgraded = server.upgrade(req)
          if (!upgraded) {
            return new Response("WebSocket upgrade failed", { status: 400 })
          }
          return undefined
        }
        // Health check
        if (url.pathname === "/health") {
          return new Response(JSON.stringify({
            connected: isConnected(),
            tabs: getConnectedTabs(),
          }), { headers: { "Content-Type": "application/json" } })
        }
        return new Response("OpenCode Browser Relay", { status: 200 })
      },
      websocket: {
        open(ws) {
          log.info("browser extension connected")
          // Only allow one connection at a time
          if (connectedSocket) {
            connectedSocket.close()
          }
          connectedSocket = ws
        },
        message(ws, message) {
          handleMessage(typeof message === "string" ? message : new TextDecoder().decode(message))
        },
        close(ws) {
          if (connectedSocket === ws) {
            connectedSocket = null
            tabs.clear()
            // Reject all pending requests
            for (const [id, req] of pending) {
              clearTimeout(req.timer)
              req.reject(new Error("Browser extension disconnected"))
            }
            pending.clear()
            log.info("browser extension disconnected")
          }
        },
      },
    })

    log.info("browser relay started", { port })
  }

  export function stop() {
    if (server) {
      server.stop()
      server = null
      connectedSocket = null
      tabs.clear()
      pending.clear()
      log.info("browser relay stopped")
    }
  }
}
