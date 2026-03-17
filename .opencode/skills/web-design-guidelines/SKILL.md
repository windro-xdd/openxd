---
name: web-design-guidelines
description: Audit UI against explicit guideline rules. Use for compliance-style review with file/line evidence, not redesign implementation.
triggers:
  - ui audit
  - accessibility audit
  - design guidelines
  - compliance review
  - heuristic evaluation
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

## Purpose

- Run a standards-based UI audit against the latest Web Interface Guidelines.
- Return actionable findings with exact file and line evidence.

## When to Use

- User asks for guideline/compliance audit with actionable violations.
- User provides file paths/patterns to audit.
- If no files are provided, request target files before auditing.

## Constraints

- Must fetch fresh guidelines from source at audit time; do not rely on cached memory.
- Must audit only requested files/patterns unless user asks for broader scope.
- Must map each finding to a specific guideline rule and code location.
- Must not provide vague style opinions without rule linkage.
- Must separate confirmed violations from suggestions.

## Workflow

1. Fetch guidelines from `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md`.
2. Resolve target files from provided paths/patterns.
3. Evaluate code against guideline rules and collect evidence.
4. Classify each issue by severity and certainty.
5. Output findings in terse, location-first format.

## Output Format

- Findings: one item per issue in `path:line - [severity] rule - short fix` format.
- Summary: total counts by severity.
- If no issues: output `No guideline violations found in scoped files.`
