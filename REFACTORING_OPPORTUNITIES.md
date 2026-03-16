# OpenCode Refactoring Opportunities Analysis

## 🎯 Executive Summary

OpenCode has **4 major complexity hotspots** that should be refactored to:

1. Make the codebase easier to maintain
2. Enable new features without adding more lines
3. Reduce cognitive load when adding new providers/features

**Total opportunity:** Reduce 4,584 lines of complexity to 1,595 modular lines (65% reduction).

---

## P0: config.ts (1,528 lines) — Massive Schema Bloat ⭐

### The Problem

One file contains ALL config schema definitions + validation + loading + merging logic:

- 342 schema definition lines (`.object`, `.optional`, `.describe`)
- Mixing concerns: schema validation, file I/O, merging, defaults
- All provider schemas hardcoded
- Custom preprocessor/transform logic scattered throughout

### Root Causes

1. All provider schemas inline (anthropic, openai, azure, vertex, etc.)
2. All tool config schemas nested (browser, lsp, formatter, mcp, etc.)
3. Agent/mode/command/permission schemas all in one place
4. Custom field transforms (Permission key ordering, Agent option extraction)

### Why It Matters

- **Adding PinchTab config** required modifying this massive file
- **Hard to find** where browser config is defined
- **Impossible to test** individual schema pieces
- **New providers** or tools mean touching this file

### Solution: Split Into Modules

```
config/
  schema/
    core.ts         (100 lines) — logLevel, server, share, autoupdate, model
    browser.ts      (50 lines)  — cdp, pinchtab (NEW)
    provider.ts     (300 lines) — all provider schemas
    agent.ts        (150 lines) — agent, mode, permission, command
    tool.ts         (100 lines) — lsp, formatter, mcp schemas
  index.ts          (200 lines) — compose schemas, load files
  defaults.ts       (50 lines)  — default values
  merge.ts          (30 lines)  — custom merge logic
  validate.ts       (40 lines)  — error formatting
```

### Impact

- **70% size reduction** on config.ts (1,528 → 200 lines core)
- Each schema module is independently testable
- Adding new feature configs is trivial (just add new schema file)
- Easier to document (schema per file = clear responsibilities)

**Estimated effort:** 2-3 hours

---

## P1: provider.ts (1,410 lines) — Tangled Model Loading

### The Problem

Models are loaded via nested if/else chains with scattered custom logic:

- `BUNDLED_PROVIDERS` hardcoded list of 20+ providers
- `CUSTOM_LOADERS` per-provider preprocessing scattered throughout
- Model filtering happens in multiple places
- SDK initialization, model lookup, config merging all mixed together

### Root Causes

1. No standardized provider interface
2. Each provider has unique loading logic
3. Model override/filtering happens ad-hoc
4. Cost calculations interleaved with loading

### Why It Matters

- **Adding new provider** requires changes in 3-5 places
- **Model overrides** are fragile (grep-based searching)
- **Hard to understand** the full loading flow
- **Custom loaders** duplicated logic (e.g., anthropic header options)

### Solution: Create Provider Registry

```ts
// provider/builtin/anthropic.ts
export const AnthropicProvider: ProviderDefinition = {
  name: 'anthropic',
  getSDK(options) { return createAnthropic(options) },
  preprocessModels(models) { /* filter based on key */ },
  getOptions(config) { return { headers: {...} } }
}

// provider/registry.ts
const PROVIDERS = [
  AnthropicProvider,
  OpenAIProvider,
  AzureProvider,
  // etc.
]
```

New file structure:

```
provider/
  registry.ts         (50 lines)  — PROVIDERS array + lookup
  sdk-factory.ts      (100 lines) — SDK instantiation
  model-filter.ts     (80 lines)  — filtering logic
  loaders.ts          (150 lines) — CustomLoaders registry
  builtin/
    anthropic.ts      (20 lines)  — AnthropicProvider
    openai.ts         (20 lines)  — OpenAIProvider
    azure.ts          (20 lines)  — AzureProvider
    vertex.ts         (20 lines)  — VertexProvider
    [etc. 16 more]
```

### Impact

- **50% complexity reduction** (1,410 → 600 lines core)
- Adding new provider = add 20-line file + register in array
- Model filtering = one function, one place
- Custom loaders = testable, reusable

**Estimated effort:** 1-2 hours

---

## P2: github.ts (1,646 lines) — Type-Heavy PR Handler

### The Problem

80+ types defined before any implementation logic:

- GitHub GraphQL response mapping is fragile
- Comment handling duplicated: issue comments, review comments, code review comments
- Event handlers for each webhook type (Issues, PullRequest, WorkflowRun, etc.)
- Type casting (`as GitHubPullRequest`) instead of validation

### Root Causes

1. GitHub GraphQL schema inlined as TypeScript types
2. Each comment type treated separately (no abstraction)
3. No factory/builder pattern for comments
4. Event routing hardcoded per type

### Why It Matters

- **1,646 lines** is hard to navigate
- **Duplicated logic** for comment processing
- **Fragile type casting** (no validation)
- **Hard to add new comment types** (need to change multiple functions)

### Solution: Modularize GitHub Handling

```
cli/cmd/github/
  types.ts            (150 lines) — All GitHub types
  client.ts           (50 lines)  — Octokit + graphql setup
  comments.ts         (150 lines) — Unified comment processing
  handler.ts          (400 lines) — Reduced webhook handlers
  utils.ts            (100 lines) — Helper functions
```

Key refactoring:

1. Extract all 80 types to `types.ts`
2. Create abstract `Comment` interface
3. Single `processComment()` function instead of 3
4. Use discriminated unions for event types

### Impact

- **50% size reduction** (1,646 → 800 lines handler)
- Single comment processor = easier to maintain
- Types in separate file = easier to document
- Event handlers follow same pattern

