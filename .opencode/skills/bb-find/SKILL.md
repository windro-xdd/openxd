---
name: bb-find
description: "Find top 5 less-crowded bug bounty programs ($100-$5000). Usage: /bb-find [search-term]"
triggers:
  - bb-find
  - bug bounty programs
  - target discovery
  - low crowd programs
---

## Purpose

- Find five active, less-crowded bug bounty programs with realistic payout potential and usable web scope.
- Help the user select one target and persist that selection for `/bb-start`.

## When to Use

- User runs `/bb-find [search-term]` to discover new programs.
- Search term narrows vertical focus (for example fintech, SaaS, healthcare, e-commerce).

## Constraints

- Must return exactly 5 programs.
- Must prioritize active programs with web-testable scope and typical medium/high payout range around `$100-$5000`.
- Must avoid saturated mega-programs by default (Google, Meta, Apple, Microsoft) unless user explicitly asks.
- Must verify each listing from platform page and at least one secondary source.
- Must preserve selection state in `~/.opencode/bbh-programs.json`; only one program can be `selected: true`.

## Workflow

1. Gather candidates via `websearch` (platform listings + niche filters + recent program activity).
2. Validate each candidate using `webfetch` for: active status, scope quality, and bounty range.
3. Rank by huntability (scope breadth, likely crowding, payout fit, attack surface diversity).
4. Return top 5 with concise rationale and prompt: `Pick a number to lock it in.`
5. On user selection, update `~/.opencode/bbh-programs.json`: clear previous selections, mark chosen entry with `selected: true` and `selectedAt` ISO timestamp.

## Output Format

- `Candidates (Top 5)`: numbered list.
- For each item include: `Program`, `Platform`, `URL`, `Scope`, `Bounty`, `Why low-crowd/valuable`.
- End with: `Pick a number to lock it in.`
- After selection: `Locked in <Program Name>. Run /bb-start <name> to hunt.`
