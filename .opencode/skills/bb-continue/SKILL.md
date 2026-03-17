---
name: bb-continue
description: "Resume a bug bounty hunt from where you left off. Usage: /bb-continue <program-name>"
---

## Purpose

- Resume a specific bug bounty program efficiently from existing artifacts, without repeating completed work.

## When to Use

- User runs `/bb-continue <program-name>` to continue an existing hunt.

## Constraints

- Must require `~/bbh/<program-name>/` to exist.
- Must read existing context before any new testing: `scope.md`, `notes.md`, `findings/`, `recon/` summary files.
- Must preserve prior scope and policy assumptions unless explicitly updated by program changes.
- Must not rerun baseline recon unless evidence is stale or missing.

## Workflow

1. Verify workspace presence; if missing, return startup instruction for `/bb-start`.
2. Load hunt state from `scope.md`, `notes.md`, `findings/*`, and key recon summaries.
3. Determine completed vs pending phases and extract unresolved hypotheses.
4. Build a short continuation plan (next 3 actions) tied to highest-impact pending surface.
5. Continue execution and append progress updates to `notes.md` with evidence paths.

## Output Format

- `State`: workspace status and files read.
- `Progress`: completed phases, open hypotheses, and prior findings snapshot.
- `Next 3 Actions`: concrete tasks with target asset/endpoint.
- `Resume Point`: exact step being continued and why.
- If missing workspace: `No workspace found for <program-name>. Run /bb-start <program-name> to start fresh.`