**Estimated effort:** 1-2 hours

---

## P3: prompt.ts (2,389 lines) — Monolithic Session Manager

### The Problem

One namespace contains: tool resolution, compilation, streaming, execution, compaction tracking.

- 43 functions/classes in one file
- Tight coupling between prompt building and tool execution
- Hard to test individual features
- Error handling scattered throughout

### Root Causes

1. SessionPrompt = everything related to prompt/session
2. Tool compilation nested with prompt building
3. Event emission mixed with logic

### Why It Matters

- **Hard to understand** the flow from start to finish
- **Testing** requires mocking huge amounts of context
- **Adding observation capture** required hooks in multiple places
- **Refactoring tools** means understanding entire namespace

### Solution: Extract Tool Pipeline

```
session/
  tool-pipeline.ts     (200 lines) — resolve → compile → execute
  tool-compiler.ts     (150 lines) — schema compilation, metadata
  prompt/
    [existing partial structure]
```

Plus: Keep promise of "tool.execute.after" event clear

### Impact

- Easier to test tool execution in isolation
- Clear separation of concerns
- Observation capture = simple event handler

**Estimated effort:** 1-2 hours refactoring

---

## P4: Type Safety Issues (202 files with `as any`)

### The Problem

202 files contain `as any`, `unknown`, or `@ts-ignore`:

- `provider/transform.ts`: 3 instances
- `acp/agent.ts`: 2 instances
- `loop/controller.ts`: 1 instance
- `daemon/heartbeat.ts`: 2 instances
- [and 197 more]

### Quick Wins (30 min each)

#### `provider/transform.ts` (line 346)

**Current:**

```ts
const msg = (msg.providerOptions as any)?.openaiCompatible
```

**After:**

```ts
type ModelOptions = Record<string, unknown>
const msg: ModelOptions = msg.providerOptions
const openaiOptions = msg?.openaiCompatible as OpenAIOptions | undefined
```

#### `acp/agent.ts` (lines 1091, 1268)

**Current:**

```ts
const payload = (event as any)?.payload
const models = Provider.sort(Object.values(provider.models) as any)
```

**After:**

```ts
interface Event {
  payload?: unknown
}
const payload = (event as Event)?.payload

const models = Object.values(provider.models) as LanguageModel[]
```

#### `loop/controller.ts` (line 285)

**Current:**

```ts
const text = p.map((p) => (p as any).text ?? "")
```

**After:**

```ts
interface TextContent {
  text?: string
}
const text = p.map((p) => (p as TextContent).text ?? "")
```

#### `daemon/heartbeat.ts` (lines 22, 61)

**Current:**

```ts
const hbConfig = (config as any).daemon?.heartbeat
```

**After:**

```ts
// Use Config.Info type
const daemonConfig = (config as Config.Info).daemon?.heartbeat
```

### Impact

- 15+ fewer type escapes = clearer code paths
- Easier to refactor with confidence
- Better IDE support and error detection

**Estimated effort:** 30 minutes per file, 2 hours total for top targets

---

## 🚀 Recommended Execution Order

### Phase 1: Foundation (Highest ROI)

1. **Extract config schema** (2-3 hours)
   - Biggest complexity reduction
   - Enables future feature growth
   - Low risk (pure refactoring)

2. **Create provider registry** (1-2 hours)
   - Unblocks: "how do I add a new provider?"
   - Sets pattern for other registries

### Phase 2: Cleanup (Polish)

3. **Refactor GitHub handler** (1-2 hours)
   - Improves PR/issue handling safety
   - Large file becomes manageable

4. **Type safety fixes** (2 hours)
   - Eliminate 15+ `as any` escapes
   - Better error detection

### Phase 3: Future-Proofing (Optional)

5. **Refactor prompt.ts** (1-2 hours)
   - Better testing
   - Clearer event flow

---

## 💡 What Becomes Possible After Refactoring

### MCP Auto-Discovery (would reduce mcp.ts by 40%)

Much simpler after provider registry refactor.

### Skill System v2

Needs clean config structure.

### Debug Session Playground

Web UI for visualizing agent execution flow. Needs clean prompt.ts architecture.

### Config GUI

Auto-generate web form from Zod schema. Only possible with clean schema modules.

### Model Benchmarking

Built-in perf testing for agents. Needs provider registry.

### Tool Performance Profiler

See which tools are slowest. Needs clean prompt.ts.

---

## 📊 Impact Summary

| Area        | Before    | After               | Saved   | Time     | Priority |
| ----------- | --------- | ------------------- | ------- | -------- | -------- |
| config.ts   | 1,528     | 200 + schemas       | 70%     | 2-3h     | P0 ⭐    |
| provider.ts | 1,410     | 600 + builtin       | 60%     | 1-2h     | P1 ⭐    |
| github.ts   | 1,646     | 800 + types         | 50%     | 1-2h     | P2 ⭐    |
| prompt.ts   | 2,389     | modular             | TBD     | 1-2h     | P3       |
| Type safety | 202 files | 187 files           | 3%      | 2h       | P4       |
| **Total**   | **4,584** | **1,595 + modules** | **65%** | **5-6h** | -        |

---

## ✅ Next Steps

Choose ONE of the Phase 1 tasks:

### Option A: Extract Config Schema (Recommended)

- **Why:** Biggest payoff, enables future growth, touches everything
- **How to start:** Create `src/config/schema/` directory, start extracting

### Option B: Create Provider Registry

- **Why:** Simpler, more focused, clearer wins
- **How to start:** Look at `BUNDLED_PROVIDERS` and `CUSTOM_LOADERS` structure

Both are low-risk, high-value refactorings that improve code quality without changing behavior.
