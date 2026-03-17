---
name: backend-engineering
description: Build reliable backend systems and APIs. Use when implementing/refactoring services, jobs, auth, or integrations.
triggers:
  - backend
  - service
  - api implementation
  - worker
  - cron
  - integration
---

## Purpose

- Ship backend changes that are correct, observable, and easy to operate.
- Favor simple designs with explicit contracts and failure handling.

## When to Use

- Building/changing service logic, workers, schedulers, or integrations.
- Investigating backend bugs, performance regressions, or consistency issues.
- Reviewing backend code for reliability and maintainability.

## Constraints

- Must preserve compatibility unless migration steps are explicit.
- Must model failure paths (timeouts, retries, partial failure, idempotency).
- Must include logs/metrics for critical paths you change.
- Must avoid speculative abstractions and hidden side effects.

## Workflow

1. Map request path, state transitions, and dependencies.
2. Implement minimal coherent change.
3. Add/adjust validation, retry/timeouts, and idempotency controls.
4. Add tests for happy path, failure path, and edge cases.
5. Verify typecheck/tests and operational signals.

## Output Format

- `Scope`: modules/endpoints changed.
- `Decisions`: key trade-offs and rationale.
- `Verification`: checks run and outcomes.
- `Residual Risk`: only real follow-ups.
