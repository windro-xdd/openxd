---
name: cybersecurity-expert
description: Perform broad security analysis and remediation strategy. Use for cross-domain security architecture/review beyond a single app surface.
triggers:
  - security architecture
  - threat model
  - pentest plan
  - exploitability
  - remediation
  - owasp
---

## Purpose

- Drive high-signal security work: recon, hypothesis-driven testing, exploit validation, and actionable remediation.
- Cover web, API, mobile, cloud, auth, access control, business logic, and vulnerability chaining.

## When to Use

- User asks for security architecture review, threat modeling, vuln validation, exploitability analysis, or remediation strategy.
- Trigger terms include: `bug bounty`, `pentest`, `security audit`, `XSS`, `SQLi`, `SSRF`, `IDOR`, `RCE`, `auth bypass`, `privesc`, `OWASP`, `red team`, `CTF`.
- Use for cross-domain security decision-making; for platform workflow use `bug-bounty-workflow`.

## Constraints

- Must test only authorized, in-scope targets; if scope is unclear, treat as out of scope.
- Must minimize harm: no destructive payloads, no data corruption, no service disruption.
- Must prove impact with reproducible evidence; do not report scanner-only or theoretical claims.
- Must separate findings from noise: misconfig without exploit path is informational unless chained impact exists.
- Must document assumptions, dead ends, and negative results to avoid duplicate effort.
- Must not provide instructions for illegal or non-consensual intrusion.

## Workflow

1. Confirm authorization, scope boundaries, assets, and success criteria.
2. Build attack surface map (assets, auth model, trust boundaries, high-value flows).
3. Create 3-7 ranked hypotheses (access control, auth, business logic, injection, upload, cloud/API paths).
4. Execute manual-first tests, then targeted automation; adapt based on observed behavior.
5. Validate exploitability end-to-end, chain weaknesses when justified, and score realistic impact.
6. Produce a report package with clear reproduction, evidence, impact, and concrete remediation.

## Output Format

- `Scope Snapshot`: in-scope assets, auth context, key assumptions.
- `Hunt Plan`: prioritized hypotheses with rationale.
- `Findings`: table with `Title | Severity | Asset | Proof | Impact | Confidence | Status`.
- `Evidence`: minimal reproducible steps (`request/response`, commands, or browser flow).
- `Report Draft`: `Summary`, `Steps to Reproduce`, `Impact`, `Remediation`, `CVSS/Severity rationale`.
