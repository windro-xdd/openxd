chrome.runtime.sendMessage({ type: "status" }, (res) => {
  const el = document.getElementById("status")
  if (res?.connected) {
    el.className = "status connected"
    el.textContent = "🟢 Connected to OpenCode"
  } else {
    el.className = "status disconnected"
    el.textContent = "🔴 Not connected — is serve running?"
  }
})
