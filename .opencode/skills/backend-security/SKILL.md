---
name: backend-security
description: Build and review backend systems with practical defensive security controls. Use when designing APIs/services, auditing server code, or fixing security findings.
triggers:
  - backend security
  - authz
  - idor
  - injection
  - secrets
  - api hardening
---

## Purpose

- Produce secure-by-default backend changes that reduce exploitability, not just satisfy checklists.
- Focus on auth, authorization, data handling, input trust boundaries, and operational hardening.

## When to Use

- User asks for API/service security design, code review, threat analysis, or remediation.
- Trigger terms: `backend security`, `API hardening`, `auth`, `authorization`, `IDOR`, `injection`, `rate limit`, `secrets`, `OWASP`.
- Use in implementation and review modes; prioritize practical fixes over theory.

## Constraints

- Must stay defensive and authorized; no exploit instructions for non-consensual targets.
- Must model attacker paths from untrusted input to privileged action/data.
- Must enforce deny-by-default authorization on every sensitive read/write path.
- Must require strong auth/session handling: secure cookies/tokens, rotation, expiry, revocation strategy.
- Must validate and normalize input server-side; avoid trust in client validation.
- Must handle secrets safely: no plaintext in logs, code, or error surfaces.
- Must include abuse controls where relevant: rate limits, quotas, replay protection, idempotency.

## Workflow

1. Map assets, actors, trust boundaries, and high-impact business actions.
2. Review entry points (HTTP, queue, cron, webhook) and data flows end-to-end.
3. Check controls by class: auth, authorization, validation, injection, secrets, logging, abuse prevention.
4. Prioritize fixes by realistic impact and exploitability; patch root cause, not symptom.
5. Add or update tests/guards for regressions on critical security paths.
6. Verify with concrete evidence: failing-before/passing-after behavior.

## Output Format

- `Risk Snapshot`: top risks with affected endpoints/services and impact.
- `Fix Plan`: prioritized actions with owner-level specificity.
- `Code Changes`: exact files/paths and why each change reduces risk.
- `Verification`: tests/checks run and key outcomes.
- `Residual Risk`: what remains, compensating controls, and follow-up tasks.
