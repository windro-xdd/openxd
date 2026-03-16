// OpenCode Browser Relay — Background Service Worker
// Full browser control with numbered element refs

const DEFAULT_PORT = 4097
let ws = null
let wsReady = false
let reconnectTimer = null
// Store element refs from last snapshot per tab
const elementRefs = new Map() // tabId -> Map<refNum, {selector, center, tag, text}>

function log(...args) {
  console.log("[OpenCode Relay]", ...args)
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
  const url = `ws://127.0.0.1:${DEFAULT_PORT}/ws`
  log("connecting to", url)
  try {
    ws = new WebSocket(url)
  } catch (err) {
    log("connection error:", err.message || err)
    scheduleReconnect()
    return
  }

  ws.addEventListener("open", () => {
    log("connected")
    wsReady = true
    clearReconnectTimer()
    updateBadge()
  })

  ws.addEventListener("message", async (event) => {
    try {
      const msg = JSON.parse(event.data)
      const response = await handleCommand(msg)
      if (response) {
        ws.send(JSON.stringify({ id: msg.id, data: response }))
      }
    } catch (err) {
      log("message error:", err)
      try {
        const msg = JSON.parse(event.data)
        ws.send(JSON.stringify({ id: msg.id, error: err.message }))
      } catch {}
    }
  })

  ws.onclose = () => {
    log("disconnected")
    wsReady = false
    ws = null
    updateBadge()
    scheduleReconnect()
  }

  ws.onerror = (err) => {
    log("websocket error event", err.type || err)
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

function updateBadge() {
  chrome.action.setBadgeText({ text: wsReady ? "ON" : "" })
  chrome.action.setBadgeBackgroundColor({ color: wsReady ? "#4CAF50" : "#757575" })
}

async function getTargetTab(tabId) {
  if (tabId) return parseInt(tabId)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

function waitForLoad(tabId, timeoutMs = 15000) {
  return new Promise((resolve) => {
    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener)
        setTimeout(resolve, 1000)
      }
    }
    chrome.tabs.onUpdated.addListener(listener)
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener)
      resolve()
    }, timeoutMs)
  })
}

