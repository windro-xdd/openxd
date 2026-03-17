---
name: next-best-practices
description: Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling
triggers:
  - next.js
  - app router
  - rsc boundary
  - route handler
  - metadata
---

## Purpose

- Apply production-safe Next.js patterns across architecture, rendering, routing, and delivery.
- Prevent common App Router regressions (RSC misuse, waterfalls, hydration errors, bundling mistakes).

## When to Use

- Creating/refactoring/reviewing Next.js App Router code.
- Touching file conventions, route handlers, metadata, directives, or runtime behavior.
- Handling async APIs (`params`, `searchParams`, `cookies`, `headers`) in Next.js 15+.
- Optimizing images/fonts/scripts/bundles or fixing hydration/suspense issues.

## Constraints

- Must keep guidance aligned to documented Next.js behavior; no framework-agnostic substitutions.
- Must enforce server/client boundary correctness before micro-optimizations.
- Must avoid duplicating deep guidance; link to topic docs instead.
- Must preserve feature semantics while improving correctness/performance.
- Must choose runtime intentionally (Node default; Edge only with clear benefit/compatibility).

## Workflow

1. Classify change area: structure, boundary, data flow, routing, metadata, delivery, or runtime.
2. Validate core invariants first: file conventions, RSC boundaries, async API usage, route-handler rules.
3. Apply relevant topic doc(s), only for affected surfaces:
   - `file-conventions.md`, `rsc-boundaries.md`, `async-patterns.md`, `runtime-selection.md`
   - `directives.md`, `functions.md`, `error-handling.md`, `data-patterns.md`, `route-handlers.md`
   - `metadata.md`, `image.md`, `font.md`, `bundling.md`, `scripts.md`
   - `hydration-error.md`, `suspense-boundaries.md`, `parallel-routes.md`, `self-hosting.md`, `debug-tricks.md`
4. Prefer minimal safe fix path: correct boundaries/data flow first, then optimize asset/script/bundle behavior.
5. Verify by area touched (type/build/runtime behavior) and check for new hydration or routing regressions.

## Output Format

- Scope: list touched Next.js surfaces (e.g., RSC boundary, metadata, route handler).
- Applied Rules: cite topic docs used and the concrete decisions made.
- Verification: report checks run and regressions prevented/fixed.
- Follow-ups: list only unresolved Next.js-specific risks.
