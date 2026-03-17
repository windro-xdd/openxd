---
name: windows-best-practices
description: Apply production-safe Windows development and operations practices. Use when building, debugging, packaging, or hardening software on Windows.
triggers:
  - windows
  - powershell
  - windows service
  - registry
  - ntfs
---

## Purpose

- Standardize reliable Windows-first engineering decisions.
- Prevent common breakage in paths, permissions, shells, and services.

## When to Use

- Creating or fixing tooling/scripts that run on Windows.
- Working with PowerShell, CMD, services, registry, or NTFS semantics.
- Auditing Windows CI/CD, installer behavior, or endpoint hardening.

## Constraints

- Must prioritize compatibility across Windows 10/11 and Server builds.
- Must treat path separators, quoting, and Unicode paths explicitly.
- Must not assume Bash-only behavior or POSIX permissions.
- Must preserve least privilege and secure defaults.

## Workflow

1. Identify execution context: shell, user privilege, filesystem, service model.
2. Validate path handling, env vars, line endings, and command escaping.
3. Apply secure defaults for execution policy, code signing, and secrets.
4. Verify behavior in local dev plus Windows CI with clean environment.
5. Document Windows-specific trade-offs and fallback paths.

## Output Format

- Scope: touched Windows surfaces (shell, service, fs, security, packaging).
- Decisions: key rules applied and why they matter.
- Verification: checks run (CI/job, script, installer, permission path).
- Risks: unresolved compatibility or hardening gaps only.