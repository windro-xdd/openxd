---
name: macos-best-practices
description: Apply production-safe macOS development and platform conventions. Use when building, debugging, packaging, or distributing software on macOS.
triggers:
  - macos
  - launchd
  - notarization
  - code signing
  - keychain
---

## Purpose

- Enforce stable macOS-specific engineering practices.
- Reduce failures from signing, entitlements, sandboxing, and tooling drift.

## When to Use

- Building CLI, desktop, or dev tooling targeting macOS.
- Handling launchd, keychain, notarization, or filesystem nuances.
- Reviewing CI/release pipelines for macOS packaging and distribution.

## Constraints

- Must support current and recent macOS versions with explicit assumptions.
- Must handle zsh defaults, BSD tool differences, and case-insensitive FS safely.
- Must not bypass Gatekeeper/signing/notarization for production flows.
- Must preserve user privacy, keychain safety, and minimal permissions.

## Workflow

1. Classify target surface: runtime, packaging, launchd, security, distribution.
2. Validate shell and tool compatibility (BSD vs GNU differences).
3. Apply signing, entitlements, and notarization rules for release artifacts.
4. Verify install/run/uninstall on clean macOS environment.
5. Capture known limitations and fallback behavior.

## Output Format

- Scope: touched macOS surfaces (tooling, signing, launchd, FS, distribution).
- Decisions: applied rules with short rationale.
- Verification: exact checks run on clean machine/CI.
- Risks: remaining incompatibilities or security caveats.