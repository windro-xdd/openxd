# OpenCode Smart Modes & Autonomous Loop — Design Document

## Overview

Three new features for opencode, built natively into the existing architecture:

1. **Smart Autonomous Loop** — `ultrawork` mode that keeps working until done, with intelligence
2. **Keyword Modes** — `ultrawork`, `search`, `analyze`, `plan` trigger session-level behavior changes  
3. **Smart Model Router** — route to different models based on task phase (replaces multi-agent complexity)

## Architecture

### Where Things Live

```
packages/opencode/src/
├── mode/                    # NEW — Mode system
│   ├── index.ts             # Mode namespace, registry, detection
│   ├── detector.ts          # Keyword detection from user input
│   ├── builtin.ts           # Built-in mode definitions
│   └── types.ts             # Mode types
├── loop/                    # NEW — Autonomous loop controller
│   ├── index.ts             # LoopController namespace
│   ├── controller.ts        # Core loop logic, stuck detection, progress
│   └── types.ts             # Loop state types
├── session/
│   └── prompt.ts            # Modified — integrate mode + loop
├── agent/
│   └── agent.ts             # Modified — mode-aware agent config
└── config/
    └── config.ts            # Modified — mode config schema
```

### Integration Points

All three features plug into **existing hooks** — no new event system needed:

1. **Mode detection** → `SessionPrompt.prompt()` — detect keywords before creating user message
2. **Loop control** → `SessionPrompt.loop()` — after model finishes, check if loop should continue
3. **Model routing** → `Agent.get()` / model resolution — swap model based on mode/context

---

## Feature 1: Smart Mode System

### How Modes Work

Modes are session-level configurations that modify behavior. They're activated by:
- Keywords in user message (`ultrawork`, `search`, `analyze`)
- Slash commands (`/mode ultrawork`)
- Config defaults

### Mode Definition

```typescript
export namespace Mode {
  export const Info = z.object({
    name: z.string(),
    description: z.string().optional(),
    // Behavior modifications
    loop: z.boolean().default(false),           // Enable autonomous loop
    readOnly: z.boolean().default(false),        // Disable write/edit tools
    maxIterations: z.number().default(50),       // Loop iteration cap
    // Prompt injection
    prompt: z.string().optional(),               // Injected into system prompt
    // Tool filtering
    tools: z.record(z.string(), z.boolean()).optional(),  // Enable/disable specific tools
    // Model override  
    model: z.object({
      providerID: z.string(),
      modelID: z.string(),
    }).optional(),
    // Thinking level override
    thinking: z.enum(["disabled", "low", "medium", "high"]).optional(),
  })
}
```

### Built-in Modes

```typescript
const BUILTIN_MODES: Record<string, Mode.Info> = {
  ultrawork: {
    name: "ultrawork",
    description: "Autonomous work mode. Agent keeps working until task is complete.",
    loop: true,
    maxIterations: 50,
    prompt: `You are in ULTRAWORK mode. Work autonomously until the task is COMPLETELY done.

Rules:
- Execute the full task without stopping to ask questions
- After each step, evaluate: "Is the task complete? What's next?"
- Use tools aggressively — read, search, edit, run tests
- If you hit an error, debug it yourself before asking for help
- When truly done, stop. Don't add unnecessary extras.
- If you are genuinely stuck (tried 3+ approaches), stop and explain what you tried.`,
  },
  
  search: {
    name: "search",
    description: "Research and information gathering mode.",
    readOnly: true,
    prompt: `You are in SEARCH mode. Focus on finding and synthesizing information.
- Use websearch, webfetch, grep, codesearch, and read tools
- Gather information thoroughly before presenting findings
- Cite sources and file paths
- Do NOT modify any files`,
  },

  analyze: {
    name: "analyze",
    description: "Deep analysis mode. Read-only, thorough investigation.",
    readOnly: true,
    prompt: `You are in ANALYZE mode. Perform deep analysis without modifying anything.
- Read and understand code/files thoroughly
- Identify patterns, issues, and opportunities
- Provide structured analysis with evidence
- Do NOT modify any files`,
  },
  
  plan: {
    name: "plan", 
    description: "Planning mode. Create a structured plan before execution.",
    readOnly: true,
    prompt: `You are in PLAN mode. Create a detailed, actionable plan.
- Explore the codebase to understand current state
- Break the task into concrete, ordered steps
- Identify risks and dependencies
- Output as a numbered checklist
- Do NOT modify any files — planning only`,
  },
}
```

### Keyword Detection

