---
name: code-review:review-local-changes
description: Run a multi-agent review of local uncommitted changes with actionable fix and improvement guidance. Use before committing.
triggers:
  - review local changes
  - pre-commit review
  - uncommitted diff review
  - local code review
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task"]
disable-model-invocation: false
argument-hint: "[review-aspects]"
---

## Purpose

- Execute a specialized multi-agent review of local uncommitted changes before commit.
- Catch high-impact defects early and provide concrete improvements with file-level evidence.

## When to Use

- Use before commit when local diffs need quality, security, and maintainability validation.
- `$ARGUMENTS` is optional and narrows focus (for example: bugs, security, tests, contracts).
- Skip `spec/` and `reports/` unless explicitly requested.

## Constraints

- Must exit early with a short message if no local changes exist.
- Must run applicable review agents in parallel and use evidence-based findings only.
- Must cite each finding with `file:line` and consequence.
- Must score confidence (0-100) and drop findings below 80.
- Must avoid low-value noise (pre-existing issues, intentional behavior changes, CI-caught lint/type/format failures).
- `code-quality-reviewer` must include simplification/improvement suggestions, not only defects.

## Workflow

1. Build review scope.
   - Run `git status --short`, `git diff --name-only`, `git diff --stat`.
   - Parse `$ARGUMENTS` for requested review aspects.
   - If no changed files, stop.
2. Run parallel Haiku prep agents.
   - Agent A: list relevant guidance files (`CLAUDE.md`, `AGENTS.md`, `**/constitution.md`, root `README.md`, and touched-directory `README.md`).
   - Agent B: summarize local changes (file types, additions/deletions, likely intent).
3. Launch applicable review agents in parallel:
   - `security-auditor`, `bug-hunter`, `code-quality-reviewer`, `historical-context-reviewer` are default.
   - Add `test-coverage-reviewer` when tests changed.
   - Add `contracts-reviewer` when type/API/data-model semantics changed.
4. Score each candidate issue using parallel Haiku scoring agents.
   - Return confidence 0-100; drop findings `< 80`.
   - For guideline-based findings, verify the rule exists in the cited guidance file.
5. Produce one compact local review report with prioritized must-fix issues and optional improvements.

## Output Format

- Return exactly these sections in order:
  1. `Quality Gate` - `READY TO COMMIT` or `NEEDS FIXES`.
  2. `Must Fix` - numbered items, each: `<severity> <file:line> - <issue> - <risk> - <fix>`.
  3. `Should Fix` - numbered non-blocking issues in same format.
  4. `Improvements` - numbered suggestions from `code-quality-reviewer`, each: `<file:line|symbol> - <change> - <benefit> - <effort low|medium|high>`.
  5. `Metrics` - `files reviewed`, `candidate findings`, `confirmed findings`, `dropped by confidence`, `security findings`.
- If no confirmed findings, return:
  - `Quality Gate: READY TO COMMIT`
  - `Confirmed findings: 0`
  - Optional `Improvements` only when they are specific and actionable.
