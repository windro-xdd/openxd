# OpenCode Brain — Complete Implementation Plan

## What We're Building
Give OpenCode persistent memory, personality, cross-session awareness, a background daemon, and better compaction. Basically OpenClaw's brain inside OpenCode's body.

---

## Feature 1: Identity Files (SOUL.md, USER.md, IDENTITY.md)

**What:** Load personality/identity files into system prompt so the agent knows who it is and who it's helping.

**Files to load (always, independently, not fallbacks):**
- `SOUL.md` — personality, tone, behavior guidelines
- `USER.md` — info about the user (name, preferences, timezone)
- `IDENTITY.md` — agent's name, avatar, creature type

**Search order (each file independently):**
1. Project level: `.opencode/SOUL.md` (walk up from cwd to worktree root)
2. Global: `~/.config/opencode/SOUL.md`

**Files to modify:**
- `src/session/instruction.ts` — add IDENTITY_FILES array, load them in `systemPaths()` independently (no `break` — each file loads if it exists)
- `src/session/instruction.ts` → `globalFiles()` companion: new `globalIdentityFiles()` function

**Prompt changes:**
- All prompt .txt files (anthropic, gemini, beast, qwen, trinity, codex_header) — add a section:
  ```
  # Identity
  If SOUL.md, USER.md, or IDENTITY.md files are present, their contents are included 
  in your instructions. Embody the personality defined in SOUL.md. Use USER.md to 
  understand who you're helping. IDENTITY.md defines who you are.
  ```

**No new tools, no new modules, no dependencies.**

---

## Feature 2: MEMORY.md (Cross-Session Memory)

**What:** A persistent markdown file the agent reads on session start and writes to during work. Carries knowledge across sessions.

**Files to load:**
- `MEMORY.md` — curated cross-session knowledge

**Search order:**
1. Project level: `.opencode/MEMORY.md` or `MEMORY.md` in project root (walk up)
2. Global: `~/.config/opencode/MEMORY.md`

**Files to modify:**
- `src/session/instruction.ts` — add MEMORY_FILES array, load in `systemPaths()` independently
- `src/session/instruction.ts` → new `globalMemoryFiles()` function

**Prompt changes:**
- All prompt .txt files — add a section:
  ```
  # Memory
  MEMORY.md is your long-term memory across sessions. If it exists, its contents 
  are in your instructions.
  
  Update it (using Read then Write tools) when:
  - You learn user preferences
  - Important architectural decisions are made  
  - Non-obvious codebase knowledge is discovered
  - User asks you to remember something
  - Significant work is completed
  
  Keep entries concise. Remove outdated info. Don't save trivial things.
  Project level: .opencode/MEMORY.md | Global: ~/.config/opencode/MEMORY.md
  ```

**No new tools. Agent uses existing Read/Write tools to maintain MEMORY.md.**

---

## Feature 3: Session History Tool

**What:** A new tool that lets the agent list sessions and read another session's messages. Enables "what did I do in that other session?" from any session.

**New files:**
- `src/tool/session-history.ts` — the tool implementation

**Tool: `session_history`**
```
Parameters:
  action: "list" | "read"
  sessionID?: string    (required for "read")
  limit?: number        (default 10 for list, 20 messages for read)
  search?: string       (filter sessions by title)

On "list":
  Returns recent sessions: id, title, created, updated, message count

On "read":  
  Returns messages from that session: role, text content, timestamps
  (Tool outputs truncated to keep context manageable)
```

**Files to modify:**
- `src/tool/session-history.ts` — new file
- `src/tool/registry.ts` — register SessionHistoryTool in the `all()` function

**Implementation:**
- Uses existing `Session.list()` and `Session.messages()` internally
- No new storage, no new APIs — just wraps existing SDK
- Read action returns last N messages with role + text (strips tool output details to save tokens)

**Prompt changes:**
- Add to all prompt .txt files:
  ```
  # Cross-Session Awareness
  You can view other sessions using the session_history tool.
  Use it when the user asks about work done in other sessions, or wants to 
  reference something from a previous conversation.
  ```

---

## Feature 4: Better Compaction

**What:** Fix compaction so it doesn't interrupt work and doesn't lose critical context.

### Problem today:
1. Context fills up → everything stops mid-work
2. One big summary LLM call → lossy, forgets things
3. Old context thrown away → agent confused after compaction

### Solution: Incremental pruning + MEMORY.md safety net

**Changes to `src/session/compaction.ts`:**