```typescript
// detector.ts
const MODE_PATTERNS: Record<string, RegExp> = {
  ultrawork: /\b(ultrawork|ulw)\b/i,
  search: /\b(search|research)\b/i,   // Only at start of message
  analyze: /\b(analyze|analysis)\b/i,  // Only at start of message  
  plan: /\b(plan|planning)\b/i,        // Only at start of message
}

export function detectMode(text: string): { mode: string; cleanText: string } | undefined {
  // Only check first word/phrase for non-ultrawork modes to avoid false positives
  const firstWord = text.trim().split(/\s+/)[0].toLowerCase()
  
  // ultrawork can appear anywhere
  if (MODE_PATTERNS.ultrawork.test(text)) {
    return { mode: "ultrawork", cleanText: text.replace(MODE_PATTERNS.ultrawork, "").trim() }
  }
  
  // Other modes must be the first word
  for (const [name, pattern] of Object.entries(MODE_PATTERNS)) {
    if (name === "ultrawork") continue
    if (pattern.test(firstWord)) {
      return { mode: name, cleanText: text.replace(pattern, "").trim() }
    }
  }
}
```

### Integration with SessionPrompt

In `prompt.ts`, before creating the user message:

```typescript
// Detect mode from user input
const textParts = input.parts.filter(p => p.type === "text")
const firstText = textParts[0]?.text ?? ""
const detected = Mode.detect(firstText)

if (detected) {
  // Store mode on session
  await Session.setMode(input.sessionID, detected.mode)
  // Clean the keyword from the message
  if (textParts[0]) textParts[0].text = detected.cleanText
}
```

---

## Feature 2: Smart Autonomous Loop

### The Problem with OmO's Approach

OmO's loop is dumb: inject prompt → check for `<promise>DONE</promise>` → repeat.
No stuck detection, no graceful interruption, no progress tracking.

### Our Approach: Intelligent Loop Controller

The loop controller wraps around the existing `SessionPrompt.loop()` function.

```typescript
export namespace LoopController {
  export interface State {
    active: boolean
    iteration: number
    maxIterations: number
    sessionID: string
    // Stuck detection
    lastOutputHash: string | null
    sameOutputCount: number
    lastFileChanges: number
    // Progress tracking
    startTime: number
    filesModified: Set<string>
  }

  // After each model turn completes (session.idle), evaluate whether to continue
  export async function shouldContinue(state: State, session: Session.Info): Promise<
    | { action: "continue"; reason: string }
    | { action: "stop"; reason: string }
    | { action: "pause"; reason: string }
  > {
    // 1. Max iterations reached
    if (state.iteration >= state.maxIterations) {
      return { action: "stop", reason: `Reached max iterations (${state.maxIterations})` }
    }

    // 2. Model said "stop" (finish reason)
    const lastMsg = await getLastAssistantMessage(state.sessionID)
    if (lastMsg?.finish === "stop" || lastMsg?.finish === "length") {
      // Check if the model's response indicates it thinks it's done
      const lastText = await getLastAssistantText(state.sessionID)
      if (looksComplete(lastText)) {
        return { action: "stop", reason: "Task appears complete" }
      }
    }

    // 3. Stuck detection — same output pattern repeated
    const currentHash = await hashLastOutput(state.sessionID)
    if (currentHash === state.lastOutputHash) {
      state.sameOutputCount++
      if (state.sameOutputCount >= 2) {
        return { action: "pause", reason: "Agent appears stuck — same output repeated. Pausing for input." }
      }
    } else {
      state.sameOutputCount = 0
      state.lastOutputHash = currentHash
    }

    // 4. No file changes in last 3 iterations (for code tasks)
    const currentChanges = await countFileChanges(state.sessionID)
    if (state.iteration > 3 && currentChanges === state.lastFileChanges) {
      // Agent is running tools but not making progress
      return { action: "pause", reason: "No file changes in recent iterations. Need input?" }
    }
    state.lastFileChanges = currentChanges

    // 5. Permission was denied — don't auto-continue
    if (lastMsg?.finish === "denied") {
      return { action: "pause", reason: "Permission denied during execution" }
    }

    return { action: "continue", reason: `Iteration ${state.iteration + 1}` }
  }
}
```

### Completion Detection (No Magic Tokens)

Instead of `<promise>DONE</promise>`, we use signal analysis:

```typescript
function looksComplete(text: string): boolean {
  if (!text) return false
  
  // Agent explicitly says it's done
  const doneSignals = [
    /\ball\s+(changes|tasks|steps|items)\s+(are\s+)?(done|complete|finished)/i,
    /\btask\s+(is\s+)?(done|complete|finished)/i,
    /\bsuccessfully\s+(completed|implemented|fixed)/i,
    /\beverything\s+(is\s+)?(done|ready|in\s+place)/i,
    /\blet\s+me\s+know\s+if/i,  // offering to help more = thinks it's done
  ]
  
  return doneSignals.some(pattern => pattern.test(text))
}
```

### Continuation Prompt

