---
name: programming-best-practices
description: Apply robust coding standards for correctness and clarity. Use when writing/refactoring production code.
triggers:
  - code quality
  - refactor
  - clean code
  - readability
  - maintainability
  - best practices
---

## Purpose

- Produce clear, testable code with predictable behavior.
- Reduce complexity and maintenance overhead.

## When to Use

- Implementing features, fixes, or refactors.
- Reviewing code quality and defect-prone patterns.
- Standardizing structure/style across touched code.

## Constraints

- Must keep behavior-preserving changes explicit and small.
- Must avoid unnecessary indirection and dead abstractions.
- Must favor readability over cleverness.
- Must update tests/types/docs when contracts change.

## Workflow

1. Understand existing behavior and invariants.
2. Implement smallest coherent change.
3. Remove avoidable complexity safely.
4. Validate typecheck/tests/lint and edge-case paths.
5. Document only non-obvious decisions.

## Output Format

- `Intent`: what improved and why.
- `Key Edits`: modules/functions touched.
- `Checks`: type/test/lint outcomes.
- `Follow-up`: concrete deferred items only.
