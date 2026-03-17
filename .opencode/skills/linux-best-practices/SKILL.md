---
name: linux-best-practices
description: Apply production-safe Linux engineering and operations practices. Use when building, deploying, debugging, or hardening software on Linux systems.
triggers:
  - linux
  - systemd
  - capabilities
  - selinux
  - apparmor
---

## Purpose

- Standardize robust Linux behavior across distros and environments.
- Prevent issues with permissions, systemd, networking, and packaging.

## When to Use

- Writing scripts/services for Linux hosts or containers.
- Working with systemd, cgroups, filesystems, capabilities, or SELinux/AppArmor.
- Reviewing deployment pipelines and runtime hardening.

## Constraints

- Must state distro/runtime assumptions (glibc/musl, init system, kernel features).
- Must use least privilege (user, group, capability) over root defaults.
- Must not rely on distro-specific behavior without guarded fallback.
- Must preserve idempotence and reproducibility in automation.

## Workflow

1. Identify target environment: distro, container/VM, init system, kernel constraints.
2. Validate paths, permissions, ownership, and service lifecycle behavior.
3. Apply security controls: capabilities, seccomp, MAC policy, secrets handling.
4. Verify on clean target image and CI with non-root execution.
5. Record operational checks (logs, health, restart, rollback).

## Output Format

- Scope: affected Linux areas (service, fs, network, security, packaging).
- Decisions: concrete Linux rules applied.
- Verification: commands/tests proving behavior.
- Risks: unresolved portability or hardening concerns.