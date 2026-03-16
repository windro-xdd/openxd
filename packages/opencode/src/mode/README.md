# Mode System

Smart keyword-triggered modes for opencode sessions.

## Built-in Modes

| Mode | Keyword | Loop | ReadOnly | Description |
|------|---------|------|----------|-------------|
| `ultrawork` | `ultrawork`, `ulw` | ✅ | ❌ | Autonomous work until task complete |
| `search` | `search`, `research` | ❌ | ✅ | Information gathering, no file edits |
| `analyze` | `analyze`, `analysis` | ❌ | ✅ | Deep analysis, no file edits |
| `plan` | `plan`, `planning` | ❌ | ✅ | Create structured plan, no file edits |

## Usage

Type the keyword at the start of your message:
```
ultrawork fix all lint errors in src/
search how does the auth system work
analyze the performance of the API layer
plan implement user notifications
```

`ultrawork` can appear anywhere in the message. Other keywords must be the first word.

## Custom Modes

Add custom modes in your opencode config:
```json
{
  "modes": {
    "mymode": {
      "description": "My custom mode",
      "loop": false,
      "readOnly": true,
      "maxIterations": 50,
      "prompt": "Custom system prompt injection...",
      "tools": { "bash": false }
    }
  }
}
```

## TUI

- `/mode` slash command shows available modes
- Loop progress shown as `🔄 ultrawork [3/50]` in the status bar
- `Esc` interrupts an active loop
- Session status type `loop` with mode, iteration, maxIterations

## Architecture

```
src/mode/           — Mode definitions, detection, registry
├── index.ts        — Mode namespace (get, list, detect, permissions)
├── types.ts        — Zod schemas
├── detector.ts     — Keyword detection from user input
├── builtin.ts      — Built-in mode definitions
└── README.md       — This file

src/loop/           — Autonomous loop controller (ultrawork)
├── index.ts        — Barrel export
├── types.ts        — Loop state and evaluation types
└── controller.ts   — Core loop logic

Integration points:
├── src/session/prompt.ts   — Mode detection, loop continuation, prompt injection
├── src/session/status.ts   — Loop status type
├── src/config/config.ts    — `modes` config key
├── src/cli/cmd/tui/component/prompt/index.tsx  — Loop indicator
└── src/cli/cmd/tui/routes/session/index.tsx    — /mode command
```

## Loop Controller (ultrawork)

Smarter than OmO's approach:
- **No magic tokens** — uses natural language analysis to detect completion
- **Stuck detection** — pauses if same output repeated 2x
- **No-progress detection** — pauses if no file changes in 3+ iterations
- **Clean interruption** — Esc/Ctrl+C cancels the loop
- **Error-aware** — pauses on errors instead of blindly continuing
- **Max iterations** — default 50, configurable per mode

## Tests

```bash
cd packages/opencode
bun test test/mode/detector.test.ts test/loop/completion.test.ts
```
