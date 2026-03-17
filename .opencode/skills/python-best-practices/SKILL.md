---
name: python-best-practices
description: Apply production-safe Python engineering practices. Use when building services, data pipelines, CLIs, or libraries that require maintainability and correctness.
triggers:
  - python
  - type hints
  - python service
  - data pipeline
  - pytest
---

## Purpose

- Enforce clean, testable Python with strong reliability defaults.
- Prevent runtime surprises from dynamic typing and environment drift.

## When to Use

- Implementing/refactoring Python modules, APIs, jobs, or automation.
- Handling packaging, dependency management, typing, and performance hotspots.
- Reviewing error handling, observability, and deployment readiness.

## Constraints

- Must use clear module boundaries and explicit dependency injection.
- Must prefer type hints and validation at external boundaries.
- Must not swallow exceptions or rely on implicit global state.
- Must preserve reproducible environments and deterministic behavior.

## Workflow

1. Identify runtime context: service, CLI, worker, notebook, or library.
2. Validate interfaces, data models, and configuration sources.
3. Apply robust error handling, logging, and retry/backoff where required.
4. Optimize only measured hotspots (I/O, vectorization, concurrency choices).
5. Verify with lint/type/tests and environment lock reproducibility.

## Output Format

- Scope: Python components touched and execution context.
- Decisions: typing, architecture, error, and performance rules applied.
- Verification: lint/type/test commands and outcomes.
- Risks: unresolved migration, dependency, or runtime issues.