async function handleCommand(msg) {
  const tabId = await getTargetTab(msg.tabId)

  switch (msg.action) {
    case "tabs": {
      const tabs = await chrome.tabs.query({})
      return {
        tabs: tabs.map(t => ({
          id: String(t.id),
          url: t.url,
          title: t.title,
          active: t.active,
          windowId: t.windowId,
        }))
      }
    }

    case "tab.new": {
      const tab = await chrome.tabs.create({ url: msg.url || "about:blank", active: msg.active !== false })
      if (msg.url && msg.url !== "about:blank") await waitForLoad(tab.id)
      return { id: String(tab.id), url: tab.url, title: tab.title }
    }

    case "tab.close": {
      if (!tabId) throw new Error("No tab specified")
      await chrome.tabs.remove(tabId)
      return { message: `Closed tab ${tabId}` }
    }

    case "tab.focus": {
      if (!tabId) throw new Error("No tab specified")
      const tab = await chrome.tabs.update(tabId, { active: true })
      await chrome.windows.update(tab.windowId, { focused: true })
      return { message: `Focused tab ${tabId}` }
    }

    case "navigate": {
      if (!tabId) throw new Error("No active tab")
      await chrome.tabs.update(tabId, { url: msg.url })
      await waitForLoad(tabId)
      return { message: `Navigated to ${msg.url}` }
    }

    case "snapshot": {
      if (!tabId) throw new Error("No active tab")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          let refCounter = 0
          const refs = {}

          function getLabel(el) {
            // Check aria-label
            const aria = el.getAttribute("aria-label")
            if (aria) return aria
            // Check associated label
            if (el.id) {
              const label = document.querySelector(`label[for="${el.id}"]`)
              if (label) return label.textContent.trim()
            }
            // Check parent label
            const parentLabel = el.closest("label")
            if (parentLabel) {
              const text = parentLabel.textContent.trim()
              if (text) return text
            }
            // Placeholder
            if (el.placeholder) return el.placeholder
            // Title
            if (el.title) return el.title
            return null
          }

          function getVisibleText(el) {
            let text = ""
            for (const child of el.childNodes) {
              if (child.nodeType === 3) text += child.textContent
            }
            return text.trim().slice(0, 150)
          }

          function isVisible(el) {
            const style = window.getComputedStyle(el)
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false
            const rect = el.getBoundingClientRect()
            if (rect.width === 0 && rect.height === 0) return false
            return true
          }

          function isInteractive(el) {
            const tag = el.tagName?.toLowerCase()
            if (["a", "button", "input", "textarea", "select", "details", "summary"].includes(tag)) return true
            if (el.getAttribute("role") === "button" || el.getAttribute("role") === "link" ||
                el.getAttribute("role") === "tab" || el.getAttribute("role") === "menuitem" ||
                el.getAttribute("role") === "checkbox" || el.getAttribute("role") === "radio" ||
                el.getAttribute("role") === "switch" || el.getAttribute("role") === "option") return true
            if (el.onclick || el.getAttribute("onclick") || el.tabIndex >= 0) return true
            if (el.getAttribute("contenteditable") === "true") return true
            return false
          }

          function generateSelector(el) {
            if (el.id) return `#${CSS.escape(el.id)}`
            // Try data attributes
            for (const attr of ["data-testid", "data-cy", "data-test", "name"]) {
              const val = el.getAttribute(attr)
              if (val) return `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`
            }
            // Nth-of-type path
            const path = []
            let current = el
            while (current && current !== document.body && path.length < 5) {
              let sel = current.tagName.toLowerCase()
              if (current.id) { path.unshift(`#${CSS.escape(current.id)}`); break }
              const parent = current.parentElement
              if (parent) {
                const siblings = Array.from(parent.children).filter(c => c.tagName === current.tagName)
                if (siblings.length > 1) sel += `:nth-of-type(${siblings.indexOf(current) + 1})`
              }
              path.unshift(sel)
              current = current.parentElement
            }
            return path.join(" > ")
          }

          function snapshot(el, depth = 0, lines = []) {
            if (depth > 8) return lines
            const tag = el.tagName?.toLowerCase()
            if (!tag) return lines
            if (["script", "style", "noscript", "svg", "path", "meta", "link", "template", "iframe"].includes(tag)) return lines
            if (!isVisible(el)) return lines

            const indent = "  ".repeat(depth)
            const role = el.getAttribute("role")
            const interactive = isInteractive(el)
            const text = getVisibleText(el)
            const label = getLabel(el)

            if (interactive) {
              refCounter++
              const ref = refCounter
              const rect = el.getBoundingClientRect()
              const selector = generateSelector(el)

              refs[ref] = {
                selector,
                center: { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) },
                tag,
                label: label || text || null,
                type: el.type || null,
                value: el.value || null,
              }

              // Format based on element type
              if (tag === "input" || tag === "textarea") {
                const inputType = el.type || "text"
                const val = el.value ? ` value="${el.value}"` : ""
                const ph = el.placeholder ? ` placeholder="${el.placeholder}"` : ""
                const lbl = label ? `"${label}" ` : ""
                lines.push(`${indent}[${ref}] ${lbl}<${tag} type="${inputType}"${ph}${val}>`)
              } else if (tag === "select") {
                const selected = el.options?.[el.selectedIndex]?.text || ""
                const lbl = label ? `"${label}" ` : ""
                lines.push(`${indent}[${ref}] ${lbl}<select> = "${selected}"`)
              } else if (tag === "a") {
                const href = el.href ? ` → ${el.href}` : ""
                lines.push(`${indent}[${ref}] link "${text || label || ""}${href}"`)
              } else {
                const roleStr = role ? ` role="${role}"` : ""
                lines.push(`${indent}[${ref}] <${tag}${roleStr}> "${text || label || ""}"`)
              }
            } else {
              // Non-interactive structural elements
              if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag) && text) {
                lines.push(`${indent}${tag}: ${text}`)
              } else if (tag === "p" && text) {
                lines.push(`${indent}${text}`)
              } else if (tag === "img") {
                const alt = el.alt || el.getAttribute("aria-label") || ""
                if (alt) lines.push(`${indent}img: "${alt}"`)
              } else if (["nav", "main", "header", "footer", "section", "article", "aside", "form"].includes(tag)) {
                const lbl = el.getAttribute("aria-label") || role || tag
                lines.push(`${indent}[${lbl}]`)
              } else if (tag === "label" && text) {
                // Don't double-print labels that are already shown with their inputs
              } else if (text && !el.children.length) {
                // Leaf text node
                if (text.length > 0) lines.push(`${indent}${text}`)
              }
            }

            for (const child of el.children) {
              snapshot(child, depth + 1, lines)
            }
            return lines
          }

          const lines = snapshot(document.body)
          const maxLines = 500
          const truncated = lines.length > maxLines
          const output = (truncated ? lines.slice(0, maxLines) : lines).join("\n")

          return {
            url: location.href,
            title: document.title,
            snapshot: output + (truncated ? `\n...(${lines.length - maxLines} more lines truncated)` : ""),
            refs,
            refCount: refCounter,
          }
        }
      })
      const result = results[0]?.result
      if (result?.refs) {
        elementRefs.set(tabId, result.refs)
      }
      return result
    }

    case "screenshot": {
      if (!tabId) throw new Error("No active tab")
      const tab = await chrome.tabs.get(tabId)
      const [currentTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId })
      const needSwitch = currentTab && currentTab.id !== tabId
      if (needSwitch) {
        await chrome.tabs.update(tabId, { active: true })
        await new Promise(r => setTimeout(r, 300))
      }
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" })
      if (needSwitch && currentTab) {
        await chrome.tabs.update(currentTab.id, { active: true })
      }
      return { data: dataUrl }
    }

    case "click": {
      if (!tabId) throw new Error("No active tab")

      // Support clicking by ref number
      if (msg.ref !== undefined) {
        const refs = elementRefs.get(tabId)
        if (!refs || !refs[msg.ref]) throw new Error(`Ref [${msg.ref}] not found. Take a new snapshot first.`)
        const ref = refs[msg.ref]
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (selector, center) => {
            let el = document.querySelector(selector)
            if (!el) {
              // Fallback: click at coordinates
              el = document.elementFromPoint(center.x, center.y)
            }
            if (!el) throw new Error("Element not found by selector or coordinates")
            el.scrollIntoView({ behavior: "smooth", block: "center" })
            el.click()
            return { message: `Clicked [ref] at ${selector}` }
          },
          args: [ref.selector, ref.center]
        })
        return results[0]?.result
      }

      // Click by selector
      if (msg.selector) {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (selector) => {
            const el = document.querySelector(selector)
            if (!el) throw new Error(`Element not found: ${selector}`)
            el.scrollIntoView({ behavior: "smooth", block: "center" })
            el.click()
            return { message: `Clicked ${selector}` }
          },
          args: [msg.selector]
        })
        return results[0]?.result
      }

      // Click by text
      if (msg.text) {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (text) => {
            // Try buttons and links first
            const candidates = [...document.querySelectorAll("a, button, [role=button], input[type=submit], input[type=button]")]
            for (const el of candidates) {
              const elText = el.textContent?.trim() || el.value || el.getAttribute("aria-label") || ""
              if (elText.toLowerCase().includes(text.toLowerCase())) {
                el.scrollIntoView({ behavior: "smooth", block: "center" })
                el.click()
                return { message: `Clicked "${elText}"` }
              }
            }
            // Fallback: any element with matching text
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
            while (walker.nextNode()) {
              if (walker.currentNode.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
                const el = walker.currentNode.parentElement
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" })
                  el.click()
                  return { message: `Clicked element with text "${text}"` }
                }
              }
            }
            throw new Error(`No clickable element found with text: ${text}`)
          },
          args: [msg.text]
        })
        return results[0]?.result
      }

      // Click by coordinates
      if (msg.x !== undefined && msg.y !== undefined) {
        const results = await chrome.scripting.executeScript({
          target: { tabId },
          func: (x, y) => {
            const el = document.elementFromPoint(x, y)
            if (!el) throw new Error(`No element at coordinates (${x}, ${y})`)
            el.click()
            return { message: `Clicked at (${x}, ${y}) on <${el.tagName.toLowerCase()}>` }
          },
          args: [msg.x, msg.y]
        })
        return results[0]?.result
      }

      throw new Error("click requires ref, selector, text, or x/y coordinates")
    }

    case "type": {
      if (!tabId) throw new Error("No active tab")

      let selector = msg.selector
      // Resolve ref to selector
      if (msg.ref !== undefined) {
        const refs = elementRefs.get(tabId)
        if (!refs || !refs[msg.ref]) throw new Error(`Ref [${msg.ref}] not found. Take a new snapshot first.`)
        selector = refs[msg.ref].selector
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, text, clear, submit) => {
          const el = selector ? document.querySelector(selector) : document.activeElement
          if (!el) throw new Error(`Element not found: ${selector || "no focused element"}`)
          el.focus()
          el.scrollIntoView({ behavior: "smooth", block: "center" })
          if (clear !== false) {
            el.value = ""
            el.dispatchEvent(new Event("input", { bubbles: true }))
          }
          // Simulate typing character by character for React/Vue compatibility
          for (const char of text) {
            el.value += char
            el.dispatchEvent(new InputEvent("input", { bubbles: true, data: char, inputType: "insertText" }))
          }
          el.dispatchEvent(new Event("change", { bubbles: true }))
          if (submit) {
            const form = el.closest("form")
            if (form) {
              form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
              const submitBtn = form.querySelector("[type=submit], button:not([type=button])")
              if (submitBtn) submitBtn.click()
            } else {
              el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }))
              el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }))
            }
          }
          return { message: `Typed "${text}" into ${selector || "focused element"}${submit ? " and submitted" : ""}` }
        },
        args: [selector, msg.text, msg.clear, msg.submit]
      })
      return results[0]?.result
    }

    case "select": {
      if (!tabId) throw new Error("No active tab")
      let selector = msg.selector
      if (msg.ref !== undefined) {
        const refs = elementRefs.get(tabId)
        if (!refs || !refs[msg.ref]) throw new Error(`Ref [${msg.ref}] not found.`)
        selector = refs[msg.ref].selector
      }
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (selector, value) => {
          const el = document.querySelector(selector)
          if (!el || el.tagName.toLowerCase() !== "select") throw new Error("Select element not found")
          // Try by value first, then by visible text
          let found = false
          for (const opt of el.options) {
            if (opt.value === value || opt.textContent.trim().toLowerCase() === value.toLowerCase()) {
              el.value = opt.value
              found = true
              break
            }
          }
          if (!found) throw new Error(`Option "${value}" not found`)
          el.dispatchEvent(new Event("change", { bubbles: true }))
          return { message: `Selected "${value}"` }
        },
        args: [selector, msg.value]
      })
      return results[0]?.result
    }

    case "scroll": {
      if (!tabId) throw new Error("No active tab")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (direction, amount) => {
          const y = direction === "up" ? -amount : amount
          window.scrollBy({ top: y, behavior: "smooth" })
          return { scrollY: window.scrollY, scrollHeight: document.body.scrollHeight, innerHeight: window.innerHeight }
        },
        args: [msg.direction || "down", msg.amount || 500]
      })
      return results[0]?.result
    }

    case "evaluate": {
      if (!tabId) throw new Error("No active tab")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (script) => {
          try {
            const result = eval(script)
            return { result: typeof result === "object" ? JSON.stringify(result) : String(result) }
          } catch (e) {
            return { error: e.message }
          }
        },
        args: [msg.script]
      })
      return results[0]?.result
    }

    case "console": {
      if (!tabId) throw new Error("No active tab")
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => ({ logs: window.__opencode_console_logs || [] })
      })
      return results[0]?.result
    }

    case "windows": {
      const windows = await chrome.windows.getAll({ populate: true })
      return {
        windows: windows.map(w => ({
          id: w.id,
          focused: w.focused,
          tabCount: w.tabs?.length ?? 0,
        }))
      }
    }

    case "window.new": {
      const win = await chrome.windows.create({ url: msg.url, focused: true })
      return { windowId: win.id }
    }

    default:
      throw new Error(`Unknown action: ${msg.action}`)
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "status") {
    sendResponse({ connected: wsReady })
    return true
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  elementRefs.delete(tabId)
})

connect()

chrome.alarms.create("keepalive", { periodInMinutes: 0.4 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepalive") {
    if (!ws || ws.readyState !== WebSocket.OPEN) connect()
  }
})
