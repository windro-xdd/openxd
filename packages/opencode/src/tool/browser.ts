import z from "zod"
import { Tool } from "./tool"
import { BrowserRelay } from "../browser/relay"

export const BrowserTool = Tool.define("browser", {
  description: `Control the user's browser via the Chrome extension relay.

Requires: OpenCode Chrome extension installed and connected (click toolbar button to attach a tab).

Actions:
- "tabs": List attached browser tabs
- "snapshot": Get DOM/accessibility snapshot of current tab
- "screenshot": Capture screenshot of current tab (returns base64 PNG)
- "click": Click an element by CSS selector or text
- "type": Type text into an element
- "navigate": Navigate to a URL
- "scroll": Scroll the page
- "console": Get recent console logs
- "evaluate": Execute JavaScript in the page`,
  parameters: z.object({
    action: z
      .enum(["tabs", "snapshot", "screenshot", "click", "type", "navigate", "scroll", "console", "evaluate"])
      .describe("Action to perform"),
    selector: z.string().optional().describe("CSS selector for click/type actions"),
    text: z.string().optional().describe("Text to type, or element text to click"),
    url: z.string().optional().describe("URL for navigate action"),
    direction: z.enum(["up", "down"]).optional().describe("Scroll direction"),
    amount: z.number().optional().describe("Scroll amount in pixels (default: 500)"),
    script: z.string().optional().describe("JavaScript to evaluate in page context"),
    tabId: z.string().optional().describe("Target tab ID (defaults to first attached tab)"),
  }),
  async execute(params, ctx) {
    if (!BrowserRelay.isConnected()) {
      return {
        title: "Browser",
        output:
          "❌ No browser extension connected.\n\nTo use browser control:\n1. Install the OpenCode Chrome extension\n2. Click the OpenCode toolbar button on the tab you want to control\n3. The badge will show 'ON' when attached",
        metadata: {} as any,
      }
    }

    try {
      switch (params.action) {
        case "tabs": {
          const tabs = BrowserRelay.getConnectedTabs()
          if (tabs.length === 0) {
            return { title: "Browser Tabs", output: "No tabs attached. Click the extension button on a tab.", metadata: {} }
          }
          const list = tabs.map((t) => `- [${t.id}] ${t.title}\n  ${t.url}`).join("\n")
          return { title: "Browser Tabs", output: list, metadata: { count: tabs.length } }
        }

        case "snapshot": {
          const data = await BrowserRelay.send("snapshot", { tabId: params.tabId })
          return {
            title: "DOM Snapshot",
            output: data.snapshot || data.html || JSON.stringify(data),
            metadata: { url: data.url },
          }
        }

        case "screenshot": {
          const data = await BrowserRelay.send("screenshot", { tabId: params.tabId })
          return {
            title: "Screenshot",
            output: `Screenshot captured (${data.width}x${data.height}).\nBase64 data: ${(data.data || "").slice(0, 100)}...`,
            metadata: { width: data.width, height: data.height },
          }
        }

        case "click": {
          if (!params.selector && !params.text) {
            return { title: "Error", output: "Either 'selector' or 'text' is required for click.", metadata: {} }
          }
          const data = await BrowserRelay.send("click", {
            selector: params.selector,
            text: params.text,
            tabId: params.tabId,
          })
          return { title: "Click", output: data.message || "Clicked successfully.", metadata: {} }
        }

        case "type": {
          if (!params.selector || !params.text) {
            return { title: "Error", output: "Both 'selector' and 'text' are required for type.", metadata: {} }
          }
          const data = await BrowserRelay.send("type", {
            selector: params.selector,
            text: params.text,
            tabId: params.tabId,
          })
          return { title: "Type", output: data.message || "Typed successfully.", metadata: {} }
        }

        case "navigate": {
          if (!params.url) {
            return { title: "Error", output: "URL is required for navigate.", metadata: {} }
          }
          const data = await BrowserRelay.send("navigate", { url: params.url, tabId: params.tabId })
          return { title: "Navigate", output: `Navigated to ${params.url}`, metadata: { url: params.url } }
        }

        case "scroll": {
          const data = await BrowserRelay.send("scroll", {
            direction: params.direction || "down",
            amount: params.amount || 500,
            tabId: params.tabId,
          })
          return { title: "Scroll", output: `Scrolled ${params.direction || "down"} ${params.amount || 500}px`, metadata: {} }
        }

        case "console": {
          const data = await BrowserRelay.send("console", { tabId: params.tabId })
          const logs = data.logs || []
          if (logs.length === 0) {
            return { title: "Console", output: "No console logs captured.", metadata: {} }
          }
          const output = logs.map((l: any) => `[${l.level}] ${l.text}`).join("\n")
          return { title: "Console", output, metadata: { count: logs.length } }
        }

        case "evaluate": {
          if (!params.script) {
            return { title: "Error", output: "Script is required for evaluate.", metadata: {} }
          }
          const data = await BrowserRelay.send("evaluate", { script: params.script, tabId: params.tabId })
          return {
            title: "Evaluate",
            output: typeof data.result === "string" ? data.result : JSON.stringify(data.result, null, 2),
            metadata: {} as any,
          }
        }

        default:
          return { title: "Error", output: `Unknown action: ${params.action}`, metadata: {} }
      }
    } catch (err: any) {
      return {
        title: "Browser Error",
        output: `❌ ${err.message || err}`,
        metadata: {} as any,
      }
    }
  },
})
