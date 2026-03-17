---
name: go-best-practices
description: Apply production-safe Go engineering practices. Use when building services, CLIs, workers, or libraries requiring concurrency safety and operational simplicity.
triggers:
  - golang
  - go routines
  - context cancellation
  - go service
  - go cli
---

## Purpose

- Keep Go code simple, observable, and resilient under load.
- Prevent bugs in concurrency, context propagation, and error handling.

## When to Use

- Building/refactoring Go APIs, daemons, background jobs, or tooling.
- Designing package boundaries, interfaces, and goroutine workflows.
- Reviewing reliability, memory use, and deployment behavior.

## Constraints

- Must propagate `context.Context` across I/O and cancellation boundaries.
- Must return wrapped errors with actionable context.
- Must not leak goroutines, channels, or hidden global state.
- Must keep APIs idiomatic and avoid unnecessary abstractions.

## Workflow

1. Identify package boundaries and call graph for the target change.
2. Validate context, timeout, and cancellation behavior end-to-end.
3. Apply concurrency-safe patterns (ownership, bounded workers, channel closure).
4. Strengthen error paths, logging, and metrics around failure points.
5. Verify with `go test`, race checks, and benchmark/pprof where relevant.

## Output Format

- Scope: packages/functions and runtime paths changed.
- Decisions: context/concurrency/error rules applied.
- Verification: tests, race detector, and profiling checks.
- Risks: remaining correctness or operational concerns.