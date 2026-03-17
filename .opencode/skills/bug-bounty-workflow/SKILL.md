---
name: bug-bounty-workflow
description: Run end-to-end bug bounty operations on bounty platforms. Use for program selection, scope-driven hunting, triage, and report submission flow.
triggers:
  - bug bounty
  - hackerone
  - bugcrowd
  - intigriti
  - recon
  - report draft
---

## Purpose

- Execute bug bounty work with high signal, reproducibility, and policy compliance.
- Maximize valid findings by combining focused recon, hypothesis-driven testing, and evidence-first reporting.

## When to Use

- User asks to start/continue a bounty hunt, triage candidates, or draft reports.
- Trigger terms: `bug bounty`, `HackerOne`, `Bugcrowd`, `intigriti`, `report draft`, `recon`, `triage`.
- Use for authorized targets only, including private programs and VDPs.
- Not for general security architecture/code-review outside bounty workflow (`cybersecurity-expert`).

## Constraints

- Must verify scope, policy, and prohibited testing before any active probing.
- Must keep testing non-destructive and privacy-safe; no data tampering beyond minimum proof.
- Must avoid scanner spam; every candidate needs manual validation and impact evidence.
- Must track dead ends to prevent repeated effort and duplicate noise.
- Must prioritize business-logic/access-control issues over low-impact header-only findings.
- Must not submit unverified or purely theoretical reports.

## Workflow

1. Capture scope contract: assets, exclusions, allowed techniques, bounty ranges, safe-harbor notes.
2. Build attack surface map: hosts, apps, APIs, roles, auth methods, high-value flows.
3. Generate ranked hypotheses (3-7) tied to concrete features/endpoints.
4. Test manually first, then targeted automation; log observations and pivots continuously.
5. Validate exploit chain end-to-end with minimal reproducible evidence.
6. Draft report artifacts: clear repro, impact, severity rationale, remediation guidance.

## Output Format

- `Program Contract`: scope, exclusions, critical policy constraints.
- `Hunt Board`: ranked hypotheses with status (`new`, `testing`, `validated`, `discarded`).
- `Validated Findings`: `Title | Severity | Asset | Repro | Impact | Confidence`.
- `Evidence Pack`: requests/responses, screenshots, logs, and exact paths.
- `Submission Draft`: concise narrative ready for platform submission.
