---
name: language-selection-guide
description: Choose the right language/runtime for a task. Use when deciding stack for new components, services, CLIs, or performance-critical paths.
triggers:
  - language choice
  - runtime choice
  - stack decision
  - tech selection
  - polyglot architecture
---

## Purpose

- Make language/runtime decisions explicit, constraint-driven, and practical.
- Avoid cargo-cult stack choices and expensive rewrites.

## When to Use

- Starting new modules/services/tools where language choice is open.
- Re-evaluating stack fit due to performance, hiring, or ops pain.
- Comparing trade-offs for polyglot architecture.

## Constraints

- Must score options against team skill, ecosystem fit, runtime constraints, and ops cost.
- Must include migration/interop cost, not just greenfield appeal.
- Must avoid novelty-first picks without strong objective benefit.
- Must provide a default recommendation with fallback.

## Workflow

1. Capture hard constraints (latency, memory, platform, hiring, SLA).
2. Shortlist 2-4 viable languages/runtimes.
3. Compare on productivity, performance, tooling, and reliability.
4. Recommend one default and one fallback.
5. Define decision checkpoints for future reevaluation.

## Output Format

- `Constraints`: explicit non-negotiables.
- `Comparison`: concise scorecard by criterion.
- `Recommendation`: default + fallback with rationale.
- `Risks`: main failure modes and mitigations.
