# OpenCode Brain — Phase 2 Implementation Plan

## Goal
OpenCode body, OpenClaw mind. Make OpenCode a 24/7 daemon with remote access via Telegram, persistent memory with search, smart context management, heartbeat, and browser control.

---

## Feature 1: Telegram — Remote TUI

**Core concept:** Telegram is not a separate channel. It's a remote keyboard + screen for the same sessions the TUI uses. Like SSH from your phone.

### Behavior:
- First message from Telegram → creates a new session (same as opening TUI)
- Every message → goes into the current active session for that Telegram user
- Every response → visible in both Telegram AND TUI simultaneously
- Sessions created from Telegram appear as normal sessions in TUI
- Sessions created from TUI can be switched to from Telegram
- Each client (TUI / Telegram) has its own independent cursor (which session it's on)
- Both clients can be on the same session simultaneously

### Commands:
- `/new` — create fresh session
- `/sessions` — list all sessions
- `/switch <id>` — switch to a session
- `/current` — show active session

### Implementation:

**New files:**
- `packages/opencode/src/telegram/bot.ts` — Telegram bot (long polling, no webhook needed)
- `packages/opencode/src/telegram/state.ts` — per-user state (current session cursor)

**How it works:**
1. On server start, if `telegram.botToken` is in config, start the bot
2. Bot uses Telegram Bot API long polling (`getUpdates`)
3. Incoming message → look up user's current session (or create new one)
4. Call the existing session API to send the message (same code path as TUI)
5. Subscribe to session events (SSE bus) → forward responses back to Telegram
6. Split long responses for Telegram's 4096 char limit
7. Support markdown formatting (Telegram supports a subset)

**State storage:** Simple JSON file or SQLite table:
```
telegram_state: { chatId → { currentSessionId, userId } }
```

**Config:**
```json
{
  "telegram": {
    "botToken": "123:ABC...",
    "allowedUsers": [123456789]  // optional: restrict to specific Telegram user IDs
  }
}
```

**Files to modify:**
- `packages/opencode/src/config/config.ts` — add telegram config schema
- `packages/opencode/src/server/server.ts` — start telegram bot on server init (or in serve command)
- `packages/opencode/src/cli/cmd/serve.ts` — trigger telegram bot startup

**Dependencies:**
- None. Telegram Bot API is just HTTP calls. Use native fetch. No `node-telegram-bot-api` or `telegraf` needed.

---

## Feature 2: Daily Memory Files

**What:** `memory/YYYY-MM-DD.md` files for raw daily logs. Separate from curated MEMORY.md.

### Implementation:
- Extend `src/tool/memory.ts`:
  - Allow `file` param to accept `memory/YYYY-MM-DD.md` pattern (not just the 4 fixed files)
  - New action `"daily"` — auto-writes to today's `memory/YYYY-MM-DD.md`
  - New action `"list-daily"` — lists available daily files with dates
- `src/session/instruction.ts` — optionally load today's daily file on session start (if exists, lightweight)

**Search order for daily files:**
1. `.opencode/memory/YYYY-MM-DD.md`
2. `~/.config/opencode/memory/YYYY-MM-DD.md`

**Prompt addition (all prompt .txt files):**
```
# Daily Memory
Use the memory tool with action "daily" to log important events, decisions, and findings to today's daily file.
Daily files (memory/YYYY-MM-DD.md) are raw session notes. Periodically review them and promote key learnings to MEMORY.md.
```

---

## Feature 3: Memory Search

**What:** Search across MEMORY.md and all daily memory files. No vector DB, no embeddings, no external deps.

### Implementation:

**New file:** `packages/opencode/src/tool/memory-search.ts`

**Tool: `memory_search`**
```
Parameters:
  query: string          — what to search for
  maxResults?: number    — default 5

Returns:
  Array of { file, lineNumber, snippet, score }
  Snippets are ~5 lines of context around each match
```

**Search algorithm (pure TypeScript):**
1. Collect all memory files (MEMORY.md + memory/*.md)
2. Split each file into chunks by heading (## sections) or paragraphs
3. Score each chunk against query:
   - Exact phrase match → highest score
   - All query words present → high score
   - Partial word matches → medium score
   - Heading matches get 2x boost
4. Return top N with file path, line number, surrounding context

**Files to modify:**
- `packages/opencode/src/tool/memory-search.ts` — new
- `packages/opencode/src/tool/registry.ts` — register

**Prompt addition:**
```
# Memory Search
Before answering questions about prior work, decisions, or past context, use the memory_search tool
to find relevant information across MEMORY.md and daily memory files.
```

---

## Feature 4: Advanced Context Pruning

**What:** Smarter pruning of tool outputs to keep sessions alive longer.

### 4a. Soft Trim
Instead of fully clearing old tool outputs, keep head + tail:
- First 750 chars + `[... truncated X chars ...]` + last 750 chars
- Total kept: ~1500 chars instead of 0

**Modify:** `packages/opencode/src/session/compaction.ts` → `prune()`

### 4b. Priority-Based Pruning
Prune in order of disposability:
1. `ls` / `glob` outputs → prune first (trivial to re-run)
2. `bash` outputs → prune early (usually ephemeral)
3. `grep` / `codesearch` → prune medium
4. `read` outputs → prune last (contains actual file content the agent needs)
5. `skill` outputs → never prune (protected, already is)

**Modify:** `packages/opencode/src/session/compaction.ts` → add priority map to prune loop

### 4c. Memory Flush Before Full Compaction
Before full compaction triggers, auto-inject a step:
"Save any important context to MEMORY.md before this conversation is compacted."

**Modify:** `packages/opencode/src/session/compaction.ts` → `process()` — add pre-compaction memory save instruction

---

## Feature 5: Heartbeat System

**What:** Periodic wake-up for the daemon. Checks HEARTBEAT.md and executes tasks.

### Implementation:

**New file:** `packages/opencode/src/daemon/heartbeat.ts`

**How it works:**
1. `setInterval` inside the server process
2. On tick: read HEARTBEAT.md from project/global config
3. If empty or comments only → skip (no API call, no session creation)
4. If has tasks → create/reuse a dedicated heartbeat session, inject the prompt
5. Agent processes tasks, responds
6. Response logged but not sent anywhere (unless Telegram notifications are added later)

**Config:**
```json
{
  "daemon": {
    "heartbeat": {
      "enabled": false,
      "intervalMinutes": 30,
      "quietHours": { "start": "23:00", "end": "08:00" }
    }
  }
}
```

**HEARTBEAT.md location:**
1. `.opencode/HEARTBEAT.md`
2. `~/.config/opencode/HEARTBEAT.md`

**Files to modify:**
- `packages/opencode/src/daemon/heartbeat.ts` — new
- `packages/opencode/src/cli/cmd/serve.ts` — start heartbeat timer
- `packages/opencode/src/config/config.ts` — add daemon.heartbeat schema

---

## Feature 6: Browser Extension Relay

**What:** Control the user's actual Chrome tabs via extension. Not headless Playwright.

### Architecture:
```
Chrome Extension ←WebSocket→ OpenCode Server ←Tool→ Agent
```

### Components:

**Chrome Extension (`extensions/chrome/`):**
- Manifest V3
- Toolbar button → click to attach current tab
- Content script: snapshot DOM, execute clicks/types/scrolls
- Background service worker: WebSocket to localhost OpenCode server
- Badge shows ON/OFF state

**WebSocket endpoint in server:**
- `/ws/browser` — Chrome extension connects here
- Receives commands from browser tool, forwards to extension
- Receives snapshots/responses from extension, returns to tool

**Browser tool (`packages/opencode/src/tool/browser.ts`):**
```
Actions:
  tabs      — list attached tabs
  snapshot  — get DOM/accessibility snapshot of current tab
  screenshot — capture current tab
  click     — click element by ref/selector
  type      — type text into element
  navigate  — go to URL
  console   — get console logs
```

**Files:**
- `extensions/chrome/manifest.json` — new
- `extensions/chrome/background.js` — new
- `extensions/chrome/content.js` — new
- `extensions/chrome/popup.html` + `popup.js` — new
- `packages/opencode/src/browser/relay.ts` — new (WebSocket handler)
- `packages/opencode/src/tool/browser.ts` — new
- `packages/opencode/src/tool/registry.ts` — register

**Config:**
```json
{
  "browser": {
    "relay": {
      "enabled": true,
      "port": 4097
    }
  }
}
```

---

## Implementation Order

### Phase 2a: Telegram (most impactful — remote access)
1. Telegram bot module (long polling, native fetch)
2. Session cursor state per user
3. Config schema
4. Wire into serve command

### Phase 2b: Memory Search + Daily Files
5. Extend memory tool for daily files
6. Memory search tool (keyword scoring)
7. Update prompts

### Phase 2c: Advanced Pruning
8. Soft trim in prune()
9. Priority-based pruning order
10. Pre-compaction memory flush

### Phase 2d: Heartbeat
11. Heartbeat timer module
12. HEARTBEAT.md reader
13. Config + serve integration

### Phase 2e: Browser Relay
14. Chrome extension
15. WebSocket relay
16. Browser tool

---

## Principles
- **No external dependencies** where possible (no telegraf, no ws lib, no vector DB)
- **Edit OpenCode source directly** — these aren't plugins, they're core features
- **Keep it simple** — no gateway, no channel routing, no abstraction layers
- **Same sessions everywhere** — Telegram and TUI share the same session pool
- **One process** — server handles everything (API, Telegram, heartbeat, browser relay)
