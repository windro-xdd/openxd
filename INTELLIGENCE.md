# Agent Intelligence Improvements

Changes made to improve agent reasoning quality, context retention, and tool reliability.
Based on cross-industry research: Claude Code, Cursor, Windsurf, Aider, Devin, Cline, OpenHands.

---

## 2026-03-16

### P0 — Critical Fixes

#### Pruning threshold delayed from 25% → 80%

**File**: `packages/opencode/src/session/compaction.ts`

Previously, tool outputs were pruned when the context window was only 25% full. This destroyed
context the agent still actively needed, causing it to lose track of files it had read, commands
it had run, and decisions it had made. Claude Code waits until ~95%.

New cascade: **75% slide window → 80% prune → 90% compact → 100% overflow**

#### Original tool outputs preserved before pruning

**File**: `packages/opencode/src/session/compaction.ts`, `src/tool/session-history.ts`

When tool outputs were pruned, the data was overwritten in the DB and gone forever. `session_history`
was reading from these already-pruned stubs, making it useless for recovering lost context.

Fix: before pruning, `state.original` is saved with the full output. `session_history` now reads
from `state.original` when available, returning the real pre-prune content.

#### Contradictory search instructions removed

**File**: `packages/opencode/src/session/prompt/beast.txt`

`beast.txt` told the agent to search by fetching `https://www.google.com/search?q=...` via webfetch.
`tool-intelligence.txt` (appended to every prompt) explicitly said never to do this. The contradiction
caused the model to waste reasoning resolving the conflict.

Fix: `beast.txt` now correctly uses the `websearch` tool, consistent with all other prompts.

#### Instruction char cap raised from 60K → 120K

**File**: `packages/opencode/src/session/instruction.ts`

Per-file cap: 20K → 40K chars. Total cap: 60K → 120K chars.

With large MEMORY.md + daily logs + AGENTS.md + SOUL/USER/IDENTITY files, the previous 60K limit
was silently truncating files — the agent loaded instructions but never knew some were dropped.
Warning upgraded to error-level log with the name of the skipped file.

#### Duplicate Identity/Memory blocks removed from all base prompts

**Files**: `prompt/beast.txt`, `prompt/anthropic.txt`, `prompt/trinity.txt`, `prompt/qwen.txt`,
`prompt/gemini.txt`, `prompt/codex_header.txt`

The Identity/Memory and Cross-Session Awareness sections were copy-pasted into every base prompt,
even though `tool-intelligence.txt` (which is appended to all prompts) already contains them.
This was wasting ~800 tokens per session on duplicated instructions and creating subtle conflicts.

---

### P1 — Quality Improvements

#### Compaction summary validation

**File**: `packages/opencode/src/session/compaction.ts`

After compaction, the summary is validated:

- Warns if summary is under 200 chars (suspiciously short = context lost)
- Warns if expected sections (Current Task, Files, Task State) are missing

Logged at error/warn level so issues are visible in debug output.

#### Context budget awareness signal

**File**: `packages/opencode/src/session/prompt.ts`

Based on Cognition/Devin research: models get "context anxiety" near capacity limits and start
taking shortcuts — shorter answers, skipped steps, rushed decisions.

Fix: when context usage exceeds 50%, a `<context-budget>` tag is injected into the system prompt
telling the model it still has plenty of room and should work at full quality.

#### Improved tool error messages (poka-yoke)

**Files**: `src/tool/edit.ts`, `src/tool/read.ts`, `src/tool/grep.ts`, `src/tool/glob.ts`, `src/tool/tool.ts`

Anthropic's SWE-bench finding: better tool error messages reduce retry loops and improve task
success rates more than prompt changes do.

Changes:

- `edit`: "oldString not found" now tells the agent to re-read the file first to get exact content
- `edit`: "file not found" now suggests using the `write` tool to create new files
- `read`: binary file error now suggests `xxd`/`strings` alternatives
- `grep`: "no files found" now includes the pattern and path that were searched
- `glob`: "no files found" now includes the pattern and directory
- `tool`: ZodError now formats as a readable list of field-level issues instead of a raw error dump

---

### P2 — Advanced

#### Claude on Copilot: per-effort thinking budgets

**File**: `packages/opencode/src/provider/transform.ts`

Previously Claude models on the GitHub Copilot provider had a single flat thinking budget of 4000
tokens regardless of effort level. Now scales with effort:

| Effort | Budget        |
| ------ | ------------- |
| low    | 2,000 tokens  |
| medium | 8,000 tokens  |
| high   | 16,000 tokens |
| max    | 32,000 tokens |

---

### Deferred (require significant architecture work)

- **P2.1 Repo map** — tree-sitter + PageRank structural index (like Aider)
- **P2.2 Planning subagent** — separate background planner (like Windsurf Cascade)
- **P2.4 Two-model edit pipeline** — sketch → apply cheap model (like Cursor)

---

## Rate Limit Fallback — Model Cycling

**Files**: `src/config/config.ts`, `src/session/retry.ts`, `src/session/processor.ts`

When running long unattended sessions (e.g. bug bounty hunts), hitting a rate limit previously
caused the agent to sleep-retry forever on the same model. Now you can configure a list of fallback
models that get cycled through automatically when rate limited.

### How to enable

In your `opencode.json` config:

```json
{
  "rateLimitFallback": {
    "enabled": true,
    "models": ["github-copilot/claude-sonnet-4.5", "github-copilot/gpt-4.1", "github-copilot/o4-mini"]
  }
}
```

### Behaviour

- When the active model gets rate limited (HTTP 429 / too_many_requests), the next model in the
  list is used immediately — no sleep delay.
- Cycles through the list in order. After the last model, wraps back to the first.
- If a model ID in the list can't be resolved, it's skipped silently.
- When `enabled: false` (or the field is absent), behaviour is unchanged — normal retry with backoff.
- The model switch is shown in the status bar: `Rate limited on X — switching to Y`

### Model ID format

Use `providerID/modelID` format, same as how models appear in the model picker.
Examples: `github-copilot/claude-sonnet-4.5`, `github-copilot/gpt-4.1`