When the loop continues, inject a lightweight prompt:

```typescript
const CONTINUATION_PROMPT = `Continue working on the task. 
Current iteration: ${state.iteration}/${state.maxIterations}.
Review what you've done so far and proceed to the next step.
If the task is fully complete, say so clearly and stop.`
```

### Interruption Handling

Key difference from OmO — clean interruption:

```typescript
// In the TUI, Esc during loop = pause (not abort)
// The loop controller checks abort signal between iterations
// User can type a new message while paused → it gets injected as context
// Resume with /continue or just sending a message
```

### Integration with prompt.ts loop()

The key change is in the `loop()` function. After the model finishes a turn and `lastAssistant.finish` is "stop":

```typescript
// Current behavior: break out of loop
// New behavior: if mode.loop is active, evaluate continuation

const mode = await Session.getMode(sessionID)
if (mode?.loop && !abort.aborted) {
  const evaluation = await LoopController.shouldContinue(loopState, session)
  
  if (evaluation.action === "continue") {
    // Inject continuation prompt as synthetic user message
    const continueMsg = await Session.updateMessage({
      id: Identifier.ascending("message"),
      role: "user",
      sessionID,
      time: { created: Date.now() },
      agent: lastUser.agent,
      model: lastUser.model,
    })
    await Session.updatePart({
      id: Identifier.ascending("part"),
      messageID: continueMsg.id,
      sessionID,
      type: "text",
      synthetic: true,
      text: CONTINUATION_PROMPT,
    })
    loopState.iteration++
    Bus.publish(LoopController.Event.Progress, {
      sessionID,
      iteration: loopState.iteration,
      reason: evaluation.reason,
    })
    continue  // re-enter the while loop
  }
  
  if (evaluation.action === "pause") {
    Bus.publish(LoopController.Event.Paused, {
      sessionID,
      reason: evaluation.reason,
    })
    // Don't break — wait for user input
    break
  }
  
  // action === "stop"
  Bus.publish(LoopController.Event.Completed, {
    sessionID,
    iterations: loopState.iteration,
    reason: evaluation.reason,
  })
}
```

---

## Feature 3: Smart Model Router (Phase 3)

Instead of OmO's named agents (Sisyphus, Prometheus, Oracle...), route by context:

```typescript
// Config
routing: {
  rules: [
    { when: "mode == ultrawork && iteration > 10", model: "anthropic/claude-sonnet-4-5" },
    { when: "context_usage > 0.6", model: "anthropic/claude-sonnet-4-5" },
    { when: "mode == search", model: "anthropic/claude-haiku-3.5" },
  ]
}
```

This is Phase 3 — not implementing now.

---

## Config Schema Additions

```typescript
// In config.ts schema
mode: z.record(z.string(), z.object({
  description: z.string().optional(),
  loop: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  maxIterations: z.number().optional(),
  prompt: z.string().optional(),
  model: ModelId.optional(),
  thinking: z.enum(["disabled", "low", "medium", "high"]).optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
})).optional(),
```

---

## Session Schema Additions

Store active mode on the session:

```typescript
// In session table
mode: z.string().optional()  // Active mode name
loop_state: z.object({       // Loop controller state (if loop active)
  iteration: z.number(),
  maxIterations: z.number(),
  lastOutputHash: z.string().nullable(),
  sameOutputCount: z.number(),
  startTime: z.number(),
}).optional()
```

---

## TUI Integration

### Loop Progress Display

When loop is active, show in the status bar:
```
🔄 ultrawork [3/50] — Fixed 12/47 lint errors
```

### Interruption
- `Esc` → pause loop, show "Loop paused. Send a message or /continue"
- `Ctrl+C` → full cancel
- Typing while loop runs → queue message, inject at next iteration

---

## Implementation Order

### Phase 1A: Mode System (~2 days)
1. Create `src/mode/` directory with types, detector, builtin modes
2. Add mode detection in `SessionPrompt.prompt()`  
3. Inject mode prompt into system prompt
4. Apply readOnly/tools filtering
5. Store mode on session

### Phase 1B: Loop Controller (~3 days)
1. Create `src/loop/` directory with controller logic
2. Modify `SessionPrompt.loop()` to check loop continuation
3. Implement stuck detection + completion detection
4. Add continuation prompt injection
5. Handle interruption (Esc = pause)

### Phase 1C: TUI Integration (~1 day)
1. Show loop progress in status bar
2. Handle Esc as pause during loop
3. Show mode indicator

### Phase 2: Polish (~2 days)
1. Loop-aware compaction (compact between iterations)
2. Silent error recovery during loop
3. Custom user modes via config
4. `/mode` slash command

### Phase 3: Model Router (future)
1. Config-driven routing rules
2. Context-aware model selection
