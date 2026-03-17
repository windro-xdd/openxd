// PinchTab HTTP client for browser control
// Falls back to CDP if PinchTab daemon is not running

import { Log } from "../util/log"
import { Config } from "../config/config"

const log = Log.create({ service: "browser.pinchtab" })

export namespace PinchTab {
  let baseUrl = "http://localhost:9867"
  let available: boolean | null = null
  let instanceId: string | null = null
  let activeTabId: string | null = null

  export async function isAvailable(): Promise<boolean> {
    if (available !== null) return available
    const config = await Config.get()
    const cfg = (config as any).browser?.pinchtab
    if (cfg?.enabled === false) {
      available = false
      return false
    }
    baseUrl = cfg?.url ?? "http://localhost:9867"
    try {
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) })
      available = res.ok
      if (available) log.info("PinchTab daemon available", { url: baseUrl })
    } catch {
      available = false
    }
    return available
  }

  async function api<T = any>(method: string, path: string, body?: any): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`PinchTab ${method} ${path}: ${res.status} ${text}`)
    }
    const text = await res.text()
    return (text ? JSON.parse(text) : {}) as T
  }

  async function ensureInstance(): Promise<string> {
    if (instanceId) return instanceId
    // Launch a headless instance with default profile
    const data = await api<{ id: string }>("POST", "/instances/launch", {
      name: "opencode",
      mode: "headless",
    })
    instanceId = data.id
    log.info("PinchTab instance launched", { id: instanceId })
    return instanceId
  }

  async function ensureTab(): Promise<string> {
    if (activeTabId) return activeTabId
    const inst = await ensureInstance()
    const data = await api<{ tabId: string }>("POST", `/instances/${inst}/tabs/open`, { url: "about:blank" })
    activeTabId = data.tabId
    return activeTabId
  }

  // ==================== PUBLIC API ====================

  export async function listProfiles(): Promise<{ id: string; name: string; description?: string }[]> {
    return api("GET", "/profiles")
  }

  export async function createProfile(name: string, description?: string): Promise<{ id: string }> {
    return api("POST", "/profiles", { name, description })
  }

  export async function useProfile(profileId: string): Promise<void> {
    // Close current instance and launch with profile
    if (instanceId) {
      try {
        await api("DELETE", `/instances/${instanceId}`)
      } catch {}
      instanceId = null
      activeTabId = null
    }
    const data = await api<{ id: string }>("POST", "/instances/launch", {
      profileId,
      mode: "headless",
    })
    instanceId = data.id
    log.info("PinchTab using profile", { profileId, instanceId })
  }

  export async function listTabs(): Promise<{ id: string; url: string; title: string; active: boolean }[]> {
    const inst = await ensureInstance()
    const tabs = await api<any[]>("GET", `/instances/${inst}/tabs`)
    return tabs.map((t) => ({
      id: t.id,
      url: t.url,
      title: t.title,
      active: t.id === activeTabId,
    }))
  }

  export async function newTab(url?: string): Promise<{ id: string; url?: string }> {
    const inst = await ensureInstance()
    const data = await api<{ tabId: string }>("POST", `/instances/${inst}/tabs/open`, { url: url || "about:blank" })
    activeTabId = data.tabId
    return { id: data.tabId, url }
  }

  export async function closeTab(tabId: string): Promise<void> {
    await api("DELETE", `/tabs/${tabId}`)
    if (tabId === activeTabId) activeTabId = null
  }

  export async function focusTab(tabId: string): Promise<void> {
    activeTabId = tabId
  }

  export async function navigate(url: string): Promise<void> {
    const tabId = await ensureTab()
    await api("POST", `/tabs/${tabId}/navigate`, { url })
  }

  export async function snapshot(): Promise<{ title: string; url: string; tree: string; refCount: number }> {
    const tabId = await ensureTab()
    const data = await api<any>("GET", `/tabs/${tabId}/snapshot?filter=interactive`)
    // PinchTab returns { title, url, tree (string), refCount }
    return {
      title: data.title || "",
      url: data.url || "",
      tree: data.tree || "",
      refCount: data.refCount || 0,
    }
  }

  export async function screenshot(): Promise<string> {
    const tabId = await ensureTab()
    const data = await api<{ data: string }>("GET", `/tabs/${tabId}/screenshot`)
    return `data:image/png;base64,${data.data}`
  }

  export async function click(ref: number): Promise<string> {
    const tabId = await ensureTab()
    await api("POST", `/tabs/${tabId}/action`, { kind: "click", ref: `e${ref}` })
    return `Clicked [${ref}]`
  }

  export async function type(ref: number | null, text: string, clear = true, submit = false): Promise<string> {
    const tabId = await ensureTab()
    if (ref !== null) {
      if (clear) {
        await api("POST", `/tabs/${tabId}/action`, { kind: "clear", ref: `e${ref}` })
      }
      await api("POST", `/tabs/${tabId}/action`, { kind: "fill", ref: `e${ref}`, text })
    } else {
      await api("POST", `/tabs/${tabId}/action`, { kind: "type", text })
    }
    if (submit) {
      await api("POST", `/tabs/${tabId}/action`, { kind: "press", key: "Enter" })
    }
    return `Typed "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"${ref !== null ? ` into [${ref}]` : ""}${submit ? " + submitted" : ""}`
  }

  export async function press(key: string): Promise<string> {
    const tabId = await ensureTab()
    await api("POST", `/tabs/${tabId}/action`, { kind: "press", key })
    return `Pressed ${key}`
  }

  export async function scroll(
    direction: "up" | "down",
    amount = 500,
  ): Promise<{ scrollY: number; scrollHeight: number }> {
    const tabId = await ensureTab()
    const deltaY = direction === "up" ? -amount : amount
    await api("POST", `/tabs/${tabId}/action`, { kind: "scroll", deltaY })
    // PinchTab returns scroll position
    return { scrollY: 0, scrollHeight: 0 } // Approximation - PinchTab may return this
  }

  export async function evaluate(script: string): Promise<string> {
    const tabId = await ensureTab()
    const data = await api<{ result: any }>("POST", `/tabs/${tabId}/evaluate`, { expression: script })
    if (data.result === undefined || data.result === null) return ""
    if (typeof data.result === "object") return JSON.stringify(data.result, null, 2)
    return String(data.result)
  }

  export async function selectOption(ref: number, value: string): Promise<string> {
    const tabId = await ensureTab()
    await api("POST", `/tabs/${tabId}/action`, { kind: "select", ref: `e${ref}`, value })
    return `Selected "${value}" in [${ref}]`
  }

  // Token-efficient text extraction — the key PinchTab feature
  export async function extractText(): Promise<string> {
    const tabId = await ensureTab()
    const data = await api<{ text: string }>("GET", `/tabs/${tabId}/text`)
    return data.text || ""
  }

  export function stop(): void {
    if (instanceId) {
      api("DELETE", `/instances/${instanceId}`).catch(() => {})
      instanceId = null
      activeTabId = null
    }
  }
}
