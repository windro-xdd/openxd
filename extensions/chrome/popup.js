document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status")
  const toggleBtn = document.getElementById("toggleBtn")
  const tabInfoEl = document.getElementById("tabInfo")

  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab) {
    statusEl.textContent = "No active tab"
    return
  }

  // Check status
  chrome.runtime.sendMessage({ type: "status" }, (response) => {
    if (!response) return

    const isConnected = response.connected
    const isAttached = response.attachedTabs.includes(tab.id)

    // Update status
    statusEl.className = `status ${isConnected ? "connected" : "disconnected"}`
    statusEl.textContent = isConnected
      ? `✓ Connected to OpenCode`
      : `✗ Not connected — is opencode serve running?`

    // Update button
    toggleBtn.disabled = !isConnected
    if (isAttached) {
      toggleBtn.textContent = "🔴 Detach This Tab"
      toggleBtn.className = "detach"
      tabInfoEl.style.display = "block"
      tabInfoEl.textContent = `📌 ${tab.title}\n${tab.url}`
    } else {
      toggleBtn.textContent = "🟢 Attach This Tab"
      toggleBtn.className = "attach"
      tabInfoEl.style.display = "none"
    }
  })

  // Toggle handler
  toggleBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "toggle", tabId: tab.id }, (response) => {
      if (!response) return

      if (response.attached) {
        toggleBtn.textContent = "🔴 Detach This Tab"
        toggleBtn.className = "detach"
        tabInfoEl.style.display = "block"
        tabInfoEl.textContent = `📌 ${tab.title}\n${tab.url}`
      } else {
        toggleBtn.textContent = "🟢 Attach This Tab"
        toggleBtn.className = "attach"
        tabInfoEl.style.display = "none"
      }
    })
  })
})
