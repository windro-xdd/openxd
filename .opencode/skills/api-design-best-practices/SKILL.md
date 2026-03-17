---
name: api-design-best-practices
description: Design stable, consumable APIs. Use when defining endpoints, payloads, errors, auth, and versioning.
triggers:
  - api design
  - endpoint
  - contract
  - versioning
  - pagination
  - error schema
---

## Purpose

- Deliver predictable API contracts with clear semantics.
- Preserve compatibility and reduce consumer breakage.

## When to Use

- Adding/changing REST or GraphQL endpoints/schemas.
- Designing pagination/filtering/errors/auth/rate limits.
- Reviewing API changes for consumer impact.

## Constraints

- Must treat contract as public surface; no silent breaking changes.
- Must standardize error shape and machine-readable error codes.
- Must define validation, auth, and idempotency for mutating paths.
- Must avoid leaking internal implementation details.

## Workflow

1. Define consumer use cases and domain boundaries.
2. Specify request/response/error contracts and compatibility rules.
3. Implement validation, auth checks, and observability hooks.
4. Add contract/integration tests for success and failure semantics.
5. Publish docs and migration notes.

## Output Format

- `Contract`: changed endpoints/schemas + compatibility status.
- `Behavior`: validation/auth/error/rate-limit semantics.
- `Verification`: contract/integration checks.
- `Consumer Impact`: migration steps or none.
