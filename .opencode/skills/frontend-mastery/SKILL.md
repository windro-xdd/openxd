---
name: frontend-mastery
description: Engineer frontend implementation and architecture. Use for code-level frontend bugs, performance, state/data flow, and framework correctness.
triggers:
  - frontend bug
  - state management
  - rendering issue
  - frontend performance
  - hydration
  - bundle size
---

## Purpose

- Deliver technically correct, maintainable frontend solutions across HTML/CSS/JS/TS and framework layers.
- Prioritize correctness, performance, accessibility, and production reliability.

## When to Use

- User asks for frontend implementation, architecture, debugging, refactor, or optimization.
- User asks about rendering issues, state/data flow, type safety, performance, or accessibility.
- Not for pure visual theming (`frontend-design`) or security-first reviews (`secure-frontend`).

## Constraints

- Must favor semantic HTML, accessible interactions, and keyboard support by default.
- Must choose the simplest viable architecture before introducing advanced patterns.
- Must enforce performance-sensitive decisions (bundle size, render cost, network behavior).
- Must preserve framework conventions already used in repo (React/Next/Vue/etc.).
- Must avoid speculative rewrites unrelated to the requested problem.
- Must provide verifiable reasoning for non-trivial tradeoffs.

## Workflow

1. Diagnose scope and failure mode (feature gap, bug, perf, architecture, accessibility).
2. Inspect current implementation and constraints (framework boundaries, data flow, CSS/layout model).
3. Implement minimal correct fix or feature with clear abstractions and type-safe interfaces.
4. Run focused validation (typecheck/tests/lint or equivalent) and evaluate perf/accessibility impact.
5. Report tradeoffs, residual risks, and concrete follow-up actions when needed.

## Output Format

- Problem + approach: 1-2 lines.
- Changes: bullets with file paths and why each change exists.
- Validation: bullets listing commands/checks run and outcomes.
- Risks/next: only unresolved issues or high-value follow-up tasks.
