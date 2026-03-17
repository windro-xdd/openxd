---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.
---

## Purpose

- Apply high-impact React/Next.js performance patterns with clear priority order.
- Reduce latency and render cost without changing product behavior.

## When to Use

- Writing, reviewing, or refactoring React/Next.js components and routes.
- Fixing waterfalls, bundle bloat, unnecessary re-renders, or hydration/rendering slowness.
- Optimizing server/client data flow, serialization boundaries, and event/effect patterns.
- Auditing performance regressions in mature codebases.

## Constraints

- Must prioritize categories in this order: async waterfalls, bundle size, server performance, client data, re-renders, rendering, JS micro-ops, advanced patterns.
- Must preserve behavior and correctness; no optimization that changes auth/security/data semantics.
- Must apply minimal effective change before broad rewrites.
- Must avoid duplicating full rule prose in output; cite exact rule files instead.
- Must verify improvements with concrete evidence (timing, payload, render count, or request count).

## Workflow

1. Identify bottleneck class (waterfall, bundle, server, client, re-render, rendering, JS).
2. Select the smallest matching rule set from `rules/*.md` by prefix (`async-`, `bundle-`, `server-`, `client-`, `rerender-`, `rendering-`, `js-`, `advanced-`).
3. Apply high-impact fixes first (parallelization, deferred imports, boundary/serialization cleanup) before micro-optimizations.
4. Re-check for regressions in auth, data consistency, and hydration behavior.
5. Validate outcome with measurable signals (fewer requests, smaller JS, faster TTFB/LCP, fewer renders).
6. Escalate to `AGENTS.md` only for ambiguous edge cases or rule conflicts.

## Output Format

- Scope: list bottleneck category and touched components/routes.
- Rules Applied: list exact rule files and why each was chosen.
- Result: report measurable before/after signals or expected deltas.
- Risks: list any trade-offs or deferred optimizations.
