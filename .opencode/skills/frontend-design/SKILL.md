---
name: frontend-design
description: Create or restyle visual UI systems with strong brand expression. Use for look-and-feel work, not UX flow redesign or frontend architecture.
triggers:
  - visual redesign
  - reskin
  - typography
  - color system
  - ui polish
  - brand style
---

## Purpose

- Produce working frontend code with high visual quality and clear design intent.
- Balance aesthetics, usability, accessibility, and implementation realism.

## When to Use

- User asks for redesign, reskin, visual direction, typography/color system, or UI polish.
- Use for visual language and component styling decisions.
- Not for task-flow optimization (`ui-ux-mastery`) or technical architecture/performance (`frontend-mastery`).

## Constraints

- Must implement real, runnable UI code; no mock-only output.
- Must choose one coherent visual direction; avoid mixed unrelated styles.
- Must define and reuse design tokens (color, typography, spacing, motion).
- Must design for desktop and mobile states explicitly.
- Must preserve existing product style when task is incremental unless user requests a new direction.
- Must avoid generic AI defaults (boilerplate layouts, predictable palette/type choices).

## Workflow

1. Extract intent: audience, goal, constraints, brand tone, and UI scope.
2. Pick a clear design direction and state what makes it distinctive.
3. Establish token system and component rules before writing detailed UI code.
4. Build the interface with consistent hierarchy, spacing, and interaction behavior.
5. Validate responsiveness, accessibility basics, and visual consistency across all sections.

## Output Format

- Intent + direction: short statement of problem and chosen visual approach.
- Implementation: bullets listing key UI decisions and edited file paths.
- Validation: bullets for responsive checks, consistency checks, and accessibility checks.
- Next step: optional single recommendation only if materially useful.
