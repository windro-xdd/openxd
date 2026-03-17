---
name: anti-slop-design
description: Enforce anti-generic visual quality checks. Use as a style guardrail after design/build work, not as the primary implementation skill.
triggers:
  - anti slop
  - avoid generic design
  - premium ui polish
  - visual quality pass
---

## Purpose

- Ship UI that looks intentionally art-directed, not template-generated.
- Block common low-signal patterns before code is finalized.

## When to Use

- User asks to avoid generic/AI-looking output or requests premium/distinctive polish.
- Use as a secondary pass with `frontend-design` or `ui-ux-mastery`.
- Do not use for non-UI tasks or deep frontend architecture work.

## Constraints

- Must define a concrete visual direction before coding (tone, type, color, composition).
- Must use a deliberate palette: near-black, near-white, primary scale, and at most two accents.
- Must use purposeful typography and spacing hierarchy; no uniform weights/sizes everywhere.
- Must not default to overused patterns (centered hero + two buttons, symmetric 3-card grid, generic FAQ/pricing blocks) unless user explicitly requests them.
- Must not rely on default purple-gradient-on-white styling or random decorative effects.
- Must preserve existing design system when editing an established product unless user asks for re-theme.

## Workflow

1. Read the target UI fully and identify repeated visual patterns.
2. State the chosen direction in 2-3 lines (mood, reference style, differentiator).
3. Define tokens first: color roles, type scale, spacing rhythm, radius/shadow rules.
4. Implement styles/components consistently across all matching elements, not one-off sections.
5. Verify hierarchy, contrast, responsive behavior, and pattern consistency across the full page.

## Output Format

- Direction: 1-2 lines describing the selected visual approach.
- Changes: concise bullets with file paths and what visual system changed.
- Verification: bullets confirming consistency checks (all instances, responsive, accessibility basics).
- If blocked: one blocker + recommended default.
