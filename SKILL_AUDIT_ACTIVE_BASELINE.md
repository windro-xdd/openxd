# Active Skill Audit Baseline

Scope: `.opencode/skills/**/SKILL.md` only, excluding `.opencode/skills-backup/**`.

## Verification

- Active skill files found: **16**
- Backup skill files found under excluded path: **233**
- Confirmed inventory below contains exactly 16 files and **none** from `.opencode/skills-backup/**`.

Active file list (16):

1. `.opencode/skills/anti-slop-design/SKILL.md`
2. `.opencode/skills/bb-continue/SKILL.md`
3. `.opencode/skills/bb-find/SKILL.md`
4. `.opencode/skills/bb-start/SKILL.md`
5. `.opencode/skills/code-review/skills/review-local-changes/SKILL.md`
6. `.opencode/skills/code-review/skills/review-pr/SKILL.md`
7. `.opencode/skills/composition-patterns/SKILL.md`
8. `.opencode/skills/cybersecurity-expert/SKILL.md`
9. `.opencode/skills/frontend-design/SKILL.md`
10. `.opencode/skills/frontend-mastery/SKILL.md`
11. `.opencode/skills/next-best-practices/SKILL.md`
12. `.opencode/skills/next-cache-components/SKILL.md`
13. `.opencode/skills/react-best-practices/SKILL.md`
14. `.opencode/skills/shadcn-ui/SKILL.md`
15. `.opencode/skills/ui-ux-mastery/SKILL.md`
16. `.opencode/skills/web-design-guidelines/SKILL.md`

## Loader Expectations

Source: `packages/opencode/src/skill/skill.ts`, `packages/opencode/src/tool/skill.ts`

- Required frontmatter for load eligibility:
  - `name: string`
  - `description: string`
  - Skills missing either are skipped (`Info.pick({ name, description }).safeParse(...)`).
- Optional/ignored frontmatter for loader behavior:
  - Keys like `metadata`, `argument-hint`, `allowed-tools`, `license`, trigger metadata are not used by loader indexing.
  - Body markdown is loaded as raw `content`.
- Discovery patterns and order:
  - External dirs (unless `OPENCODE_DISABLE_EXTERNAL_SKILLS`):
    - roots: `~/.claude`, `~/.agents`, then upward project roots for `.claude` / `.agents`
    - pattern: `skills/**/SKILL.md`
  - OpenCode config dirs (`Config.directories()`):
    - pattern: `{skill,skills}/**/SKILL.md`
  - `config.skills.paths[]`:
    - supports `~/` and relative paths
    - pattern: `**/SKILL.md`
  - `config.skills.urls[]` via `Discovery.pull(url)` dirs:
    - pattern: `**/SKILL.md`
- Duplicate handling:
  - Duplicate skill `name` logs warning.
  - Last discovered entry overwrites earlier one (`skills[name] = ...`).
- Trigger semantics:
  - No hard trigger parser in loader.
  - Selection is explicit by tool parameter `name` in `SkillTool`.
  - Tool prompt lists available skills; model may choose one based on task context/description.
  - On execute, permission is requested (`ctx.ask`), then output is injected as `<skill_content name="...">`.

## Baseline Table

Token estimate formula: `ceil(chars / 4)`.

| file                                                                | chars | est_tokens | sections                                                                                               | quality_flags                                             |
| ------------------------------------------------------------------- | ----: | ---------: | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `.opencode/skills/anti-slop-design/SKILL.md`                        |  8976 |       2244 | H1: Anti-Slop Design System; H2: checklist, design principles, implementation rules, landing-page flow | unclear_output_format                                     |
| `.opencode/skills/bb-continue/SKILL.md`                             |   842 |        211 | H1: Bug Bounty Hunter - Resume; H2: steps, fallback path                                               | unclear_output_format                                     |
| `.opencode/skills/bb-find/SKILL.md`                                 |  2091 |        523 | H1: Bug Bounty Program Finder; H2: criteria, process, output, selection handoff                        | none                                                      |
| `.opencode/skills/bb-start/SKILL.md`                                |  8469 |       2118 | H1: Bug Bounty Hunter - Expert Mode; H2/H3: recon/manual/hunting/validation phased workflow            | redundant_text(minor)                                     |
| `.opencode/skills/code-review/skills/review-local-changes/SKILL.md` | 12038 |       3010 | H1: Local Changes Review Instructions; H2/H3: 3 phases, scoring, full report templates                 | redundant_text                                            |
| `.opencode/skills/code-review/skills/review-pr/SKILL.md`            | 13649 |       3413 | H1: Pull Request Review Instructions; H2/H3: 3 phases, scoring thresholds, inline comment templates    | redundant_text                                            |
| `.opencode/skills/composition-patterns/SKILL.md`                    |  2886 |        722 | H1: React Composition Patterns; H2: applicability, categories, quick reference, usage                  | weak_workflow, unclear_output_format                      |
| `.opencode/skills/cybersecurity-expert/SKILL.md`                    | 40889 |      10223 | H1: Cybersecurity & Bug Bounty Expert; H2/H3: massive vuln taxonomy, cloud/mobile/tooling/reporting    | redundant_text, weak_workflow, unclear_output_format      |
| `.opencode/skills/frontend-design/SKILL.md`                         |  4440 |       1110 | H2 only: design thinking, aesthetics guidelines (no H1)                                                | missing_constraints, weak_workflow, unclear_output_format |
| `.opencode/skills/frontend-mastery/SKILL.md`                        | 39019 |       9755 | H1: Frontend Mastery; H2/H3: HTML/CSS/JS/React/perf/a11y deep reference                                | redundant_text, weak_workflow, unclear_output_format      |
| `.opencode/skills/next-best-practices/SKILL.md`                     |  4004 |       1001 | H1: Next.js Best Practices; H2: topic checklist across RSC/data/runtime/errors/optimization            | weak_workflow, unclear_output_format                      |
| `.opencode/skills/next-cache-components/SKILL.md`                   |  9362 |       2341 | H1: Cache Components (Next.js 16+); H2/H3: directive/lifecycle/invalidation/migration guide            | weak_workflow, unclear_output_format                      |
| `.opencode/skills/react-best-practices/SKILL.md`                    |  6242 |       1561 | H1: Vercel React Best Practices; H2/H3: category priority matrix + quick reference                     | weak_workflow, unclear_output_format                      |
| `.opencode/skills/shadcn-ui/SKILL.md`                               |  9207 |       2302 | H1: shadcn/ui Component Integration; H2/H3: install/setup/patterns/troubleshooting                     | redundant_text(minor), unclear_output_format              |
| `.opencode/skills/ui-ux-mastery/SKILL.md`                           | 25122 |       6281 | H1: UI/UX Mastery; H2/H3: principles, color, styles, motion, layout, responsive, system                | redundant_text, weak_workflow, unclear_output_format      |
| `.opencode/skills/web-design-guidelines/SKILL.md`                   |  1231 |        308 | H1: Web Interface Guidelines; H2: how-it-works, source, usage                                          | none                                                      |
