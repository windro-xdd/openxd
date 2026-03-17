---
name: bb-start
description: "Start expert bug bounty hunting. Usage: /bb-start <program-name> [platform-url]"
triggers:
  - bb-start
  - start hunt
  - bounty workspace
  - scope setup
---

## Purpose

- Initialize a bug bounty workspace for one program and start a focused, evidence-driven hunt.
- Preserve depth-over-breadth strategy: one target, clear hypotheses, measurable progress.

## When to Use

- User runs `/bb-start <program-name> [platform-url]` to begin a new hunt.
- Use for HackerOne, Bugcrowd, Intigriti, or public self-hosted disclosure programs.

## Constraints

- Must test only in-scope assets and allowed techniques from program policy.
- Must not proceed if program name is missing; request exactly one argument example.
- Must use `websearch` to locate unknown program pages and `webfetch` for known URLs.
- Must create and use `~/bbh/<program-name>/` with `scope.md`, `notes.md`, `recon/`, `findings/`, `reports/`.
- Must record every phase result in `notes.md`, including dead ends and next hypotheses.
- Must avoid low-value spam findings; require reproducible impact before escalation.

## Workflow

1. Resolve program page from input, fetch rules/scope/bounty table, and save concise scope contract to `scope.md`.
2. Bootstrap workspace files and write initial target profile (domains, auth model, prohibited actions).
3. Run recon baseline (subdomains, live hosts, key tech/services, endpoint discovery) and summarize top attack paths.
4. Execute manual mapping (user flows, API map, auth/session behavior, role boundaries).
5. Hunt prioritized classes: access control, auth, business logic, injection, upload/API-specific abuse.
6. Validate candidates end-to-end, assign severity with rationale, and draft findings in `findings/*.md` plus report-ready artifacts in `reports/`.

## Output Format

- `Program Snapshot`: platform URL, bounty range, in-scope roots, critical policy constraints.
- `Workspace Ready`: created paths and baseline files.
- `Phase Status`: `Recon`, `Mapping`, `Hunting`, `Validation` each with `Done/Next` and key evidence paths.
- `Top Hypotheses`: ranked list with target endpoint/feature and why it is promising.
- `Findings Draft`: for each issue include `Title`, `Severity`, `Asset`, `Repro`, `Impact`, `Remediation`, `Evidence path`.
