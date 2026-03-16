---
name: bb-find
description: "Find top 5 less-crowded bug bounty programs ($100-$5000). Usage: /bb-find [search-term]"
---

# Bug Bounty Program Finder

Find 5 active, less-crowded bug bounty programs worth hunting.

## Criteria
- **Payment**: $100 - $5000 for medium/high severity
- **Less crowded**: Skip top-tier (Google, Meta, Apple, Microsoft). Target mid-tier: fintech, SaaS, healthcare, e-commerce, telecom
- **Web app scope**: Must have a web app to test
- **Active**: Currently accepting submissions
- **Broad scope**: Wildcard domains or multiple subdomains preferred

## How

1. If user provides a search term (e.g., `/bb-find fintech`), focus search on that niche
2. Use `websearch` for:
   - "new bug bounty programs 2025 2026"
   - "hackerone programs" / "bugcrowd programs" with good payouts
   - Niche-specific: "bug bounty programs [search-term]"
3. Cross-reference with https://github.com/arkadiyt/bounty-targets-data for scope details

## Output

For each program, present:

```
### [#] Program Name
- **Platform**: HackerOne / Bugcrowd / Intigriti / Self-hosted
- **URL**: [program page]
- **Scope**: [key domains]
- **Bounty**: $X - $Y
- **Why**: [1-2 sentences]
```

After listing all 5, ask: **"Pick a number to lock it in."**

## When User Picks a Program

When the user picks one (e.g., "3", "go with 2"):

1. Read `~/.opencode/bbh-programs.json` if it exists
2. Set ALL existing programs to `"selected": false`
3. Add ONLY the selected program with `"selected": true` and `"selectedAt": "<ISO timestamp>"`
4. Save to `~/.opencode/bbh-programs.json`
5. Confirm: **"Locked in [Program Name]. Run `/bb-start <name>` to hunt."**

Only the selected program gets saved. Previous selections stay in the file but get deselected.

## File Format (~/.opencode/bbh-programs.json)

```json
{
  "programs": [
    {
      "name": "Example Corp",
      "platform": "hackerone",
      "url": "https://hackerone.com/example",
      "scope": ["*.example.com"],
      "bountyRange": "$100 - $5000",
      "selected": true,
      "selectedAt": "2026-03-12T10:00:00Z"
    }
  ]
}
```
