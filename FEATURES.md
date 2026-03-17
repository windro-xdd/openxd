# OpenCode (Custom Fork) — Feature Reference

> This document describes the custom features added on top of upstream OpenCode (sst/opencode).
> Use it to understand what this fork can do that vanilla OpenCode and Claude Code cannot.

---

## Architecture Overview

This fork transforms OpenCode from a **single-session coding CLI** into a **persistent, multi-interface AI agent** with memory, daemon mode, browser control, and messaging integrations.

```
┌─────────────────────────────────────────────────┐
│                   OpenCode Agent                │
│                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ TUI/CLI  │  │ Telegram │  │ Browser Ext  │  │
│  │ (local)  │  │   Bot    │  │  (Chrome)    │  │
│  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       │              │               │          │
│  ┌────┴──────────────┴───────────────┴───────┐  │
│  │              Session Engine               │  │
│  │  (multi-session, compaction, history)     │  │
│  └────┬──────────────┬───────────────┬───────┘  │
│       │              │               │          │
│  ┌────┴────┐  ┌──────┴─────┐  ┌─────┴───────┐  │
│  │ Memory  │  │  Heartbeat │  │  Browser    │  │
│  │ System  │  │  /Daemon   │  │  CDP Tools  │  │
│  └─────────┘  └────────────┘  └─────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 1. Persistent Memory System

### What it does
The agent has long-term memory that persists across sessions. It can read, write, search, and maintain memory files without any special permissions.

### Tools

#### `memory` tool
- **Actions:** `read`, `write`, `append`, `daily`, `list-daily`, `lesson`
- **Files it manages:**
  - `MEMORY.md` — long-term curated knowledge (decisions, preferences, important context)
  - `LESSONS.md` — mistakes and lessons learned (patterns to avoid)
  - `SOUL.md` — agent personality and behavioral guidelines
  - `USER.md` — information about the human (name, timezone, preferences)
  - `IDENTITY.md` — agent's name, vibe, emoji, avatar
  - `memory/YYYY-MM-DD.md` — daily logs of events, decisions, findings
- **`lesson` action** — immediately logs mistakes when corrected. Format: what went wrong → what to do instead
- **No permission required** — memory reads/writes are always allowed

#### `memory_search` tool
- **Searches across** all memory files (MEMORY.md + all daily files in `memory/`)
- **Returns:** matching snippets with file path, line number, and relevance score
- **Use case:** before answering questions about prior work, decisions, preferences, or past context
- **Ranking:** TF-IDF style scoring with word tokenization

### Source files
- `packages/opencode/src/tool/memory.ts` (248 lines)
- `packages/opencode/src/tool/memory-search.ts` (265 lines)

---

## 2. Identity & Instruction System

### What it does
The agent loads personality, identity, and contextual files at session start to maintain a consistent persona across sessions. This goes far beyond CLAUDE.md or AGENTS.md.

### Files loaded every session
| File | Purpose |
|------|---------|
| `AGENTS.md` / `CLAUDE.md` / `CONTEXT.md` | Standard instruction files (first found wins) |
| `MEMORY.md` | Long-term curated knowledge |
| `SOUL.md` | Agent personality, tone, behavioral guidelines |
| `USER.md` | Human's info (name, timezone, preferences) |
| `IDENTITY.md` | Agent's own name, creature type, vibe, emoji |
| `LESSONS.md` | Past mistakes and patterns to avoid |
| `memory/YYYY-MM-DD.md` | Today's + yesterday's daily notes for recent context |

### File resolution
- Searches project `.opencode/` directory, project root, and global `~/.config/opencode/`
- Caps instruction file sizes to prevent context window overflow
- Supports glob patterns for additional instruction files via config

### Source files
- `packages/opencode/src/session/instruction.ts` (expanded with ALWAYS_LOAD_FILES, daily file loading, size caps)

---

## 3. Session History Tool

### What it does
Allows the agent to search through past messages in a session — including messages that have been compacted (summarized) away from active context.

### Tool: `session_history`
- **Actions:**
  - `search` — keyword search across all messages in the session (including compacted ones)
  - `recent` — get the N most recent messages
  - `get` — get a specific range of messages by index
- **Searches:** text parts and tool call inputs/outputs
- **Cross-session:** can optionally search a different session by ID

### Why it matters
After compaction, the agent loses access to earlier conversation turns. This tool lets it recover that context on demand — the user can reference something from 50 messages ago and the agent can find it.

### Source files
- `packages/opencode/src/tool/session-history.ts` (115 lines)

---

## 4. Advanced Compaction

### What it does
Token-budget-aware sliding window compaction that keeps as many recent turns as fit within 35% of the model's context window.

### Behavior
- **Token budget:** 35% of model context window (e.g., 70K tokens for a 200K model)
- **Minimum:** always keeps at least 3 turns
- **Maximum:** caps at 30 turns
- **Fallback:** minimum 3 turns if budget is exceeded
- Plugin hook support for pre-compaction context injection

### Source files
- `packages/opencode/src/session/compaction.ts` (701 lines)

---

## 5. Daemon Mode & Heartbeat

### What it does
The agent can run as a background daemon process with periodic heartbeat checks — it stays alive and proactively performs tasks.

### Daemon (`opencode daemon`)
- Runs OpenCode as a background process
- Manages PID file for process tracking
- Starts Telegram bot and browser relay if configured
- Handles graceful shutdown

### Heartbeat system
- **Configurable interval** — how often to check (in minutes)
- **Quiet hours** — time range to skip heartbeats (e.g., 23:00-08:00)
- **HEARTBEAT.md** — file that defines what to check during heartbeats
- **Smart skip** — if HEARTBEAT.md is empty or only comments, skips the heartbeat (no API call wasted)
- **Dedicated session** — heartbeats run in their own session to avoid polluting main conversation

### Config
```json
{
  "daemon": {
    "heartbeat": {
      "enabled": true,
      "intervalMinutes": 30,
      "quietHours": { "start": "23:00", "end": "08:00" }
    }
  }
}
```

### Source files
- `packages/opencode/src/cli/cmd/daemon.ts` (207 lines)
- `packages/opencode/src/daemon/heartbeat.ts` (142 lines)

---

## 6. Telegram Bot Integration

### What it does
Full Telegram bot that lets you interact with the agent from your phone. Supports multi-session management, inline keyboards, and session switching.

### Commands
| Command | Action |
|---------|--------|
| `/start` / `/new` | Create a new session |
| `/sessions` | List recent sessions with inline keyboard picker |
| Any text message | Sends to current session and streams the response back |

### Features
- **Session management** — switch between sessions via inline keyboard buttons
- **Chat actions** — shows "typing..." while processing
- **Message chunking** — handles Telegram's 4096 char limit by splitting long responses
- **Markdown parsing** — sends responses with Markdown formatting
- **Persistent state** — tracks which user is mapped to which session via `TelegramState`
- **Callback queries** — handles `switch:{sessionId}` and `new_session` button presses

### Config
```json
{
  "telegram": {
    "botToken": "your-bot-token-from-botfather",
    "allowedUsers": [123456789]
  }
}
```

### Source files
- `packages/opencode/src/telegram/bot.ts` (358 lines)
- `packages/opencode/src/telegram/state.ts` (58 lines)

---

## 7. Browser Control (CDP + Chrome Extension Relay)

### What it does
Two-layer browser automation:
1. **CDP (Chrome DevTools Protocol)** — direct browser control via accessibility tree snapshots
2. **Browser Relay** — WebSocket bridge to a Chrome extension for real-browser interaction

### Browser Tool (CDP)
- **Accessibility-first** — takes snapshots of the page as an accessibility tree with numbered `[ref]` elements
- **Actions:** `tabs`, `open`, `tab.close`, `tab.focus`, `navigate`, `snapshot`, `screenshot`, `click`, `type`, `press`, `select`
- **Workflow:** snapshot → identify element by `[ref]` number → interact → snapshot again
- Auto-launches browser if not running

### Browser Relay (WebSocket)
- Runs a WebSocket server on port 4097 (configurable)
- Chrome extension connects to it
- Sends commands to the real browser tab the user is looking at
- Request/response pattern with timeout handling
- Health endpoint at `/health`

### Chrome Extension
- Located in `extensions/chrome/`
- Content script + popup UI
- Connects to the relay WebSocket server
- Forwards commands from the agent to the active tab

### Config
```json
{
  "browser": {
    "cdp": { "enabled": true },
    "relay": { "enabled": true, "port": 4097 }
  }
}
```

### Source files
- `packages/opencode/src/tool/browser.ts` (149 lines)
- `packages/opencode/src/browser/relay.ts` (121 lines)
- `extensions/chrome/` (content.js, popup.html, popup.js, manifest.json)

---

## 8. Multi-Provider Prompt Templates

### What it does
Custom system prompt templates for different model providers, optimizing instructions for each model's strengths.

### Templates
| File | Provider |
|------|----------|
| `prompt/anthropic.txt` | Claude models |
| `prompt/gemini.txt` | Google Gemini models |
| `prompt/qwen.txt` | Alibaba Qwen models |
| `prompt/trinity.txt` | Trinity/general models |
| `prompt/codex_header.txt` | Codex-style models |
| `prompt/beast.txt` | Aggressive/maximal reasoning mode |

### Source files
- `packages/opencode/src/session/prompt/` (multiple .txt files)

---

## Feature Comparison vs Claude Code

| Feature | Claude Code | This Fork |
|---------|-------------|-----------|
| Coding (edit, bash, read, write) | ✅ | ✅ (inherited from upstream) |
| Multi-model support | ❌ (Claude only) | ✅ (any provider) |
| Persistent memory | ❌ (CLAUDE.md only, manual) | ✅ (tool-based, searchable, daily logs) |
| Self-correcting lessons | ❌ | ✅ (`lesson` action) |
| Agent identity/personality | ❌ | ✅ (SOUL.md, IDENTITY.md) |
| Session history search | ❌ (lost after compaction) | ✅ (search compacted messages) |
| Daemon mode | ❌ | ✅ (background process) |
| Heartbeat/proactive checks | ❌ | ✅ (configurable interval + quiet hours) |
| Telegram bot | ❌ | ✅ (full session management) |
| Browser automation (CDP) | ❌ | ✅ (accessibility tree + screenshots) |
| Browser extension relay | ❌ | ✅ (WebSocket bridge) |
| Extended thinking | ✅ | ✅ (inherited) |
| MCP support | ✅ | ✅ (inherited) |
| Desktop app | ❌ | ✅ (Tauri-based, inherited) |
| Permission system | ✅ | ✅ (inherited + extended) |

---

## Quick Start

```bash
# Normal TUI mode
opencode

# Daemon mode (background with heartbeat + telegram + browser relay)
opencode daemon

# Non-interactive run
opencode run --model anthropic/claude-sonnet-4-5 "explain this code"
```

### Config location
- Project: `.opencode/opencode.json`
- Global: `~/.config/opencode/opencode.json`

### Memory files location
- Project: `.opencode/MEMORY.md`, `.opencode/memory/`
- Global: `~/.config/opencode/MEMORY.md`, `~/.config/opencode/memory/`
