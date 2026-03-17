import z from "zod"
import { Tool } from "./tool"
import { BrowserCDP } from "../browser/cdp"
import { PinchTab } from "../browser/pinchtab"

// Backend abstraction — uses PinchTab if available, falls back to CDP
let backend: "pinchtab" | "cdp" | null = null

async function getBackend(): Promise<"pinchtab" | "cdp"> {
  if (backend) return backend
  if (await PinchTab.isAvailable()) {
    backend = "pinchtab"
  } else {
    backend = "cdp"
    await BrowserCDP.ensureBrowser()
  }
  return backend
}

export const BrowserTool = Tool.define("browser", {
  description: `Control the user's browser via Chrome DevTools Protocol (CDP) or PinchTab.

**Workflow: always snapshot first, then interact by ref number.**

1. Use "snapshot" to see the page — each interactive element gets a numbered ref like [1], [2], [3]
2. Use "click" with ref=N to click, "type" with ref=N to type into inputs
3. After interactions, take another snapshot to see the updated state

Actions:
- "tabs": List all browser tabs
- "open": Open a URL in a new tab (default for opening anything)
- "tab.close": Close a tab by ID
- "tab.focus": Focus/activate a tab by ID
- "navigate": Navigate current tab to URL (use when user says "go to X in this tab")
- "snapshot": Get accessibility tree with numbered refs for all interactive elements
- "screenshot": Capture screenshot (base64 PNG)
- "click": Click element by ref number from snapshot
- "type": Type text into element by ref number. Set submit=true to submit
- "press": Press a key or key combo (e.g. "Enter", "Control+a", "Tab")
- "select": Select dropdown option by ref number and value
- "scroll": Scroll page up/down
- "evaluate": Run JavaScript in page
- "text": Extract page text content (token-efficient, ~800 tokens vs 10k for snapshot)
- "profiles": List saved browser profiles (PinchTab only)
- "profile.use": Switch to a saved profile to maintain login state`,
  parameters: z.object({
    action: z
      .enum([
        "tabs",
        "open",
        "tab.close",
        "tab.focus",
        "navigate",
        "snapshot",
        "screenshot",
        "click",
        "type",
        "press",
        "select",
        "scroll",
        "evaluate",
        "text",
        "profiles",
        "profile.use",
      ])
      .describe("Action to perform"),
    ref: z.number().optional().describe("Element ref number from snapshot (for click/type/select)"),
    text: z.string().optional().describe("Text to type, or key/combo to press"),
    value: z.string().optional().describe("Value to select in dropdown"),
    url: z.string().optional().describe("URL for navigate/open"),
    direction: z.enum(["up", "down"]).optional().describe("Scroll direction"),
    amount: z.number().optional().describe("Scroll pixels (default: 500)"),
    script: z.string().optional().describe("JavaScript to evaluate"),
    tabId: z.string().optional().describe("Target tab ID (defaults to active tab)"),
    clear: z.boolean().optional().describe("Clear input before typing (default: true)"),
    submit: z.boolean().optional().describe("Submit form after typing (press Enter)"),
    profileId: z.string().optional().describe("Profile ID for profile.use action"),
  }),
  async execute(params, ctx) {
    try {
      const be = await getBackend()
      const usePinch = be === "pinchtab"

      switch (params.action) {
        case "tabs": {
          const tabs = usePinch ? await PinchTab.listTabs() : await BrowserCDP.listTabs()
          if (tabs.length === 0) return { title: "Tabs", output: "No tabs open.", metadata: {} }
          const list = tabs
            .map((t: any) => `${t.active ? "→" : " "} [${t.id.slice(0, 8)}] ${t.title}\n  ${t.url}`)
            .join("\n")
          return { title: "Tabs", output: `${tabs.length} tabs:\n${list}`, metadata: { count: tabs.length } }
        }

        case "open": {
          if (!params.url) return { title: "Error", output: "URL is required.", metadata: {} }
          const data = usePinch ? await PinchTab.newTab(params.url) : await BrowserCDP.newTab(params.url)
          return { title: "Opened", output: `Opened ${params.url} in new tab`, metadata: { tabId: data.id } }
        }

        case "tab.close": {
          if (!params.tabId) return { title: "Error", output: "tabId required.", metadata: {} }
          usePinch ? await PinchTab.closeTab(params.tabId) : await BrowserCDP.closeTab(params.tabId)
          return { title: "Closed", output: `Closed tab`, metadata: {} }
        }

        case "tab.focus": {
          if (!params.tabId) return { title: "Error", output: "tabId required.", metadata: {} }
          usePinch ? await PinchTab.focusTab(params.tabId) : await BrowserCDP.focusTab(params.tabId)
          return { title: "Focused", output: `Focused tab`, metadata: {} }
        }

        case "navigate": {
          if (!params.url) return { title: "Error", output: "URL is required.", metadata: {} }
          usePinch ? await PinchTab.navigate(params.url) : await BrowserCDP.navigate(params.url)
          return { title: "Navigated", output: `Navigated to ${params.url}`, metadata: {} }
        }

        case "snapshot": {
          if (params.tabId && !usePinch) await BrowserCDP.focusTab(params.tabId)
          const data = usePinch ? await PinchTab.snapshot() : await BrowserCDP.snapshot()
          const header = `Page: ${data.title}\nURL: ${data.url}\nInteractive elements: ${data.refCount}\n${"─".repeat(50)}\n`
          return {
            title: "Snapshot",
            output: header + (data.tree || "Empty page"),
            metadata: { url: data.url, refCount: data.refCount },
          }
        }

        case "screenshot": {
          const data = usePinch ? await PinchTab.screenshot() : await BrowserCDP.screenshot()
          return {
            title: "Screenshot",
            output:
              "Screenshot captured. Analyze the image carefully — check ALL elements on the page, not just the first one you notice. Verify consistency across the entire visible area.",
            metadata: {},
            attachments: [{ type: "file" as const, mime: "image/png", url: data }],
          }
        }

        case "click": {
          if (params.ref === undefined)
            return { title: "Error", output: "ref is required for click. Take a snapshot first.", metadata: {} }
          const msg = usePinch ? await PinchTab.click(params.ref) : await BrowserCDP.click(params.ref)
          return { title: "Clicked", output: msg, metadata: {} }
        }

        case "type": {
          if (!params.text) return { title: "Error", output: "'text' is required.", metadata: {} }
          const msg = usePinch
            ? await PinchTab.type(params.ref ?? null, params.text, params.clear !== false, params.submit === true)
            : await BrowserCDP.type(params.ref ?? null, params.text, params.clear !== false, params.submit === true)
          return { title: "Typed", output: msg, metadata: {} }
        }

        case "press": {
          if (!params.text) return { title: "Error", output: "'text' is required (key name or combo).", metadata: {} }
          const msg = usePinch ? await PinchTab.press(params.text) : await BrowserCDP.press(params.text)
          return { title: "Pressed", output: msg, metadata: {} }
        }

        case "select": {
          if (params.ref === undefined || !params.value)
            return { title: "Error", output: "ref and value required.", metadata: {} }
          const msg = usePinch
            ? await PinchTab.selectOption(params.ref, params.value)
            : await BrowserCDP.selectOption(params.ref, params.value)
          return { title: "Selected", output: msg, metadata: {} }
        }

        case "scroll": {
          const data = usePinch
            ? await PinchTab.scroll(params.direction || "down", params.amount || 500)
            : await BrowserCDP.scroll(params.direction || "down", params.amount || 500)
          return {
            title: "Scrolled",
            output: `Scrolled ${params.direction || "down"} (position: ${data.scrollY}/${data.scrollHeight})`,
            metadata: {},
          }
        }

        case "evaluate": {
          if (!params.script) return { title: "Error", output: "Script is required.", metadata: {} }
          const result = usePinch ? await PinchTab.evaluate(params.script) : await BrowserCDP.evaluate(params.script)
          return { title: "Result", output: result || "(no output)", metadata: {} }
        }

        case "text": {
          if (usePinch) {
            const text = await PinchTab.extractText()
            return {
              title: "Text",
              output: text || "(empty page)",
              metadata: { chars: text.length },
            }
          }
          // CDP fallback: use JS to extract text
          const text = await BrowserCDP.evaluate("document.body.innerText")
          return {
            title: "Text",
            output: text || "(empty page)",
            metadata: { chars: text.length },
          }
        }

        case "profiles": {
          if (!usePinch) {
            return {
              title: "Profiles",
              output:
                "Browser profiles require PinchTab. Install with: curl -fsSL https://pinchtab.com/install.sh | bash",
              metadata: {},
            }
          }
          const profiles = await PinchTab.listProfiles()
          if (profiles.length === 0)
            return {
              title: "Profiles",
              output: "No profiles saved. Log into sites and they'll persist in the default profile.",
              metadata: {},
            }
          const list = profiles
            .map((p) => `- ${p.id}: ${p.name}${p.description ? ` (${p.description})` : ""}`)
            .join("\n")
          return {
            title: "Profiles",
            output: `${profiles.length} profiles:\n${list}`,
            metadata: { count: profiles.length },
          }
        }

        case "profile.use": {
          if (!usePinch) {
            return { title: "Error", output: "Browser profiles require PinchTab.", metadata: {} }
          }
          if (!params.profileId) return { title: "Error", output: "profileId required.", metadata: {} }
          await PinchTab.useProfile(params.profileId)
          return { title: "Profile", output: `Switched to profile: ${params.profileId}`, metadata: {} }
        }

        default:
          return { title: "Error", output: `Unknown action: ${params.action}`, metadata: {} }
      }
    } catch (err: any) {
      return { title: "Browser Error", output: `${err.message || err}`, metadata: {} as any }
    }
  },
})
