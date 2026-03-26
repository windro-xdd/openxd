import z from "zod"
import { Tool } from "./tool"
import TurndownService from "turndown"
import DESCRIPTION from "./webfetch.txt"
import { abortAfterAny } from "../util/abort"
import { spawn, type ChildProcess } from "child_process"
import { mkdirSync } from "fs"
import { homedir } from "os"
import { join } from "path"

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_TIMEOUT = 30 * 1000 // 30 seconds
const MAX_TIMEOUT = 120 * 1000 // 2 minutes

// Minimum meaningful content length after HTML stripping
const MIN_CONTENT_LENGTH = 200

// Headless browser singleton for webfetch (separate from interactive browser tool)
const HEADLESS_CDP_PORT = 9333
let headlessProcess: ChildProcess | null = null
let headlessWs: WebSocket | null = null
let headlessReady = false

// Patterns that indicate a JS-rendered page returned an empty shell
const JS_SHELL_PATTERNS = [
  '<div id="root"></div>',
  '<div id="app"></div>',
  '<div id="__next"></div>',
  '<div id="__nuxt"></div>',
  "window.__INITIAL_STATE__",
  "window.__NEXT_DATA__",
  '<noscript>You need to enable JavaScript',
  '<noscript>Please enable JavaScript',
  "React.createElement",
  "createApp(",
  "ng-app",
  "data-reactroot",
]

export const WebFetchTool = Tool.define("webfetch", {
  description: DESCRIPTION,
  parameters: z.object({
    url: z.string().describe("The URL to fetch content from"),
    format: z
      .enum(["text", "markdown", "html"])
      .default("markdown")
      .describe("The format to return the content in (text, markdown, or html). Defaults to markdown."),
    timeout: z.number().describe("Optional timeout in seconds (max 120)").optional(),
    useBrowser: z
      .boolean()
      .optional()
      .describe("Force browser rendering for JS-heavy pages. Auto-detected if not set."),
    screenshot: z
      .boolean()
      .optional()
      .describe("Also capture a screenshot of the page (useful for visual content, charts, UI)"),
  }),
  async execute(params, ctx) {
    // Validate URL
    if (!params.url.startsWith("http://") && !params.url.startsWith("https://")) {
      throw new Error("URL must start with http:// or https://")
    }

    await ctx.ask({
      permission: "webfetch",
      patterns: [params.url],
      always: ["*"],
      metadata: {
        url: params.url,
        format: params.format,
        timeout: params.timeout,
      },
    })

    const timeout = Math.min((params.timeout ?? DEFAULT_TIMEOUT / 1000) * 1000, MAX_TIMEOUT)

    // If useBrowser is explicitly true, go straight to browser rendering
    if (params.useBrowser === true) {
      return await fetchWithBrowser(params.url, params.format, params.screenshot, timeout)
    }

    const { signal, clearTimeout } = abortAfterAny(timeout, ctx.abort)

    // Build Accept header based on requested format with q parameters for fallbacks
    let acceptHeader = "*/*"
    switch (params.format) {
      case "markdown":
        acceptHeader = "text/markdown;q=1.0, text/x-markdown;q=0.9, text/plain;q=0.8, text/html;q=0.7, */*;q=0.1"
        break
      case "text":
        acceptHeader = "text/plain;q=1.0, text/markdown;q=0.9, text/html;q=0.8, */*;q=0.1"
        break
      case "html":
        acceptHeader = "text/html;q=1.0, application/xhtml+xml;q=0.9, text/plain;q=0.8, text/markdown;q=0.7, */*;q=0.1"
        break
      default:
        acceptHeader =
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8"
    }
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
      Accept: acceptHeader,
      "Accept-Language": "en-US,en;q=0.9",
    }

    const initial = await fetch(params.url, { signal, headers })

    // Retry with honest UA if blocked by Cloudflare bot detection (TLS fingerprint mismatch)
    const response =
      initial.status === 403 && initial.headers.get("cf-mitigated") === "challenge"
        ? await fetch(params.url, { signal, headers: { ...headers, "User-Agent": "openxd" } })
        : initial

    clearTimeout()

    if (!response.ok) {
      // For 403 (bot blocked) or 5xx, try browser fallback before giving up
      if (params.useBrowser !== false && (response.status === 403 || response.status >= 500)) {
        try {
          return await fetchWithBrowser(params.url, params.format, params.screenshot, timeout)
        } catch {
          // Browser fallback also failed
        }
      }
      throw new Error(`Request failed with status code: ${response.status}`)
    }

    // Check content length
    const contentLength = response.headers.get("content-length")
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)")
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error("Response too large (exceeds 5MB limit)")
    }

    const contentType = response.headers.get("content-type") || ""
    const mime = contentType.split(";")[0]?.trim().toLowerCase() || ""
    const title = `${params.url} (${contentType})`

    // Check if response is an image
    const isImage = mime.startsWith("image/") && mime !== "image/svg+xml" && mime !== "image/vnd.fastbidsheet"

    if (isImage) {
      const base64Content = Buffer.from(arrayBuffer).toString("base64")
      return {
        title,
        output: "Image fetched successfully",
        metadata: {},
        attachments: [
          {
            type: "file",
            mime,
            url: `data:${mime};base64,${base64Content}`,
          },
        ],
      }
    }

    const content = new TextDecoder().decode(arrayBuffer)

    // Auto-detect JS-rendered pages and fall back to browser
    if (params.useBrowser !== false && contentType.includes("text/html")) {
      const isJSShell = JS_SHELL_PATTERNS.some((p) => content.includes(p))
      const textOnly = content.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
      const tooShort = textOnly.length < MIN_CONTENT_LENGTH

      if (isJSShell || tooShort) {
        try {
          return await fetchWithBrowser(params.url, params.format, params.screenshot, timeout)
        } catch {
          // Browser fallback failed, return whatever we got from fetch
        }
      }
    }

    // If screenshot requested but we didn't use browser, try to get one
    const screenshotAttachments: any[] = []
    if (params.screenshot) {
      try {
        const ss = await captureScreenshot(params.url, timeout)
        if (ss) screenshotAttachments.push(ss)
      } catch {
        // Screenshot failed, continue without it
      }
    }

    // Handle content based on requested format and actual content type
    let output: string
    if (contentType.includes("text/html")) {
      switch (params.format) {
        case "markdown":
          output = convertHTMLToMarkdown(content)
          break
        case "text":
          output = await extractTextFromHTML(content)
          break
        case "html":
          output = content
          break
        default:
          output = content
      }
    } else {
      output = content
    }

    return {
      output,
      title,
      metadata: {},
      ...(screenshotAttachments.length ? { attachments: screenshotAttachments } : {}),
    }
  },
})

