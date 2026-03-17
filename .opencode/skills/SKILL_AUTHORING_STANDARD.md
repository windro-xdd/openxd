# Skill Authoring Standard (Compact)

Goal: write compact, high-signal `SKILL.md` files that preserve trigger intent, minimize context load, and stay execution-safe.

## Required Frontmatter

Every `SKILL.md` must include valid YAML frontmatter with these required fields:

```yaml
---
name: <unique-skill-name>
description: <one sentence: Do X. Use when Y.>
---
```

Rules:

- `name` is the stable activation identity; never rename unless migration is intentional.
- `description` is the trigger contract; preserve user-intent keywords and rewrite for clarity, not scope drift.
- Keep frontmatter minimal; avoid non-functional metadata unless it is actively consumed.

## Mandatory Section Order

The body must use this exact order and heading names:

1. `Purpose`
2. `When to Use`
3. `Constraints`
4. `Workflow`
5. `Output Format`

Order is mandatory for consistency, scanning speed, and cache reuse.

## Max-Length Guidance

Hard guidance for compactness:

- Target `<= 120` lines and `<= 900` words for `SKILL.md`.
- Soft maximum `<= 160` lines and `<= 1200` words (requires explicit justification in review note).
- Keep `Workflow` to `3-7` numbered steps.
- Keep examples to `0-1` minimal skeletons; move deep examples to `references/`.

## Anti-Repetition Rules

Fluff is prohibited.

Do:

- Use directive bullets (`must`, `must not`, `exactly`, `at least`).
- Keep each rule single-purpose and testable.
- Reuse canonical phrasing for shared sections across skills.

Do not:

- Repeat the same instruction in multiple sections.
- Add motivational prose, marketing language, or generic best-practice filler.
- Duplicate workflow logic in both `Workflow` and `Output Format`.

Compression checks:

- Remove any sentence that does not change behavior.
- Merge semantically equivalent bullets.
- Replace long prose with short constraints.

## Example Skeleton Template

```md
---
name: example-skill
description: Do <primary job>. Use when <explicit trigger terms>.
---

## Purpose

- One sentence outcome.
- One sentence scope boundary.

## When to Use

- Trigger phrases users say.
- In-scope conditions.
- Out-of-scope handoff rule.

## Constraints

- Must: non-negotiable requirements.
- Must not: prohibited actions.
- Preserve trigger intent; do not broaden or narrow task semantics.

## Workflow

1. Inspect context required for the task.
2. Execute core actions in dependency order.
3. Verify completion against explicit checks.
4. If blocked, return one targeted blocker with recommended default.

## Output Format

- Section A: outcome (1-2 lines).
- Section B: evidence (paths, checks, counts).
- Section C: next action (only if applicable).
- No extra sections.
```

## Quick Review Checklist

- Frontmatter has both required fields: `name`, `description`.
- `description` follows `Do X. Use when Y.` and keeps trigger intent intact.
- Body contains all 5 required sections in exact order.
- `Constraints` and `Workflow` are actionable, non-redundant, and measurable.
- `Output Format` is explicit and forbids extras.
- File is within compactness budget (or has justified exception).
- No fluff, no repeated rules, no scope drift.
