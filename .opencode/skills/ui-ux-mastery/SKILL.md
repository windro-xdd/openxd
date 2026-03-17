---
name: ui-ux-mastery
description: Improve user flows and interaction quality. Use for task-flow UX, information architecture, and interaction-state design, not visual theming.
triggers:
  - ux flow
  - conversion
  - form ux
  - navigation clarity
  - interaction states
  - information architecture
---

## Purpose

- Produce interfaces that are both visually strong and measurably easier to use.
- Convert UX principles into concrete interaction, layout, and state decisions.

## When to Use

- User asks for flow improvement, interaction refinement, navigation clarity, conversion/form UX.
- Use when the key problem is usability, completion rate, or cognitive load.
- Not for visual re-theme (`frontend-design`) or standards-only audit (`web-design-guidelines`).

## Constraints

- Must optimize task clarity first: users should know where they are, what to do next, and what changed.
- Must define explicit interaction states (default, hover/focus, active, disabled, loading, error, success).
- Must keep cognitive load low: limit competing primary actions per view.
- Must preserve accessibility fundamentals (contrast, focus visibility, keyboard path, semantic structure).
- Must keep touch targets and spacing practical for mobile.
- Must avoid trend-chasing styles when they reduce readability or usability.

## Workflow

1. Identify the core user task, success criteria, and current friction points.
2. Map information hierarchy and interaction flow before styling details.
3. Define component/state behavior and feedback rules for key interactions.
4. Implement UI changes with consistent tokens and reusable patterns.
5. Validate UX with scenario walkthroughs (happy path, error path, empty/loading states, mobile).

## Output Format

- UX goal: one short statement of user task and design intent.
- Changes: bullets with file paths tied to UX problems solved.
- Checks: bullets confirming state coverage, accessibility basics, and mobile behavior.
- Open items: only unresolved UX risks or follow-up experiments.
