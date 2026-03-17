---
name: testing-and-qa
description: Drive reliable test and QA coverage. Use when validating features, fixes, regressions, and release readiness.
triggers:
  - testing
  - qa
  - regression
  - release
  - flaky
  - validation
---

## Purpose

- Catch regressions early with focused, deterministic validation.
- Provide clear release confidence signals.

## When to Use

- Any behavior change (feature, fix, refactor).
- Adding regression tests for a reported bug.
- Release gate validation or flaky test triage.

## Constraints

- Must test behavior, not implementation trivia.
- Must cover happy path and high-risk failure paths.
- Must keep tests deterministic and minimal-mock by default.
- Must include regression tests for confirmed defects.

## Workflow

1. Define acceptance criteria and risk areas.
2. Select test levels (unit/integration/e2e) by risk.
3. Implement/update tests with clear assertions.
4. Run checks and fix root causes of failures.
5. Record residual risk and release readiness.

## Output Format

- `Test Plan`: scenarios covered and level rationale.
- `Results`: checks run and pass/fail summary.
- `Coverage Notes`: intentional gaps and why.
- `Release Signal`: ready/not-ready with blockers.
