// OpenCode Browser Control via CDP (Chrome DevTools Protocol)
// Spawns its own browser instance with --remote-debugging-port
// No extensions, no manual flags, no external deps
// Just works: agent says "browser snapshot" → browser launches if needed → CDP controls it

import { Log } from "../util/log"
import { Config } from "../config/config"
import { spawn, type ChildProcess } from "child_process"
import { mkdirSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const log = Log.create({ service: "browser.cdp" })

export namespace BrowserCDP {
  let ws: WebSocket | null = null
  let wsReady = false
  let messageId = 0
  let sessionId: string | null = null
  let activeTargetId: string | null = null
  const pending = new Map<
    number,
    { resolve: (v: any) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  let selectorMap: Map<number, { backendNodeId: number; tag: string; label: string | null }> = new Map()
  let browserProcess: ChildProcess | null = null
  let cdpPort = 9222
  let userDataDir: string | null = null

  export function isConnected(): boolean {
    return wsReady && ws !== null
  }

  // Find browser binary
  function findBrowser(): string | null {
    const candidates = [
      "/usr/bin/brave",
      "/usr/bin/brave-browser",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/brave",
      "/snap/bin/chromium",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ]
    for (const bin of candidates) {
      if (existsSync(bin)) return bin
    }
    return null
  }

  // Launch browser with CDP enabled
  async function launchBrowser(): Promise<void> {
    const binary = findBrowser()
    if (!binary) throw new Error("No Chromium-based browser found. Install Brave or Chrome.")

    // Dedicated profile so we don't mess with user's sessions
    userDataDir = join(homedir(), ".opencode", "browser-profile")
    mkdirSync(userDataDir, { recursive: true })

    const args = [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-features=TranslateUI",
      "--window-size=1280,900",
      "--no-focus-on-navigate",
      "--silent-launch",
      "--class=opencode-browser",
      "about:blank",
    ]

    log.info("Launching browser", { binary, port: cdpPort })
    browserProcess = spawn(binary, args, {
      stdio: "ignore",
      detached: false,
    })

    browserProcess.on("exit", (code) => {
      log.info("Browser process exited", { code })
      browserProcess = null
    })

    // Wait for CDP to be ready
    const maxWait = 15000
    const start = Date.now()
    while (Date.now() - start < maxWait) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`)
        if (res.ok) {
          log.info("Browser CDP ready")
          return
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 300))
    }
    throw new Error(`Browser launched but CDP not ready after ${maxWait}ms`)
  }

  // Connect to already-running CDP or launch
  export async function start(): Promise<void> {
    const config = await Config.get()
    const browserConfig = (config as any).browser
    cdpPort = browserConfig?.cdp?.port ?? 9222

    // Try connecting to existing browser first
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`)
      if (res.ok) {
        log.info("Found existing browser with CDP")
        const info = (await res.json()) as any
        await connect(info.webSocketDebuggerUrl)
        return
      }
    } catch {}

    // No existing browser — launch one
    try {
      await launchBrowser()
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`)
      const info = (await res.json()) as any
      await connect(info.webSocketDebuggerUrl)
    } catch (err: any) {
      log.warn("Failed to start browser", { error: err.message })
    }
  }

  // Ensure browser is running + connected (called lazily from tools)
  export async function ensureBrowser(): Promise<void> {
    if (isConnected()) return

    // Browser died? Relaunch
    if (!browserProcess) {
      await launchBrowser()
    }

    // Reconnect CDP
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`)
      const info = (await res.json()) as any
      await connect(info.webSocketDebuggerUrl)
    } catch (err: any) {
      throw new Error(`Cannot connect to browser CDP: ${err.message}`)
    }
  }

  async function connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ws = new WebSocket(url)
      const timeout = setTimeout(() => {
        reject(new Error("CDP WebSocket connection timeout"))
      }, 10000)

      ws.addEventListener("open", () => {
        clearTimeout(timeout)
        wsReady = true
        log.info("CDP connected")
        resolve()
      })

      ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data as string)
        if (msg.id !== undefined && pending.has(msg.id)) {
          const p = pending.get(msg.id)!
          pending.delete(msg.id)
          clearTimeout(p.timer)
          if (msg.error) {
            p.reject(new Error(msg.error.message))
          } else {
            p.resolve(msg.result)
          }
        }
      })

      ws.addEventListener("close", () => {
        wsReady = false
        ws = null
        sessionId = null
        log.info("CDP disconnected")
      })

      ws.addEventListener("error", () => {
        clearTimeout(timeout)
        wsReady = false
        reject(new Error("CDP WebSocket error"))
      })
    })
  }

  function send(method: string, params: any = {}, sid?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!ws || !wsReady) return reject(new Error("CDP not connected. Call ensureBrowser() first."))
      const id = ++messageId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, 30000)
      pending.set(id, { resolve, reject, timer })
      const msg: any = { id, method, params }
      if (sid) msg.sessionId = sid
      ws.send(JSON.stringify(msg))
    })
  }

  async function ensureSession(targetId?: string): Promise<string> {
    if (targetId && targetId !== activeTargetId) {
      // Switch to a different target
      if (sessionId) {
        try {
          await send("Target.detachFromTarget", { sessionId })
        } catch {}
      }
      activeTargetId = targetId
      sessionId = null
    }

    if (sessionId && activeTargetId) return sessionId

    const { targetInfos } = await send("Target.getTargets")
    const pages = targetInfos.filter((t: any) => t.type === "page" && !t.url.startsWith("devtools://"))
    if (pages.length === 0) throw new Error("No browser tabs found")

    const target = activeTargetId ? pages.find((p: any) => p.targetId === activeTargetId) || pages[0] : pages[0]

    activeTargetId = target.targetId

    const result = await send("Target.attachToTarget", { targetId: activeTargetId, flatten: true })
    sessionId = result.sessionId
    const sid = sessionId ?? undefined

    await Promise.all([
      send("Page.enable", {}, sid),
      send("DOM.enable", {}, sid),
      send("Runtime.enable", {}, sid),
      send("Accessibility.enable", {}, sid),
    ])

    if (!sessionId) throw new Error("Failed to attach browser session")
    return sessionId
  }

  // ==================== PUBLIC API ====================

  export async function listTabs(): Promise<any[]> {
    await ensureBrowser()
    const { targetInfos } = await send("Target.getTargets")
    return targetInfos
      .filter((t: any) => t.type === "page" && !t.url.startsWith("devtools://"))
      .map((t: any) => ({
        id: t.targetId,
        url: t.url,
        title: t.title,
        active: t.targetId === activeTargetId,
      }))
  }

  export async function newTab(url?: string): Promise<any> {
    await ensureBrowser()
    const { targetId } = await send("Target.createTarget", { url: url || "about:blank" })
    // Switch to new tab
    if (sessionId) {
      try {
        await send("Target.detachFromTarget", { sessionId })
      } catch {}
    }
    activeTargetId = targetId
    sessionId = null
    await ensureSession()
    if (url && url !== "about:blank") await waitForLoad()
    return { id: targetId, url }
  }

  export async function closeTab(targetId: string): Promise<void> {
    await ensureBrowser()
    await send("Target.closeTarget", { targetId })
    if (targetId === activeTargetId) {
      activeTargetId = null
      sessionId = null
    }
  }

  export async function focusTab(targetId: string): Promise<void> {
    await ensureBrowser()
    await send("Target.activateTarget", { targetId })
    if (sessionId) {
      try {
        await send("Target.detachFromTarget", { sessionId })
      } catch {}
    }
    activeTargetId = targetId
    sessionId = null
    await ensureSession()
  }

  export async function navigate(url: string): Promise<void> {
    await ensureBrowser()
    const sid = await ensureSession()
    await send("Page.navigate", { url }, sid)
    await waitForLoad()
  }

  async function waitForLoad(timeoutMs = 15000): Promise<void> {
    const sid = await ensureSession()
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      try {
        const result = await send(
          "Runtime.evaluate",
          {
            expression: "document.readyState",
            returnByValue: true,
          },
          sid,
        )
        if (result?.result?.value === "complete") {
          await new Promise((r) => setTimeout(r, 500))
          return
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  export async function snapshot(
    targetId?: string,
  ): Promise<{ title: string; url: string; tree: string; refCount: number }> {
    await ensureBrowser()
    const sid = await ensureSession(targetId)

    const urlResult = await send(
      "Runtime.evaluate",
      { expression: "document.title + '\\n' + location.href", returnByValue: true },
      sid,
    )
    const [title, url] = (urlResult?.result?.value || "\n").split("\n")

    const { nodes } = await send("Accessibility.getFullAXTree", {}, sid)

    selectorMap.clear()
    let refCounter = 0
    const lines: string[] = []
    const nodeMap = new Map<string, any>()
    for (const node of nodes) nodeMap.set(node.nodeId, node)

    function getName(n: any): string {
      return n.name?.value || ""
    }
    function getRole(n: any): string {
      return n.role?.value || "none"
    }
    function getProp(n: any, name: string): string | null {
      return (n.properties || []).find((p: any) => p.name === name)?.value?.value ?? null
    }

    const interactive = new Set([
      "button",
      "link",
      "textbox",
      "searchbox",
      "combobox",
      "checkbox",
      "radio",
      "switch",
      "slider",
      "spinbutton",
      "tab",
      "menuitem",
      "menuitemcheckbox",
      "menuitemradio",
      "option",
      "treeitem",
    ])

    const structural = new Set([
      "heading",
      "banner",
      "navigation",
      "main",
      "contentinfo",
      "complementary",
      "form",
      "region",
      "article",
      "list",
      "listitem",
      "table",
      "row",
      "cell",
      "columnheader",
      "rowheader",
      "dialog",
      "alertdialog",
      "alert",
      "status",
      "tooltip",
      "tree",
      "treegrid",
      "menu",
      "menubar",
      "toolbar",
      "tablist",
      "tabpanel",
      "group",
      "separator",
      "img",
      "figure",
    ])

    function walk(nodeId: string, depth: number) {
      if (depth > 12) return
      const node = nodeMap.get(nodeId)
      if (!node) return

      const role = getRole(node)
      const name = getName(node)

      if (node.ignored && role !== "none") {
        for (const c of node.childIds || []) walk(c, depth)
        return
      }

      if (["none", "generic", "InlineTextBox", "LineBreak"].includes(role) && !name) {
        for (const c of node.childIds || []) walk(c, depth)
        return
      }

      const indent = "  ".repeat(depth)

      if (interactive.has(role)) {
        refCounter++
        selectorMap.set(refCounter, {
          backendNodeId: node.backendDOMNodeId,
          tag: role,
          label: name || null,
        })

        let line = `${indent}[${refCounter}] ${role}`
        if (name) line += ` "${name.slice(0, 100)}"`
        const val = getProp(node, "value")
        if (val) line += ` value="${val.slice(0, 80)}"`
        const checked = getProp(node, "checked")
        if (checked === "true") line += " ✓"
        if (checked === "mixed") line += " ◐"
        const expanded = getProp(node, "expanded")
        if (expanded === "true") line += " ▼"
        if (expanded === "false") line += " ▶"
        if (getProp(node, "selected") === "true") line += " ●"
        if (getProp(node, "required") === "true") line += " *"
        if (getProp(node, "disabled") === "true") line += " (disabled)"
        lines.push(line)
      } else if (structural.has(role)) {
        let line = `${indent}${role}`
        if (name) line += ` "${name.slice(0, 120)}"`
        lines.push(line)
      } else if (role === "StaticText" && name && name.trim().length > 1) {
        lines.push(`${indent}${name.trim().slice(0, 200)}`)
      }

      for (const c of node.childIds || []) walk(c, depth + 1)
    }

    const rootId = nodes[0]?.nodeId
    if (rootId) walk(rootId, 0)

    const maxLines = 500
    const truncated = lines.length > maxLines
    const tree =
      (truncated ? lines.slice(0, maxLines) : lines).join("\n") +
      (truncated ? `\n...(${lines.length - maxLines} more lines)` : "")

    return { title, url, tree, refCount: refCounter }
  }

  export async function screenshot(): Promise<string> {
    await ensureBrowser()
    const sid = await ensureSession()
    const result = await send("Page.captureScreenshot", { format: "png" }, sid)
    return `data:image/png;base64,${result.data}`
  }

  export async function click(ref: number): Promise<string> {
    await ensureBrowser()
    const sid = await ensureSession()
    const entry = selectorMap.get(ref)
    if (!entry) throw new Error(`Ref [${ref}] not found. Take a new snapshot first.`)

    // Scroll into view
    try {
      await send("DOM.scrollIntoViewIfNeeded", { backendNodeId: entry.backendNodeId }, sid)
    } catch {}
    await new Promise((r) => setTimeout(r, 200))

    // Get coordinates
    const { x, y } = await resolveCenter(entry.backendNodeId, sid)
    if (x === 0 && y === 0) {
      // Fallback: use DOM.focus + JS click
      try {
        const { object } = await send("DOM.resolveNode", { backendNodeId: entry.backendNodeId }, sid)
        await send(
          "Runtime.callFunctionOn",
          {
            objectId: object.objectId,
            functionDeclaration: "function() { this.click(); }",
            returnByValue: true,
          },
          sid,
        )
        return `Clicked [${ref}] ${entry.tag} "${entry.label || ""}" (JS fallback)`
      } catch {}
    }

    await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 }, sid)
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 }, sid)

    return `Clicked [${ref}] ${entry.tag} "${entry.label || ""}" at (${x}, ${y})`
  }

  export async function type(ref: number | null, text: string, clear = true, submit = false): Promise<string> {
    await ensureBrowser()
    const sid = await ensureSession()

    if (ref !== null) {
      const entry = selectorMap.get(ref)
      if (!entry) throw new Error(`Ref [${ref}] not found.`)

      await send("DOM.focus", { backendNodeId: entry.backendNodeId }, sid)
      await new Promise((r) => setTimeout(r, 100))

      if (clear) {
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "a", code: "KeyA", modifiers: 2 }, sid)
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "a", code: "KeyA", modifiers: 2 }, sid)
        await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Backspace", code: "Backspace" }, sid)
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Backspace", code: "Backspace" }, sid)
        await new Promise((r) => setTimeout(r, 50))
      }
    }

    // Type using insertText — more reliable than per-char keyDown/keyUp for React
    await send("Input.insertText", { text }, sid)

    if (submit) {
      await new Promise((r) => setTimeout(r, 50))
      await send(
        "Input.dispatchKeyEvent",
        { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
        sid,
      )
      await send(
        "Input.dispatchKeyEvent",
        { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
        sid,
      )
    }

    return `Typed "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"${ref !== null ? ` into [${ref}]` : ""}${submit ? " + submitted" : ""}`
  }

  export async function press(key: string): Promise<string> {
    await ensureBrowser()
    const sid = await ensureSession()

    if (key.includes("+")) {
      const parts = key.split("+")
      const mods = parts.slice(0, -1)
      const main = parts[parts.length - 1]
      const modMap: Record<string, number> = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }
      let modVal = 0
      for (const m of mods) modVal |= modMap[m] || 0

      for (const m of mods) await send("Input.dispatchKeyEvent", { type: "keyDown", key: m, code: keyCode(m) }, sid)
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: main, code: keyCode(main), modifiers: modVal }, sid)
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: main, code: keyCode(main), modifiers: modVal }, sid)
      for (const m of mods.reverse())
        await send("Input.dispatchKeyEvent", { type: "keyUp", key: m, code: keyCode(m) }, sid)
    } else {
      const vk = specialVK(key)
      await send(
        "Input.dispatchKeyEvent",
        { type: "keyDown", key, code: keyCode(key), ...(vk ? { windowsVirtualKeyCode: vk } : {}) },
        sid,
      )
      await send(
        "Input.dispatchKeyEvent",
        { type: "keyUp", key, code: keyCode(key), ...(vk ? { windowsVirtualKeyCode: vk } : {}) },
        sid,
      )
    }

    return `Pressed ${key}`
  }

  export async function scroll(direction: "up" | "down" = "down", amount = 500): Promise<any> {
    await ensureBrowser()
    const sid = await ensureSession()

    const metrics = await send("Page.getLayoutMetrics", {}, sid)
    const vw = metrics.layoutViewport?.clientWidth ?? 1280
    const vh = metrics.layoutViewport?.clientHeight ?? 720
    const deltaY = direction === "up" ? -amount : amount

    await send(
      "Input.dispatchMouseEvent",
      {
        type: "mouseWheel",
        x: Math.round(vw / 2),
        y: Math.round(vh / 2),
        deltaX: 0,
        deltaY,
      },
      sid,
    )

    await new Promise((r) => setTimeout(r, 300))
    const pos = await send(
      "Runtime.evaluate",
      {
        expression: `JSON.stringify({ scrollY: Math.round(window.scrollY), scrollHeight: document.body.scrollHeight, innerHeight: window.innerHeight })`,
        returnByValue: true,
      },
      sid,
    )

    return JSON.parse(pos?.result?.value || "{}")
  }

  export async function evaluate(script: string): Promise<string> {
    await ensureBrowser()
    const sid = await ensureSession()
    const result = await send(
      "Runtime.evaluate",
      {
        expression: script,
        returnByValue: true,
        awaitPromise: true,
      },
      sid,
    )

    if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text || "JS evaluation failed")
    const value = result?.result?.value
    if (value === undefined || value === null) return ""
    if (typeof value === "object") return JSON.stringify(value, null, 2)
    return String(value)
  }

  export async function selectOption(ref: number, value: string): Promise<string> {
    await ensureBrowser()
    const sid = await ensureSession()
    const entry = selectorMap.get(ref)
    if (!entry) throw new Error(`Ref [${ref}] not found.`)

    const { object } = await send("DOM.resolveNode", { backendNodeId: entry.backendNodeId }, sid)
    await send(
      "Runtime.callFunctionOn",
      {
        objectId: object.objectId,
        functionDeclaration: `function(val) {
        for (const opt of this.options) {
          if (opt.value === val || opt.textContent.trim().toLowerCase() === val.toLowerCase()) {
            this.value = opt.value;
            this.dispatchEvent(new Event('change', { bubbles: true }));
            return opt.textContent.trim();
          }
        }
        throw new Error('Option not found: ' + val);
      }`,
        arguments: [{ value }],
        returnByValue: true,
      },
      sid,
    )

    return `Selected "${value}" in [${ref}]`
  }

  // ==================== HELPERS ====================

  async function resolveCenter(backendNodeId: number, sid: string): Promise<{ x: number; y: number }> {
    try {
      const { quads } = await send("DOM.getContentQuads", { backendNodeId }, sid)
      if (quads?.[0]?.length >= 8) {
        const q = quads[0]
        return { x: Math.round((q[0] + q[2] + q[4] + q[6]) / 4), y: Math.round((q[1] + q[3] + q[5] + q[7]) / 4) }
      }
    } catch {}
    try {
      const { model } = await send("DOM.getBoxModel", { backendNodeId }, sid)
      const c = model.content
      return { x: Math.round((c[0] + c[2] + c[4] + c[6]) / 4), y: Math.round((c[1] + c[3] + c[5] + c[7]) / 4) }
    } catch {}
    return { x: 0, y: 0 }
  }

  function keyCode(key: string): string {
    const m: Record<string, string> = {
      Enter: "Enter",
      Tab: "Tab",
      Backspace: "Backspace",
      Delete: "Delete",
      Escape: "Escape",
      ArrowUp: "ArrowUp",
      ArrowDown: "ArrowDown",
      ArrowLeft: "ArrowLeft",
      ArrowRight: "ArrowRight",
      Home: "Home",
      End: "End",
      PageUp: "PageUp",
      PageDown: "PageDown",
      Control: "ControlLeft",
      Shift: "ShiftLeft",
      Alt: "AltLeft",
      Meta: "MetaLeft",
      " ": "Space",
    }
    return m[key] || `Key${key.toUpperCase()}`
  }

  function specialVK(key: string): number | null {
    const m: Record<string, number> = {
      Enter: 13,
      Tab: 9,
      Backspace: 8,
      Delete: 46,
      Escape: 27,
      ArrowUp: 38,
      ArrowDown: 40,
      ArrowLeft: 37,
      ArrowRight: 39,
      Home: 36,
      End: 35,
      PageUp: 33,
      PageDown: 34,
    }
    return m[key] || null
  }

  export function stop(): void {
    if (ws) {
      ws.close()
      ws = null
    }
    wsReady = false
    sessionId = null
    activeTargetId = null
    pending.clear()
    selectorMap.clear()
    if (browserProcess) {
      browserProcess.kill("SIGTERM")
      browserProcess = null
    }
  }
}
