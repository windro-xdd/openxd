---
name: code-review:review-pr
description: Run a multi-agent pull request review and post only high-signal inline comments. Use when reviewing an open, non-draft PR.
triggers:
  - review pr
  - pull request review
  - inline review comments
  - pr audit
argument-hint: "[review-aspects]"
---

## Purpose

- Execute a specialized multi-agent PR review focused on real bugs, security risk, contract breaks, and test gaps.
- Keep noise low: post only meaningful inline comments tied to changed lines.

## When to Use

- Use for pull request review workflows where findings should be posted back to the PR.
- `$ARGUMENTS` is optional and narrows review focus (for example: security, tests, contracts).
- Skip `spec/` and `reports/` unless explicitly requested.

## Constraints

- Must post inline comments only; do not post or update an overall PR review summary comment.
- Must stop if PR is closed or draft.
- Must use parallel subagents for analysis/scoring steps when independent.
- Must cite concrete evidence (`file:line`, behavior, consequence) for every posted issue.
- Must filter out low-value findings:
  - never post Impact `0-20` issues
  - never post findings below confidence threshold for their impact tier
  - never post lint/format/typecheck-only issues CI will catch
- Must prefer GitHub inline-comment MCP tooling; use `gh api` fallback only if needed.

## Workflow

1. Determine scope.
   - Run: `git status`, `git diff --stat`, and PR diff stat against base branch.
   - Parse `$ARGUMENTS` for requested review aspects.
2. Run parallel Haiku prep agents.
   - Agent A: confirm PR is open and non-draft.
   - Agent B: list relevant guidance files (`CLAUDE.md`, `AGENTS.md`, `**/constitution.md`, root `README.md`, and touched-directory `README.md`).
   - Agents C-F: split changed files and summarize each shard (type, complexity, affected symbols).
3. If PR description is missing, add a concise description from the aggregated file summaries.
4. Launch applicable review agents in parallel (default: all applicable):
   - `security-auditor`, `bug-hunter`, `code-quality-reviewer`, `contracts-reviewer`, `test-coverage-reviewer`, `historical-context-reviewer`.
   - Applicability rules:
     - code/config changes: `bug-hunter`, `security-auditor`, `code-quality-reviewer`
     - test changes: `test-coverage-reviewer`
     - type/API/data-model changes: `contracts-reviewer`
     - high complexity/history-sensitive diffs: `historical-context-reviewer`
5. Score each candidate issue with parallel Haiku agents.
   - Return `confidence` (0-100) and `impact` (0-100).
   - Use thresholds:
     - Impact `81-100` => Confidence `>= 50`
     - Impact `61-80` => Confidence `>= 65`
     - Impact `41-60` => Confidence `>= 75`
     - Impact `21-40` => Confidence `>= 85`
     - Impact `0-20` => Confidence `>= 95` (still do not post)
6. Re-check PR eligibility (open/non-draft), then post inline comments for remaining findings.
   - Preferred: inline-comment MCP tool.
   - Fallback: `gh api` PR review/comment endpoints.

## Output Format

- Inline comment body format (one issue per comment):
  - `🟥/🟧/🟨 <Severity>: <Short title>`
  - `Evidence: <file:line + observed behavior>`
  - `Risk: <user/system impact>`
  - `Confidence: <0-100> | Impact: <0-100>`
  - `Fix: <specific change>`
  - Optional `suggestion` block only when exact replacement is clear.
- Final operator response (plain text, no extra sections):
  - `Eligibility: <open|closed|draft>`
  - `Files reviewed: <count>`
  - `Findings considered: <count>`
  - `Inline comments posted: <count>`
  - `Filtered out: <count> (<reason summary>)`
  - `PR description updated: <yes|no>`
