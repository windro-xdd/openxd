---
name: bb-continue
description: "Resume a bug bounty hunt from where you left off. Usage: /bb-continue <program-name>"
---

# Bug Bounty Hunter — Resume

Pick up an existing hunt without redoing recon or scope.

## Steps

1. Read `~/bbh/<program-name>/scope.md` — already has the full scope
2. Read `~/bbh/<program-name>/notes.md` — has progress, hypotheses, dead ends
3. Read findings in `~/bbh/<program-name>/findings/` — what's already found
4. Read recon in `~/bbh/<program-name>/recon/SUMMARY.md` if it exists

## Then

- Figure out where you left off from notes.md
- Identify what phases are done vs remaining
- Continue from the next unfinished step
- Do NOT redo recon or rewrite scope

## If workspace doesn't exist

Tell the user: "No workspace found for `<program-name>`. Run `/bb-start <program-name>` to start fresh."