### 4a. Earlier, gradual pruning
- Current: waits until context is FULL, then panic-compacts
- New: start pruning old tool outputs at 70% capacity (not 100%)
- Tool outputs from early in the session get compacted first (marked with `time.compacted`)
- This is incremental — happens in background, no interruption
- User messages and assistant text responses are NEVER pruned (they're tiny)
- Only tool outputs (file reads, bash outputs, grep results) get pruned — they're the space hogs

**Modify `isOverflow()`:**
```typescript
// Add a "soft limit" at 70% that triggers background pruning
export async function shouldPrune(input) {
  // returns true at 70% capacity — triggers gradual prune
}
export async function isOverflow(input) {
  // returns true at ~95% capacity — triggers full compaction (existing behavior)
}
```

**Modify loop in `src/session/prompt.ts`:**
- After each assistant response, check `shouldPrune()`
- If true, call `prune()` in background (non-blocking)
- Full compaction (`isOverflow`) remains as last resort

### 4b. Smarter compaction prompt
- Current: generates one blob summary
- New: structured template that forces the LLM to capture:
  - Current task and its state
  - All file paths currently being worked on
  - Uncommitted decisions / things in progress
  - Key user instructions that must not be forgotten
- Add instruction: "After compaction, update MEMORY.md with anything worth remembering long-term"

**Modify compaction prompt in `compaction.ts`:**
```
Update the compaction `defaultPrompt` to include:
- "List ALL files currently being modified or relevant"
- "Preserve the EXACT current task state — what's done, what's in progress, what's next"
- "Include any user preferences or instructions given during this session"
- "After this summary is used, the agent should update MEMORY.md with key learnings"
```

### 4c. Re-inject MEMORY.md after compaction
- After compaction creates the summary, the next loop iteration already loads MEMORY.md via instruction.ts
- No extra work needed — MEMORY.md is always in the system prompt
- This means even if compaction loses something, MEMORY.md has the durable knowledge

**Files to modify:**
- `src/session/compaction.ts` — add `shouldPrune()`, improve compaction prompt
- `src/session/prompt.ts` — add background pruning check after each step

---

## Feature 5: Daemon Mode

**What:** Make OpenCode run as a background service that starts on login. TUI connects to it.

### 5a. Auto-start server
- `opencode serve` already exists and works
- New: `opencode daemon install` — creates a systemd user service (Linux) or launchd plist (macOS)
- New: `opencode daemon uninstall` — removes the service
- New: `opencode daemon status` — checks if daemon is running

**New files:**
- `src/cli/cmd/daemon.ts` — CLI command for install/uninstall/status

**systemd service template:**
```ini
[Unit]
Description=OpenCode Server
After=network.target

[Service]
Type=simple
ExecStart=/path/to/opencode serve --port 4096
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

### 5b. TUI auto-attach
- Currently: `opencode` launches its own server + TUI
- New: `opencode` checks if a daemon is already running on the configured port
  - If yes → attach to it (like `--attach http://localhost:4096`)
  - If no → start its own server as before (fallback, no daemon required)

**Files to modify:**
- `src/cli/cmd/tui/attach.ts` or TUI bootstrap — add daemon detection logic
- Check if port 4096 is responding with OpenCode's API before launching own server

### 5c. Config
```json
{
  "daemon": {
    "enabled": true,
    "port": 4096,
    "auto_start": true
  }
}
```

**Files to modify:**
- `src/config/config.ts` — add daemon config schema
- `src/cli/cmd/daemon.ts` — new file

---

## Implementation Order

### Phase 1: Identity + Memory (simplest, highest impact)
1. Modify `instruction.ts` — load SOUL.md, USER.md, IDENTITY.md, MEMORY.md
2. Update all prompt .txt files — add Identity and Memory sections
3. Test: create MEMORY.md in a project, verify it appears in system prompt

### Phase 2: Session History Tool
4. Create `src/tool/session-history.ts`
5. Register in `src/tool/registry.ts`
6. Update prompt .txt files — add Cross-Session Awareness section
7. Test: ask agent "what sessions do I have?" and "what happened in session X?"

### Phase 3: Better Compaction
8. Add `shouldPrune()` to `compaction.ts`
9. Add background prune check to prompt loop in `prompt.ts`
10. Improve compaction prompt template
11. Test: run a long session, verify pruning happens gradually without interruption

### Phase 4: Daemon Mode
12. Create `src/cli/cmd/daemon.ts` — install/uninstall/status
13. Add daemon detection to TUI bootstrap
14. Add daemon config to `config.ts`
15. Test: install service, verify TUI auto-attaches

---

## What We're NOT Building (yet)
- Telegram bridge (separate discussion)
- Custom memory tools (agent uses Read/Write)
- Structured memory storage (MEMORY.md is just markdown)
- Memory search/scoring/decay (the file is small enough to read whole)
- Auto-memory capture (agent decides when to update, not automated)

---

## Files Changed Summary

| File | Changes |
|------|---------|
| `src/session/instruction.ts` | Load MEMORY.md, SOUL.md, USER.md, IDENTITY.md |
| `src/session/prompt/anthropic.txt` | Add Identity, Memory, Cross-Session sections |
| `src/session/prompt/gemini.txt` | Same |
| `src/session/prompt/beast.txt` | Same (replace old memory section) |
| `src/session/prompt/qwen.txt` | Same |
| `src/session/prompt/trinity.txt` | Same |
| `src/session/prompt/codex_header.txt` | Same |
| `src/tool/session-history.ts` | **NEW** — session list/read tool |
| `src/tool/registry.ts` | Register SessionHistoryTool |
| `src/session/compaction.ts` | Add shouldPrune(), improve prompt |
| `src/session/prompt.ts` | Add background prune check |
| `src/cli/cmd/daemon.ts` | **NEW** — daemon install/uninstall/status |
| `src/config/config.ts` | Add daemon config schema |
| TUI bootstrap | Add daemon auto-detection |
