import { Log } from "../util/log"
import { Config } from "../config/config"

const log = Log.create({ service: "browser.relay" })

export namespace BrowserRelay {
  interface PendingRequest {
    resolve: (data: any) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  }

  let server: any = null
  let connectedSocket: any = null
  let requestId = 0
  const pending = new Map<number, PendingRequest>()

  export function isConnected(): boolean {
    return connectedSocket !== null
  }

  export async function send(action: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<any> {
    if (!connectedSocket) {
      throw new Error("No browser extension connected. Install the OpenCode Chrome extension and make sure serve is running.")
    }

    const id = ++requestId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`Browser action '${action}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      pending.set(id, { resolve, reject, timer })
      connectedSocket.send(JSON.stringify({ id, action, ...params }))
    })
  }

  function handleMessage(raw: string) {
    try {
      const msg = JSON.parse(raw)
      if (msg.id && pending.has(msg.id)) {
        const req = pending.get(msg.id)!
        pending.delete(msg.id)
        clearTimeout(req.timer)
        if (msg.error) {
          req.reject(new Error(msg.error))
        } else {
          req.resolve(msg.data)
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

    try {
      server = Bun.serve({
        port,
        fetch(req, server) {
          const url = new URL(req.url)
          if (url.pathname === "/ws") {
            const upgraded = server.upgrade(req)
            if (!upgraded) return new Response("WebSocket upgrade failed", { status: 400 })
            return undefined
          }
          if (url.pathname === "/health") {
            return new Response(JSON.stringify({ connected: isConnected() }), {
              headers: { "Content-Type": "application/json" },
            })
          }
          return new Response("OpenCode Browser Relay", { status: 200 })
        },
        websocket: {
          open(ws) {
            log.info("browser extension connected")
            if (connectedSocket) connectedSocket.close()
            connectedSocket = ws
          },
          message(ws, message) {
            handleMessage(typeof message === "string" ? message : new TextDecoder().decode(message))
          },
          close(ws) {
            if (connectedSocket === ws) {
              connectedSocket = null
              for (const [, req] of pending) {
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
    } catch (err) {
      log.error("failed to start browser relay", { port, error: err })
    }
  }

  export function stop() {
    if (server) {
      server.stop()
      server = null
      connectedSocket = null
      pending.clear()
      log.info("browser relay stopped")
    }
  }
}
