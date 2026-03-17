---
name: shadcn-ui
description: Integrate and customize shadcn/ui components safely in production codebases. Use when adding, extending, or auditing shadcn-based UI.
triggers:
  - shadcn
  - shadcn ui
  - component registry
  - ui component install
  - shadcn customization
allowed-tools:
  - "shadcn*:*"
  - "mcp_shadcn*"
  - "Read"
  - "Write"
  - "Bash"
  - "webfetch"
---

## Purpose

- Deliver correct shadcn/ui integration with maintainable customization patterns.
- Use registry-aware workflows to reduce manual copy/paste and dependency errors.

## When to Use

- User asks to add, search, install, customize, or troubleshoot shadcn/ui components.
- User needs guidance on registries, blocks, variants, or theme integration.
- Not for non-shadcn UI systems unless migration is explicitly requested.

## Constraints

- Must treat shadcn components as app-owned code, not immutable vendor artifacts.
- Must prefer official add/install flows before manual file copying.
- Must keep custom wrappers outside `components/ui` to preserve upgrade path.
- Must preserve accessibility behavior from underlying primitives when customizing.
- Must verify required project setup (`components.json`, aliases, Tailwind/CSS vars) before deep edits.
- Must not claim compatibility or version assumptions without checking project state.

## Workflow

1. Inspect project setup (`components.json`, aliases, style system, registries).
2. Discover candidate components/examples via registry tools.
3. Install/add components using recommended command path; fall back to manual integration only when needed.
4. Apply customization via tokens/variants/wrappers while keeping base component structure stable.
5. Validate imports, dependencies, accessibility behavior, and build/typecheck status.

## Output Format

- Scope: what component(s)/block(s) were added or changed.
- Changes: bullets with file paths, install commands, and customization points.
- Validation: bullets for setup checks, dependency checks, and build/type/a11y checks.
- Follow-up: only migration or maintenance actions still required.
