---
name: android-best-practices
description: Apply production-safe Android app and platform practices. Use when building, refactoring, testing, or securing Android applications and SDK integrations.
triggers:
  - android
  - lifecycle
  - permissions
  - android performance
  - play release
---

## Purpose

- Enforce reliable Android architecture, lifecycle, and release quality.
- Prevent regressions in performance, permissions, and device compatibility.

## When to Use

- Developing app features, background work, storage, or networking.
- Handling permissions, intents, deep links, push, or Play release setup.
- Auditing performance, battery, startup, and ANR/crash behavior.

## Constraints

- Must follow modern Android APIs and backward-compat strategy by minSdk.
- Must respect lifecycle boundaries and avoid leaked contexts.
- Must not request dangerous permissions without clear user value.
- Must preserve offline tolerance and resilient failure handling.

## Workflow

1. Identify layer touched: UI, domain, data, background, integration, release.
2. Validate lifecycle safety, threading/coroutines, and state restoration.
3. Apply security/privacy checks (permissions, exported components, secrets).
4. Verify on emulator plus at least one physical-device profile.
5. Confirm release-readiness: lint, tests, startup/perf, crash signals.

## Output Format

- Scope: Android surfaces affected (lifecycle, permissions, network, release).
- Decisions: applied best-practice rules and rationale.
- Verification: test matrix and tooling checks run.
- Risks: known device/API-level or security gaps.