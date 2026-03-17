# Compact SKILL.md Authoring Rules (Source-backed)

Goal: rewrite OpenCode skills into compact, high-signal instructions while preserving activation intent and execution reliability.

## Rules

1. **Frontmatter is your trigger contract, not marketing text.**
   - **Why (sources):** Skill selection uses `name` and `description`; description should include what it does and when to use it.
     - https://agentskills.io/specification
     - https://platform.openai.com/docs/guides/tools-skills
   - **Direct edit rule:** Rewrite each `description` to one sentence in the pattern: `Do X. Use when Y.` Include concrete trigger keywords users actually say.

2. **Put highest-priority constraints first, keep one canonical order.**
   - **Why (sources):** Models follow clearer, explicit structure; critical constraints should be early and consistently delimited.
     - https://platform.openai.com/docs/guides/prompt-engineering
     - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices
     - https://ai.google.dev/gemini-api/docs/prompting-strategies
   - **Direct edit rule:** Standardize body order to: `When to use` -> `Do` -> `Do not` -> `Workflow` -> `Output contract` -> `Escalation`.

3. **Convert prose into explicit constraints and deterministic output contracts.**
   - **Why (sources):** Explicit output contracts and formatting requirements improve instruction adherence and reduce drift.
     - https://platform.openai.com/docs/guides/prompt-guidance
     - https://ai.google.dev/gemini-api/docs/prompting-strategies
   - **Direct edit rule:** Replace vague text with testable bullets ("must/never/exactly"); add a final "Output" block with exact sections or schema and forbidden extras.

4. **Use short, dependency-aware workflows (3-7 steps max in main file).**
   - **Why (sources):** Sequential steps improve completeness; dependency checks reduce skipped prerequisites.
     - https://platform.openai.com/docs/guides/prompt-guidance
     - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices
   - **Direct edit rule:** Rewrite long procedures into numbered steps where each step is atomic and starts with an action verb. Move branch logic to a compact "If blocked" section.

5. **Enforce progressive disclosure to cut context load.**
   - **Why (sources):** Entire `SKILL.md` body loads on activation; spec recommends keeping it focused and moving details to referenced files.
     - https://agentskills.io/specification
   - **Direct edit rule:** Keep `SKILL.md` as operational summary only; move examples, deep rationale, and edge-case catalogs into `references/*.md` and link them.

6. **Cap size with measurable budgets (anti-bloat gate).**
   - **Why (sources):** Agent Skills spec recommends `<5000` instruction tokens and main file under 500 lines.
     - https://agentskills.io/specification
   - **Direct edit rule:** For OpenCode skills, set stricter house limits: target <=200 lines and <=1500 words for `SKILL.md`; fail review if exceeded unless justified by complexity.

7. **Prefer one strong example over many weak ones.**
   - **Why (sources):** Examples are high-leverage, but too many can overfit or bloat context; consistency matters.
     - https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices
     - https://ai.google.dev/gemini-api/docs/prompting-strategies
   - **Direct edit rule:** Include at most 1-2 minimal examples in `SKILL.md` (only if needed for format disambiguation); move all additional examples to `references/`.

8. **Stabilize reusable prefixes across skills.**
   - **Why (sources):** Exact prompt-prefix reuse improves caching and lowers latency/cost.
     - https://platform.openai.com/docs/guides/prompt-caching
   - **Direct edit rule:** Reuse identical headings and boilerplate phrasing for shared sections across skills (especially constraints/output blocks); put variable task-specific text later.

9. **Add a built-in verification loop for completion-critical skills.**
   - **Why (sources):** Explicit verification checks improve correctness, formatting compliance, and safe finalization.
     - https://platform.openai.com/docs/guides/prompt-guidance
   - **Direct edit rule:** End each execution skill with a 3-check "Before finish" block: requirement coverage, evidence/grounding check, output-format check.

## Quick audit checklist for SKILL rewrites

- Description matches `Do X. Use when Y.` and contains trigger terms.
- Body follows the canonical section order.
- Workflow is short, numbered, and dependency-aware.
- Output contract is explicit and machine-checkable.
- Main file fits size budget; overflow moved to `references/`.
- Any examples are minimal and consistent.
- Ends with "Before finish" verification block.
