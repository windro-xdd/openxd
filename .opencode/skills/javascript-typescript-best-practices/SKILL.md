---
name: javascript-typescript-best-practices
description: Apply production-safe JavaScript and TypeScript coding practices. Use when designing APIs, refactoring modules, fixing bugs, or improving reliability/performance.
triggers:
  - javascript
  - typescript
  - ts types
  - node js
  - async bugs
---

## Purpose

- Improve correctness, maintainability, and runtime safety in JS/TS code.
- Reduce type drift, async bugs, and module-boundary fragility.

## When to Use

- Writing/refactoring Node, browser, or shared JS/TS modules.
- Defining types, public APIs, validation, async flow, or build targets.
- Reviewing code quality, performance, and compatibility.

## Constraints

- Must prefer explicit contracts at module boundaries.
- Must keep types precise; avoid `any` unless strictly justified.
- Must not hide errors with broad catches or silent fallbacks.
- Must preserve tree-shaking and ESM/CJS compatibility intent.

## Workflow

1. Identify boundary and runtime context (Node, browser, edge, shared).
2. Tighten types/invariants at inputs and outputs first.
3. Normalize async flow (parallelize independent work, handle cancellation/timeouts).
4. Apply minimal structural refactor for readability and testability.
5. Verify via typecheck, tests, and targeted perf/bundle checks.

## Output Format

- Scope: files/modules and boundary surfaces changed.
- Decisions: typing, async, error-handling, and API choices made.
- Verification: typecheck/tests/benchmarks executed.
- Risks: deferred debt or compatibility concerns.