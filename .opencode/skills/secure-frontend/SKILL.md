---
name: secure-frontend
description: Secure web frontend surfaces. Use for browser-side threat modeling and mitigations (XSS/CSRF/CSP/token handling), not full bug bounty program flow.
triggers:
  - secure frontend
  - xss
  - csrf
  - csp
  - token storage
  - clickjacking
---

## Purpose

- Deliver frontend features that resist common web attacks without harming usability.
- Cover browser trust boundaries: DOM sinks, token handling, origin policy, and sensitive UX flows.

## When to Use

- User asks for frontend/web security review, secure UI implementation, or mitigation planning.
- Trigger terms: `XSS`, `CSRF`, `clickjacking`, `CSP`, `token storage`, `session`, `secure frontend`.
- Use for React/Next/web apps where browser behavior affects risk.
- Not for full-scope offensive hunting (`bug-bounty-workflow`) or broad security architecture (`cybersecurity-expert`).

## Constraints

- Must remain defensive and authorized; never provide malicious payload playbooks for abuse.
- Must treat all external/user content as untrusted before rendering.
- Must avoid dangerous DOM sinks (`innerHTML`, eval-like patterns) unless strictly sanitized and justified.
- Must prefer HttpOnly secure cookies for session auth; avoid long-lived tokens in localStorage when possible.
- Must enforce anti-CSRF strategy for cookie-authenticated actions.
- Must apply secure headers where app controls them: CSP, frame-ancestors, X-Content-Type-Options, Referrer-Policy.
- Must minimize sensitive data exposure in URL, client logs, analytics events, and error messages.

## Workflow

1. Map sensitive flows: login, payment, profile/account changes, admin actions.
2. Audit rendering and data ingestion paths for XSS/HTML injection risk.
3. Validate session/token lifecycle and cross-origin request behavior.
4. Check browser-level protections (CSP, framing, mixed content, dependency trust).
5. Patch unsafe patterns with framework-native safe APIs and strict validation.
6. Verify with practical checks in browser/devtools and automated tests where feasible.

## Output Format

- `Threat Surface`: sensitive pages/components and primary attack paths.
- `Findings`: `Issue | Risk | Location | Exploitability | Priority`.
- `Mitigations`: concrete code/config changes with rationale.
- `Verification`: before/after checks, tests, and browser evidence.
- `Hardening Backlog`: non-blocking improvements ranked by risk reduction.
