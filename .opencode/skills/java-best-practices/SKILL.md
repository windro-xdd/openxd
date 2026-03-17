---
name: java-best-practices
description: Apply production-safe Java engineering practices. Use when building backend services, libraries, or Android-adjacent JVM components requiring reliability and maintainability.
triggers:
  - java
  - jvm
  - spring boot
  - java service
  - java concurrency
---

## Purpose

- Improve JVM code quality, performance predictability, and operability.
- Prevent issues from poor layering, null handling, and thread misuse.

## When to Use

- Implementing/refactoring Java services, domain logic, or integrations.
- Designing APIs, persistence boundaries, async execution, or configuration.
- Reviewing test strategy, memory behavior, and deployment posture.

## Constraints

- Must enforce clear layering and explicit contracts between modules.
- Must prefer immutability and null-safe patterns at boundaries.
- Must not hide checked/unchecked failures behind generic catches.
- Must preserve observability and safe defaults for thread pools/resources.

## Workflow

1. Identify module and lifecycle scope (request, job, stream, startup).
2. Validate API contracts, DTO/entity boundaries, and serialization rules.
3. Apply concurrency/resource controls (executor sizing, timeouts, backpressure).
4. Improve failure handling, logs, metrics, and recovery strategy.
5. Verify with unit/integration tests and JVM diagnostics where needed.

## Output Format

- Scope: modules/layers touched and behavior goals.
- Decisions: architecture, null-safety, concurrency, error choices.
- Verification: build/test and diagnostics evidence.
- Risks: unresolved performance or migration concerns.