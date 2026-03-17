---
name: vercel-composition-patterns
description: React composition patterns that scale. Use when refactoring components with boolean prop proliferation, building flexible component libraries, or designing reusable APIs. Triggers on tasks involving compound components, render props, context providers, or component architecture. Includes React 19 API changes.
---

## Purpose

- Apply composition-first React architecture that scales without boolean-prop explosion.
- Preserve reusable APIs by separating structure, state contracts, and variant assembly.

## When to Use

- Component has many boolean mode props (`isX`, `showY`, `renderZ`) or nested conditional UI.
- You are designing/refactoring compound components, context providers, or shared UI primitives.
- You need explicit component variants for different flows (thread/edit/forward/etc.).
- React 19 migration touches `forwardRef`/`useContext` patterns.

## Constraints

- Must replace behavior flags with composition, explicit variants, or provider boundaries.
- Must keep UI components coupled to context interface, not to state backend details.
- Must prefer children composition over render-prop slot proliferation unless data injection is required.
- Must preserve current behavior; refactor structure, not product semantics.
- Must treat React 19 rules as version-gated; do not apply them to React 18 code.

## Workflow

1. Identify anti-patterns: boolean-prop matrices, render-prop sprawl, and state trapped in leaf UI.
2. Convert to compound API and explicit variants; move shared state/actions into provider context.
3. Keep context contract stable (`state`, `actions`, `meta`) so multiple providers can back same UI.
4. Apply React 19-only adjustments (`use()`/ref patterns) only when project version supports them.
5. Validate with focused checks: fewer conditionals, clearer variant boundaries, no behavior regression.
6. Use detailed rule docs when needed: `rules/*.md`; use full reference only for edge cases: `AGENTS.md`.

## Output Format

- Scope: list which components/variants were refactored and why.
- Changes: list concrete architecture decisions (provider split, compound API, variant extraction).
- Verification: report anti-patterns removed and behavior checks performed.
- References: include only consulted docs (`rules/...`, `AGENTS.md`) when relevant.
