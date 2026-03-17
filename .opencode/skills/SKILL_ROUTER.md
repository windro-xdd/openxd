# Skill Router (No-Overlap Map)

Use exactly one primary skill first. Add a secondary skill only when needed.

## Frontend / UI

- `frontend-design`: visual direction, theming, component aesthetics, reskin.
- `ui-ux-mastery`: user flow, IA, interaction states, conversion/usability.
- `web-design-guidelines`: compliance audit against explicit guideline rules.
- `anti-slop-design`: secondary quality pass to remove generic AI-looking output.
- `frontend-mastery`: frontend architecture, bugs, state/data flow, performance.
- `secure-frontend`: browser-side security (XSS/CSRF/CSP/token/session handling).

## Security

- `bug-bounty-workflow`: end-to-end bounty execution (scope -> hunt -> report).
- `cybersecurity-expert`: broad security analysis/architecture/remediation strategy.
- `backend-security`: API/service security controls and server-side hardening.

## Backend / Data / Quality

- `backend-engineering`: backend implementation/refactor/ops reliability.
- `language-selection-guide`: choose language/runtime with explicit constraints and trade-offs.
- `api-design-best-practices`: API contracts, compatibility, error/auth semantics.
- `database-practices`: schema/query/migration/index design and safety.
- `testing-and-qa`: risk-based testing and release validation.
- `programming-best-practices`: language-agnostic code quality baseline.

## Language-Specific

- `javascript-typescript-best-practices`
- `python-best-practices`
- `go-best-practices`
- `java-best-practices`
- `rust-best-practices`

## Platform / Ops

- `windows-best-practices`
- `macos-best-practices`
- `linux-best-practices`
- `android-best-practices`

## Research

- `web-research-best-practices`: modern web research and source-backed synthesis.

## Selection Rules

- If user asks "audit/check/compliance" -> prefer `web-design-guidelines` or security audit skill.
- If user asks "build/implement/fix" -> prefer implementation skill (`frontend-mastery`, `backend-engineering`, etc.).
- If request mixes implementation + security -> pick implementation skill primary, security skill secondary.
- Avoid loading multiple overlapping visual skills together unless explicitly requested.
