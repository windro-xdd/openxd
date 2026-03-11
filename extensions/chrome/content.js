// OpenCode Browser Relay — Content Script
// Intercepts console logs for the agent

(function() {
  if (window.__opencode_console_injected) return
  window.__opencode_console_injected = true

  window.__opencode_console_logs = []
  const MAX_LOGS = 100

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
  }

  function capture(level, args) {
    const text = Array.from(args).map(a => {
      try {
        return typeof a === "object" ? JSON.stringify(a) : String(a)
      } catch {
        return String(a)
      }
    }).join(" ")

    window.__opencode_console_logs.push({
      level,
      text,
      timestamp: Date.now()
    })

    // Keep only last N logs
    if (window.__opencode_console_logs.length > MAX_LOGS) {
      window.__opencode_console_logs = window.__opencode_console_logs.slice(-MAX_LOGS)
    }
  }

  console.log = function(...args) {
    capture("log", args)
    originalConsole.log.apply(console, args)
  }
  console.warn = function(...args) {
    capture("warn", args)
    originalConsole.warn.apply(console, args)
  }
  console.error = function(...args) {
    capture("error", args)
    originalConsole.error.apply(console, args)
  }
  console.info = function(...args) {
    capture("info", args)
    originalConsole.info.apply(console, args)
  }
})()