async function extractTextFromHTML(html: string) {
  let text = ""
  let skipContent = false

  const rewriter = new HTMLRewriter()
    .on("script, style, noscript, iframe, object, embed", {
      element() {
        skipContent = true
      },
      text() {
        // Skip text content inside these elements
      },
    })
    .on("*", {
      element(element) {
        // Reset skip flag when entering other elements
        if (!["script", "style", "noscript", "iframe", "object", "embed"].includes(element.tagName)) {
          skipContent = false
        }
      },
      text(input) {
        if (!skipContent) {
          text += input.text
        }
      },
    })
    .transform(new Response(html))

  await rewriter.text()
  return text.trim()
}

function convertHTMLToMarkdown(html: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "*",
  })
  turndownService.remove(["script", "style", "meta", "link"])
  return turndownService.turndown(html)
}

// ─── Headless Browser for JS-rendered pages ───
// Completely separate from the interactive browser tool (BrowserCDP)
// Runs headless Chrome on port 9333, invisible to the user

const BROWSER_PATHS = [
  "/usr/bin/brave-browser",
  "/usr/bin/brave",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
]

function findBrowserBinary(): string | null {
  const { existsSync } = require("fs")
  for (const p of BROWSER_PATHS) {
    if (existsSync(p)) return p
  }
  return null
}

async function ensureHeadless(): Promise<void> {
  if (headlessReady && headlessWs?.readyState === WebSocket.OPEN) return

  // Check if already running
  try {
    const res = await fetch(`http://127.0.0.1:${HEADLESS_CDP_PORT}/json/version`)
    if (res.ok) {
      const info = await res.json() as any
      headlessWs = new WebSocket(info.webSocketDebuggerUrl)
      await new Promise<void>((resolve, reject) => {
        headlessWs!.onopen = () => { headlessReady = true; resolve() }
        headlessWs!.onerror = reject
        setTimeout(() => reject(new Error("WS connect timeout")), 5000)
      })
      return
    }
  } catch {}

  // Launch headless
  const binary = findBrowserBinary()
  if (!binary) throw new Error("No browser found for headless rendering")

  const dataDir = join(homedir(), ".opencode", "headless-profile")
  mkdirSync(dataDir, { recursive: true })

  headlessProcess = spawn(binary, [
    "--headless=new",
    `--remote-debugging-port=${HEADLESS_CDP_PORT}`,
    `--user-data-dir=${dataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--window-size=1280,900",
    "about:blank",
  ], { stdio: "ignore", detached: false })

  headlessProcess.on("exit", () => {
    headlessProcess = null
    headlessReady = false
    headlessWs = null
  })

  // Wait for CDP
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${HEADLESS_CDP_PORT}/json/version`)
      if (res.ok) {
        const info = await res.json() as any
        headlessWs = new WebSocket(info.webSocketDebuggerUrl)
        await new Promise<void>((resolve, reject) => {
          headlessWs!.onopen = () => { headlessReady = true; resolve() }
          headlessWs!.onerror = reject
          setTimeout(() => reject(new Error("WS timeout")), 5000)
        })
        return
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300))
  }
  throw new Error("Headless browser failed to start")
}

