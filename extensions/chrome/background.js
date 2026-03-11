// OpenCode Browser Relay — Background Service Worker

const DEFAULT_PORT = 4097
let ws = null
let wsReady = false
let attachedTabs = new Set()
let reconnectTimer = null

function log(...args) {
  console.log("[OpenCode Relay]", ...args)
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return

  const port = DEFAULT_PORT
  const url = `ws://127.0.0.1:${port}/ws`
  log("connecting to", url)

  try {
    ws = new WebSocket(url)
  } catch (err) {
    log("connection failed:", err)
    scheduleReconnect()
    return
  }

  ws.onopen = () => {
    log("connected")
    wsReady = true
    clearReconnectTimer()
    // Notify extension of connection status
    updateBadges()
    // Re-announce attached tabs
    for (const tabId of attachedTabs) {
      chrome.tabs.get(tabId, (tab) => {
        if (tab) {
          ws.send(JSON.stringify({
            type: "tab.attached",
            tab: { id: String(tabId), url: tab.url, title: tab.title }
          }))
        }
      })
    }
  }

  ws.onmessage = async (event) => {
    try {
      const msg = JSON.parse(event.data)
      const response = await handleCommand(msg)
      if (response) {
        ws.send(JSON.stringify({ id: msg.id, data: response }))
      }
    } catch (err) {
      log("message error:", err)
      if (event.data) {
        try {
          const msg = JSON.parse(event.data)
          ws.send(JSON.stringify({ id: msg.id, error: err.message }))
        } catch {}
      }
    }
  }

  ws.onclose = () => {
    log("disconnected")
    wsReady = false
    ws = null
    updateBadges()
    scheduleReconnect()
  }

  ws.onerror = () => {
    wsReady = false
  }
}

