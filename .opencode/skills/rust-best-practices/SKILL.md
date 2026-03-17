---
name: rust-best-practices
description: Apply production-safe Rust engineering practices. Use when building systems, services, CLIs, or libraries requiring memory safety, performance, and correctness.
triggers:
  - rust
  - ownership
  - borrow checker
  - cargo
  - rust async
---

## Purpose

- Promote idiomatic Rust with strong safety and maintainability.
- Prevent correctness and performance regressions across ownership/concurrency.

## When to Use

- Writing/refactoring Rust crates, modules, async services, or tooling.
- Designing trait boundaries, error types, lifetimes, and ownership flow.
- Reviewing performance, unsafe usage, and deployment reliability.

## Constraints

- Must prefer safe abstractions; isolate and justify any `unsafe`.
- Must define explicit error types and avoid opaque panics in libraries.
- Must not clone by default when borrowing or ownership transfer is cleaner.
- Must preserve deterministic builds and reproducible dependency policy.

## Workflow

1. Identify crate/module boundary and ownership flow for the change.
2. Validate lifetimes, borrowing, and mutation model before optimization.
3. Apply async/concurrency safety (Send/Sync, cancellation, bounded queues).
4. Harden error handling, tracing, and public API ergonomics.
5. Verify with `cargo test`, clippy, fmt, and benchmarks when relevant.

## Output Format

- Scope: crates/modules and critical paths changed.
- Decisions: ownership, error, async, and safety rules applied.
- Verification: cargo checks/tests/lints/bench evidence.
- Risks: unresolved unsafe, perf, or API-compat concerns.