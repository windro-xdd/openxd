---
name: web-research-best-practices
description: Perform fast, reliable web research with verifiable sources and practical synthesis. Use when answering unknown topics, comparing tools, or validating technical claims.
triggers:
  - research
  - compare tools
  - source verification
  - docs lookup
  - latest changes
  - fact check
---

## Purpose

- Produce accurate, current answers by combining targeted search, source vetting, and concise synthesis.
- Reduce hallucination risk through evidence-backed claims and explicit uncertainty handling.

## When to Use

- User asks about unfamiliar tools/concepts, market comparisons, docs lookup, or claim verification.
- Trigger terms: `research`, `find sources`, `compare`, `latest`, `docs`, `what is`, `verify`.
- Use whenever local knowledge may be stale or insufficient.

## Constraints

- Must search first for unknowns; do not guess when verification is feasible.
- Must prefer authoritative sources: official docs, vendor posts, standards, repo READMEs/releases.
- Must cross-check important claims with at least 2 independent credible sources when possible.
- Must distinguish fact vs inference; label uncertainty explicitly.
- Must avoid fabricated citations, broken links, and quote distortion.
- Must keep summaries practical: what matters, why it matters, and decision impact.

## Workflow

1. Define the exact question and decision criteria (performance, cost, security, maturity, etc.).
2. Run focused searches, then fetch top relevant primary sources.
3. Extract concrete facts: versions, dates, limits, APIs, pricing, security posture.
4. Cross-validate key claims, resolve conflicts, and note confidence levels.
5. Synthesize into actionable guidance tailored to the user context.
6. Provide source list and call out open unknowns requiring follow-up.

## Output Format

- `Question Framing`: what was researched and evaluation criteria.
- `Key Findings`: concise bullets with confidence tags (`high`, `medium`, `low`).
- `Comparison` (if relevant): side-by-side on criteria that drive decisions.
- `Recommendation`: direct answer with trade-offs.
- `Sources`: explicit URLs/titles used for verification.