function scheduleReconnect() {
  clearReconnectTimer()
  reconnectTimer = setTimeout(connect, 5000)
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function updateBadges() {
  const text = wsReady && attachedTabs.size > 0 ? "ON" : ""
  const color = wsReady ? "#4CAF50" : "#757575"
  chrome.action.setBadgeText({ text })
  chrome.action.setBadgeBackgroundColor({ color })
}

// Get the target tab for a command
function getTargetTab(tabId) {
  if (tabId) return parseInt(tabId)
  // Default: first attached tab
  const first = attachedTabs.values().next()
  return first.done ? null : first.value
}

async function handleCommand(msg) {
  const tabId = getTargetTab(msg.tabId)

  switch (msg.action) {
    case "snapshot": {
      if (!tabId) throw new Error("No tab attached")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Build a simplified accessibility tree
          function snapshot(el, depth = 0) {
            if (depth > 10) return null
            const tag = el.tagName?.toLowerCase()
            if (!tag) return null
            // Skip hidden elements
            const style = window.getComputedStyle(el)
            if (style.display === "none" || style.visibility === "hidden") return null

            const node = { tag }

            // Collect useful attributes
            const role = el.getAttribute("role")
            const ariaLabel = el.getAttribute("aria-label")
            const text = el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
              ? el.childNodes[0].textContent?.trim()
              : null

            if (role) node.role = role
            if (ariaLabel) node.label = ariaLabel
            if (text && text.length < 200) node.text = text
            if (el.id) node.id = el.id
            if (el.className && typeof el.className === "string") {
              const cls = el.className.trim()
              if (cls.length < 100) node.class = cls
            }
            if (el.href) node.href = el.href
            if (el.src) node.src = el.src
            if (el.type) node.type = el.type
            if (el.value !== undefined && el.value !== "") node.value = el.value
            if (el.placeholder) node.placeholder = el.placeholder

            // Children
            const children = []
            for (const child of el.children) {
              const snap = snapshot(child, depth + 1)
              if (snap) children.push(snap)
            }
            if (children.length > 0) node.children = children

            return node
          }

          return {
            url: location.href,
            title: document.title,
            snapshot: JSON.stringify(snapshot(document.body), null, 2)
          }
        }
      })
      return results[0]?.result
    }

    case "screenshot": {
      if (!tabId) throw new Error("No tab attached")
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: "png" })
      return { data: dataUrl, width: 0, height: 0 }
    }

    case "click": {
      if (!tabId) throw new Error("No tab attached")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, text) => {
          if (selector) {
            const el = document.querySelector(selector)
            if (!el) throw new Error(`Element not found: ${selector}`)
            el.click()
            return { message: `Clicked ${selector}` }
          }
          if (text) {
            // Find by text content
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              if (walker.currentNode.textContent.trim().includes(text)) {
                const el = walker.currentNode.parentElement
                if (el) { el.click(); return { message: `Clicked element with text "${text}"` } }
              }
            }
            throw new Error(`No element found with text: ${text}`)
          }
          throw new Error("No selector or text provided")
        },
        args: [msg.selector, msg.text]
      })
      return results[0]?.result
    }

    case "type": {
      if (!tabId) throw new Error("No tab attached")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, text) => {
          const el = document.querySelector(selector)
          if (!el) throw new Error(`Element not found: ${selector}`)
          el.focus()
          el.value = text
          el.dispatchEvent(new Event("input", { bubbles: true }))
          el.dispatchEvent(new Event("change", { bubbles: true }))
          return { message: `Typed "${text}" into ${selector}` }
        },
        args: [msg.selector, msg.text]
      })
      return results[0]?.result
    }

    case "navigate": {
      if (!tabId) throw new Error("No tab attached")
      await chrome.tabs.update(tabId, { url: msg.url })
      return { message: `Navigating to ${msg.url}` }
    }

    case "scroll": {
      if (!tabId) throw new Error("No tab attached")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (direction, amount) => {
          const y = direction === "up" ? -amount : amount
          window.scrollBy(0, y)
          return { scrollY: window.scrollY }
        },
        args: [msg.direction || "down", msg.amount || 500]
      })
      return results[0]?.result
    }

    case "console": {
      // Console logs need to be collected by content script
      if (!tabId) throw new Error("No tab attached")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return { logs: window.__opencode_console_logs || [] }
        }
      })
      return results[0]?.result
    }

    case "evaluate": {
      if (!tabId) throw new Error("No tab attached")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (script) => {
          try {
            const result = eval(script)
            return { result: typeof result === "object" ? JSON.stringify(result) : String(result) }
          } catch (e) {
            return { result: `Error: ${e.message}` }
          }
        },
        args: [msg.script]
      })
      return results[0]?.result
    }

    default:
      throw new Error(`Unknown action: ${msg.action}`)
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "toggle") {
    const tabId = msg.tabId
    if (attachedTabs.has(tabId)) {
      attachedTabs.delete(tabId)
      if (wsReady) {
        ws.send(JSON.stringify({ type: "tab.detached", tabId: String(tabId) }))
      }
    } else {
      attachedTabs.add(tabId)
      chrome.tabs.get(tabId, (tab) => {
        if (wsReady && tab) {
          ws.send(JSON.stringify({
            type: "tab.attached",
            tab: { id: String(tabId), url: tab.url, title: tab.title }
          }))
        }
      })
    }
    updateBadges()
    sendResponse({ attached: attachedTabs.has(tabId), connected: wsReady })
    return true
  }

  if (msg.type === "status") {
    sendResponse({
      connected: wsReady,
      attachedTabs: Array.from(attachedTabs),
    })
    return true
  }
})

// Track tab URL changes for attached tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (attachedTabs.has(tabId) && changeInfo.url && wsReady) {
    ws.send(JSON.stringify({
      type: "tab.updated",
      tab: { id: String(tabId), url: tab.url, title: tab.title }
    }))
  }
})

// Remove closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (attachedTabs.has(tabId)) {
    attachedTabs.delete(tabId)
    if (wsReady) {
      ws.send(JSON.stringify({ type: "tab.detached", tabId: String(tabId) }))
    }
    updateBadges()
  }
})

// Start connection
connect()