let cdpId = 0
function cdpSend(method: string, params: any = {}, sessionId?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!headlessWs || headlessWs.readyState !== WebSocket.OPEN) {
      return reject(new Error("Headless not connected"))
    }
    const id = ++cdpId
    const msg: any = { id, method, params }
    if (sessionId) msg.sessionId = sessionId
    const handler = (ev: MessageEvent) => {
      const data = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString())
      if (data.id === id) {
        headlessWs!.removeEventListener("message", handler)
        if (data.error) reject(new Error(data.error.message))
        else resolve(data.result)
      }
    }
    headlessWs!.addEventListener("message", handler)
    headlessWs!.send(JSON.stringify(msg))
    setTimeout(() => {
      headlessWs?.removeEventListener("message", handler)
      reject(new Error("CDP timeout"))
    }, 30000)
  })
}

async function fetchWithBrowser(url: string, format: string, screenshot?: boolean, timeout?: number): Promise<any> {
  await ensureHeadless()

  // Create a new target (tab)
  const { targetId } = await cdpSend("Target.createTarget", { url })
  const { sessionId } = await cdpSend("Target.attachToTarget", { targetId, flatten: true })

  try {
    // Enable page events
    await cdpSend("Page.enable", {}, sessionId)

    // Wait for page load
    await new Promise<void>((resolve) => {
      const handler = (ev: MessageEvent) => {
        const data = JSON.parse(typeof ev.data === "string" ? ev.data : ev.data.toString())
        if (data.method === "Page.loadEventFired" && data.sessionId === sessionId) {
          headlessWs!.removeEventListener("message", handler)
          resolve()
        }
      }
      headlessWs!.addEventListener("message", handler)
      // Timeout fallback
      setTimeout(() => {
        headlessWs?.removeEventListener("message", handler)
        resolve()
      }, Math.min(timeout || 15000, 15000))
    })

    // Extra wait for JS rendering
    await new Promise(r => setTimeout(r, 2000))

    const attachments: any[] = []

    if (screenshot) {
      try {
        const ss = await cdpSend("Page.captureScreenshot", { format: "png" }, sessionId)
        if (ss?.data) {
          attachments.push({
            type: "file",
            mime: "image/png",
            url: `data:image/png;base64,${ss.data}`,
          })
        }
      } catch {}
    }

    // Get rendered HTML
    const result = await cdpSend("Runtime.evaluate", {
      expression: "document.documentElement.outerHTML",
      returnByValue: true,
    }, sessionId)
    const html = result?.result?.value || ""

    let output: string
    switch (format) {
      case "text":
        output = await extractTextFromHTML(html)
        break
      case "html":
        output = html
        break
      case "markdown":
      default:
        output = convertHTMLToMarkdown(html)
        break
    }

    return {
      output,
      title: `${url} (browser-rendered)`,
      metadata: { browserRendered: true },
      ...(attachments.length ? { attachments } : {}),
    }
  } finally {
    // Close the tab
    try { await cdpSend("Target.closeTarget", { targetId }) } catch {}
  }
}

async function captureScreenshot(url: string, _timeout?: number): Promise<any> {
  await ensureHeadless()
  const { targetId } = await cdpSend("Target.createTarget", { url })
  const { sessionId } = await cdpSend("Target.attachToTarget", { targetId, flatten: true })
  try {
    await cdpSend("Page.enable", {}, sessionId)
    await new Promise(r => setTimeout(r, 3000))
    const ss = await cdpSend("Page.captureScreenshot", { format: "png" }, sessionId)
    if (ss?.data) {
      return { type: "file", mime: "image/png", url: `data:image/png;base64,${ss.data}` }
    }
    return null
  } catch { return null }
  finally { try { await cdpSend("Target.closeTarget", { targetId }) } catch {} }
}
