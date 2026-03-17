# OpenCode Skills Catalog — Curated by Domain

A comprehensive list of the best agent skills for every computer science branch, curated from 600+ skills across the ecosystem. All compatible with OpenCode via `.opencode/skills/`.

## Installation

Skills are SKILL.md files. Install by cloning into `.opencode/skills/` in your project or `~/.config/opencode/skills/` globally:

```bash
# Example: Install a single skill
mkdir -p .opencode/skills && cd .opencode/skills
git clone --depth 1 --filter=blob:none --sparse https://github.com/vercel-labs/agent-skills.git vercel
cd vercel && git sparse-checkout set skills/react-best-practices
```

Or use the install script: `./install-skills.sh` (see below)

---

## 🎨 Frontend

### Core Frameworks
| Skill | Source | What it does |
|-------|--------|-------------|
| React Best Practices | [vercel-labs](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Official Vercel React patterns, hooks, state |
| Next.js Best Practices | [vercel-labs](https://github.com/vercel-labs/next-skills/tree/main/skills/next-best-practices) | App Router, RSC, caching, SSR |
| Next.js Cache Components | [vercel-labs](https://github.com/vercel-labs/next-skills/tree/main/skills/next-cache-components) | Caching strategies, cache-aware components |
| Next.js Upgrade | [vercel-labs](https://github.com/vercel-labs/next-skills/tree/main/skills/next-upgrade) | Upgrade Next.js versions |
| React Composition Patterns | [vercel-labs](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | Component composition, reusable patterns |
| React Native | [vercel-labs](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-native-skills) | RN best practices and performance |
| React Native (CallStack) | [callstack](https://github.com/callstackincubator/agent-skills/blob/main/skills/react-native-best-practices/SKILL.md) | Performance optimization from RN experts |
| shadcn/ui | [google-labs](https://github.com/google-labs-code/stitch-skills/tree/main/skills/shadcn-ui) | shadcn/ui component patterns |
| SwiftUI | [AvdLee](https://github.com/AvdLee/SwiftUI-Agent-Skill/tree/main/swiftui-expert-skill) | Modern SwiftUI + Liquid Glass |
| Three.js | [CloudAI-X](https://github.com/CloudAI-X/threejs-skills) | 3D elements and interactive experiences |

### Design & UI/UX
| Skill | Source | What it does |
|-------|--------|-------------|
| Web Design Guidelines | [vercel-labs](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Official Vercel design standards |
| Frontend Design | [anthropic](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Anthropic's official UI/UX skill |
| UI Skills (ibelick) | [ibelick](https://github.com/ibelick/ui-skills) | Opinionated UI constraints for quality |
| Taste Skill | [Leonxlnx](https://github.com/Leonxlnx/taste-skill) | Good design taste with tunable variance |
| Platform Design (300+ rules) | [ehmo](https://github.com/ehmo/platform-design-skills) | Apple HIG + Material 3 + WCAG 2.2 |
| Apple HIG (14 skills) | [raintree](https://github.com/raintree-technology/apple-hig-skills) | Complete Apple Human Interface Guidelines |
| Canvas Design | [anthropic](https://github.com/anthropics/skills/tree/main/skills/canvas-design) | Visual art in PNG/PDF |
| Algorithmic Art | [anthropic](https://github.com/anthropics/skills/tree/main/skills/algorithmic-art) | Generative art with p5.js |

### Testing
| Skill | Source | What it does |
|-------|--------|-------------|
| Playwright Testing | [testdino](https://github.com/testdino-hq/playwright-skill) | 70+ production Playwright patterns |
| Webapp Testing | [anthropic](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | Test apps with Playwright |
| Web Performance | [cloudflare](https://github.com/cloudflare/skills/tree/main/skills/web-perf) | Core Web Vitals audit |

---

## ⚙️ Backend

### API & Frameworks
| Skill | Source | What it does |
|-------|--------|-------------|
| Stripe Integration | [stripe](https://github.com/stripe/ai/tree/main/skills/stripe-best-practices) | Official Stripe best practices |
| Stripe Upgrade | [stripe](https://github.com/stripe/ai/tree/main/skills/upgrade-stripe) | Upgrade Stripe SDK versions |
| FastAPI Router | [microsoft](https://github.com/microsoft/skills/tree/main/.github/skills/fastapi-router-py) | FastAPI CRUD + auth patterns |
| Pydantic Models | [microsoft](https://github.com/microsoft/skills/tree/main/.github/skills/pydantic-models-py) | API schema models |
| Better Auth | [better-auth](https://github.com/better-auth/skills/tree/main/better-auth/best-practices) | Auth integration best practices |

### Databases
| Skill | Source | What it does |
|-------|--------|-------------|
| Supabase Postgres | [supabase](https://github.com/supabase/agent-skills/tree/main/skills/supabase-postgres-best-practices) | Official Supabase PostgreSQL |
| Neon Serverless Postgres | [neon](https://github.com/neondatabase/agent-skills/tree/main/skills/neon-postgres) | Serverless Postgres patterns |
| ClickHouse | [clickhouse](https://github.com/ClickHouse/agent-skills) | OLAP database best practices |
| Tinybird | [tinybird](https://github.com/tinybirdco/tinybird-agent-skills/tree/main/skills/tinybird-best-practices) | Real-time analytics datasources |
| Safe SQL Queries | [sanjay3290](https://github.com/sanjay3290/ai-skills/tree/main/skills/postgres) | Read-only PostgreSQL queries |

### CMS & Content
| Skill | Source | What it does |
|-------|--------|-------------|
| Sanity Best Practices | [sanity](https://github.com/sanity-io/agent-toolkit/tree/main/skills/sanity-best-practices) | Studio, GROQ, content workflows |
| Sanity Content Modeling | [sanity](https://github.com/sanity-io/agent-toolkit/tree/main/skills/content-modeling-best-practices) | Scalable content models |
| SEO/AEO | [sanity](https://github.com/sanity-io/agent-toolkit/tree/main/skills/seo-aeo-best-practices) | SEO + answer engine optimization |
| WordPress | [wordpress](https://github.com/WordPress/skills) | WordPress development |

---

## ☁️ Cloud & Infrastructure

### Deployment Platforms
| Skill | Source | What it does |
|-------|--------|-------------|
| Cloudflare Workers | [cloudflare](https://github.com/cloudflare/skills/tree/main/skills/wrangler) | Workers, KV, R2, D1, Queues |
| Cloudflare Platform | [dmmulroy](https://github.com/dmmulroy/cloudflare-skill/tree/main/skills/cloudflare) | Complete Cloudflare reference |
| Cloudflare Agents SDK | [cloudflare](https://github.com/cloudflare/skills/tree/main/skills/agents-sdk) | Stateful AI agents on CF |
| Durable Objects | [cloudflare](https://github.com/cloudflare/skills/tree/main/skills/durable-objects) | Stateful coordination, SQLite, WS |
| Netlify (12 skills) | [netlify](https://github.com/netlify/context-and-tools/tree/main/skills) | Functions, edge, blobs, DB, CDN |
| Vercel Deploy | [vercel-labs](https://github.com/vercel-labs/agent-skills/tree/main/skills/claude.ai/vercel-deploy-claimable) | Deploy to Vercel |
| AWS Skills | [zxkane](https://github.com/zxkane/aws-skills) | AWS infra automation |

### Infrastructure as Code
| Skill | Source | What it does |
|-------|--------|-------------|
| Terraform Code Gen | [hashicorp](https://github.com/hashicorp/agent-skills/tree/main/terraform/code-generation) | Official HashiCorp Terraform |
| Terraform Modules | [hashicorp](https://github.com/hashicorp/agent-skills/tree/main/terraform/module-generation) | Create/refactor TF modules |
| Terraform Providers | [hashicorp](https://github.com/hashicorp/agent-skills/tree/main/terraform/provider-development) | Develop TF providers |
| Terraform (Community) | [antonbabenko](https://github.com/antonbabenko/terraform-skill) | Community TF best practices |

### Azure (Microsoft Official — 100+ skills)
Full Azure SDK coverage in .NET, Java, Python, Rust, TypeScript:
- AI/ML: Agents, Document Intelligence, OpenAI, Content Safety, Vision, Voice
- Data: Cosmos DB, PostgreSQL, MySQL, Redis, SQL, Tables, Search
- Messaging: Service Bus, Event Hub, Event Grid, WebPubSub
- Storage: Blob, File Share, Data Lake, Queue
- Identity: Entra ID auth for all languages
- DevOps: Key Vault, App Config, Monitor, Playwright Testing
- [Full list](https://github.com/microsoft/skills/tree/main/.github/skills)

---

## 🔒 Security

### Code Security
| Skill | Source | What it does |
|-------|--------|-------------|
| Trail of Bits (22 skills) | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins) | Industry-leading security audit skills |
| Static Analysis | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/static-analysis) | CodeQL, Semgrep, SARIF |
| Property-Based Testing | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/property-based-testing) | Multi-language + smart contracts |
| Differential Review | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/differential-review) | Security-focused diff review |
| Smart Contract Security | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/building-secure-contracts) | 6 blockchains |
| VibeSec | [BehiSecc](https://github.com/BehiSecc/VibeSec-Skill) | IDOR, XSS, SQLi, SSRF prevention |
| ClawSec | [prompt-security](https://github.com/prompt-security/clawsec) | Drift detection, skill integrity |
| Defense in Depth | [obra](https://github.com/obra/superpowers/blob/main/skills/defense-in-depth/SKILL.md) | Multi-layered security |
| Firebase APK Scanner | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/firebase-apk-scanner) | APK Firebase misconfig scan |
| Insecure Defaults | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/insecure-defaults) | Hardcoded secrets, weak crypto |
| Semgrep Rules | [trailofbits](https://github.com/trailofbits/skills/tree/main/plugins/semgrep-rule-creator) | Create vulnerability detection rules |
| Security Blue Book | [SHADOWPR0](https://github.com/SHADOWPR0/security-bluebook-builder) | Security documentation builder |
| Env Variable Security | [wrsmith108](https://github.com/wrsmith108/varlock-claude-skill) | Secrets never exposed |

---

## 🧪 Testing & Quality

| Skill | Source | What it does |
|-------|--------|-------------|
| Test-Driven Development | [obra](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) | Tests before implementation |
| Systematic Debugging | [obra](https://github.com/obra/superpowers/blob/main/skills/systematic-debugging/SKILL.md) | Methodical problem-solving |
| Root Cause Tracing | [obra](https://github.com/obra/superpowers/blob/main/skills/root-cause-tracing/SKILL.md) | Find fundamental problems |
| Testing Anti-Patterns | [obra](https://github.com/obra/superpowers/blob/main/skills/testing-anti-patterns/SKILL.md) | Identify bad testing |
| Code Review (NeoLab) | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/code-review) | Multi-agent PR review |
| Reflexion | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/reflexion) | Self-refinement loop |
| Pairwise Testing | [omkamal](https://github.com/omkamal/pypict-claude-skill/blob/main/SKILL.md) | Pairwise test generation |
| Verification | [obra](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md) | Validate before finalizing |

---

## 🤖 AI/ML

| Skill | Source | What it does |
|-------|--------|-------------|
| Hugging Face CLI | [huggingface](https://github.com/huggingface/skills/tree/main/skills/hugging-face-cli) | HF Hub models, datasets |
| HF Model Trainer | [huggingface](https://github.com/huggingface/skills/tree/main/skills/hugging-face-model-trainer) | SFT, DPO, GRPO, GGUF |
| HF Evaluation | [huggingface](https://github.com/huggingface/skills/tree/main/skills/hugging-face-evaluation) | Model eval with lighteval |
| HF Datasets | [huggingface](https://github.com/huggingface/skills/tree/main/skills/hugging-face-datasets) | Create/manage datasets |
| HF Experiment Tracking | [huggingface](https://github.com/huggingface/skills/tree/main/skills/hugging-face-trackio) | Real-time ML dashboards |
| Replicate | [replicate](https://github.com/replicate/skills/tree/main/skills/replicate) | Run AI models via API |
| fal.ai | [fal.ai](https://github.com/fal-ai/skills) | AI media generation |
| Image Generation | [sanjay3290](https://github.com/sanjay3290/ai-skills/tree/main/skills/imagen) | Google Gemini Imagen |
| AI Research (77 skills) | [zechenzhang](https://github.com/zechenzhangAGI/AI-research-SKILLs) | Model training, inference, MLOps |
| AI Research (20 modules) | [Orchestra](https://github.com/Orchestra-Research/AI-research-SKILLs) | Architecture, training, papers |
| LLM Eval Audit | [hamelsmu](https://github.com/hamelsmu/prompts/tree/main/evals-skills/skills/eval-audit) | Audit LLM eval pipelines |
| LLM Error Analysis | [hamelsmu](https://github.com/hamelsmu/prompts/tree/main/evals-skills/skills/error-analysis) | Find LLM failure modes |
| LLM Judge Design | [hamelsmu](https://github.com/hamelsmu/prompts/tree/main/evals-skills/skills/write-judge-prompt) | LLM-as-Judge evaluators |
| RAG Evaluation | [hamelsmu](https://github.com/hamelsmu/prompts/tree/main/evals-skills/skills/evaluate-rag) | RAG retrieval + generation quality |
| Synthetic Data | [hamelsmu](https://github.com/hamelsmu/prompts/tree/main/evals-skills/skills/generate-synthetic-data) | Diverse test inputs for evals |

---

## 🔧 DevOps & Tooling

### Git & GitHub
| Skill | Source | What it does |
|-------|--------|-------------|
| GitHub Workflows | [callstack](https://github.com/callstackincubator/agent-skills/tree/main/skills/github) | PRs, reviews, branching |
| Sentry Skills (7) | [getsentry](https://github.com/getsentry/skills/tree/main/plugins/sentry-skills/skills) | Code review, PRs, commits, bugs |
| Git Dev Workflow | [fvadicamo](https://github.com/fvadicamo/dev-agent-skills) | Git + GitHub workflow |
| Git Worktrees | [obra](https://github.com/obra/superpowers/blob/main/skills/using-git-worktrees/SKILL.md) | Multiple working trees |
| Finishing Branches | [obra](https://github.com/obra/superpowers/blob/main/skills/finishing-a-development-branch/SKILL.md) | Complete Git branches |

### MCP & Agent Building
| Skill | Source | What it does |
|-------|--------|-------------|
| MCP Builder | [anthropic](https://github.com/anthropics/skills/tree/main/skills/mcp-builder) | Create MCP servers |
| MCP on Cloudflare | [cloudflare](https://github.com/cloudflare/skills/tree/main/skills/building-mcp-server-on-cloudflare) | Remote MCP servers + OAuth |
| Skill Creator | [anthropic](https://github.com/anthropics/skills/tree/main/skills/skill-creator) | Create new agent skills |
| Auto Skill Converter | [Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers) | Convert docs/repos → skills |

### Automation
| Skill | Source | What it does |
|-------|--------|-------------|
| n8n (7 skills) | [czlonkowski](https://github.com/czlonkowski/n8n-skills) | Workflow automation |
| Composio (1000+ apps) | [ComposioHQ](https://github.com/ComposioHQ/skills) | Connect agents to external apps |
| iOS Simulator | [conorluddy](https://github.com/conorluddy/ios-simulator-skill) | Control iOS Simulator |
| Home Assistant | [komal-SkyNET](https://github.com/komal-SkyNET/claude-skill-homeassistant) | Smart home management |
| VMware AIOps | [zw008](https://github.com/zw008/VMware-AIops) | VMware monitoring + ops |

---

## 📄 Documents & Media

| Skill | Source | What it does |
|-------|--------|-------------|
| Word Documents | [anthropic](https://github.com/anthropics/skills/tree/main/skills/docx) | Create/edit/analyze DOCX |
| PowerPoint | [anthropic](https://github.com/anthropics/skills/tree/main/skills/pptx) | Create/edit/analyze PPTX |
| Excel | [anthropic](https://github.com/anthropics/skills/tree/main/skills/xlsx) | Create/edit/analyze XLSX |
| PDF | [anthropic](https://github.com/anthropics/skills/tree/main/skills/pdf) | Extract text, create PDFs |
| Doc Co-Authoring | [anthropic](https://github.com/anthropics/skills/tree/main/skills/doc-coauthoring) | Collaborative editing |
| HTML Presentations | [zarazhangrui](https://github.com/zarazhangrui/frontend-slides) | Animation-rich slides |
| PPT Generation | [op7418](https://github.com/op7418/NanoBanana-PPT-Skills) | AI PPT with styled images |
| Remotion Video | [remotion](https://github.com/remotion-dev/skills/tree/main/skills/remotion) | Programmatic video with React |
| Video DB | [video-db](https://github.com/video-db/skills) | Video workflows, transcription |
| Document Extraction (62+) | [kreuzberg](https://github.com/kreuzberg-dev/kreuzberg/tree/main/skills/kreuzberg) | Extract from 62+ formats |
| Nutrient Documents | [PSPDFKit](https://github.com/PSPDFKit-labs/nutrient-agent-skill) | Convert, OCR, redact, sign |

---

## 📱 Mobile

| Skill | Source | What it does |
|-------|--------|-------------|
| Expo App Design | [expo](https://github.com/expo/skills/tree/main/plugins/expo-app-design) | Design Expo apps |
| Expo Deployment | [expo](https://github.com/expo/skills/tree/main/plugins/expo-deployment) | Deploy Expo apps |
| Expo Upgrade | [expo](https://github.com/expo/skills/tree/main/plugins/upgrading-expo) | Upgrade Expo SDK |
| React Native Upgrade | [callstack](https://github.com/callstackincubator/agent-skills/tree/main/skills/upgrading-react-native) | RN upgrade workflow |
| Swift Server | [Joannis](https://github.com/Joannis/claude-skills) | Swift Server development |
| Swift Patterns | [efremidze](https://github.com/efremidze/swift-patterns-skill/tree/main/swift-patterns) | Modern Swift/SwiftUI |
| App Store Connect | [rudrankriyam](https://github.com/rudrankriyam/app-store-connect-cli-skills) | ASC CLI automation |
| iOS Accessibility | [ramzesenok](https://github.com/rameerez/iOS-Accessibility-Audit-Skill) | iOS a11y audit |

---

## 🧠 Context Engineering & Architecture

| Skill | Source | What it does |
|-------|--------|-------------|
| Context Fundamentals | [muratcankoylan](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/context-fundamentals) | What context is, why it matters |
| Context Compression | [muratcankoylan](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/context-compression) | Compression for long sessions |
| Multi-Agent Patterns | [muratcankoylan](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/multi-agent-patterns) | Orchestrator, peer, hierarchical |
| Memory Systems | [muratcankoylan](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/memory-systems) | Short/long-term memory design |
| Tool Design | [muratcankoylan](https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering/tree/main/skills/tool-design) | Build agent-usable tools |
| Data Structure Protocol | [k-kolomeitsev](https://github.com/k-kolomeitsev/data-structure-protocol) | Graph-based long-term memory |
| DDD + Clean Architecture | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/ddd) | Domain-driven + SOLID |
| Spec-Driven Development | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/sdd) | Prompt → production code |
| Subagent Development | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/sadd) | Parallel subagent dispatch |
| Kaizen Improvement | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/kaizen) | Continuous improvement methodology |
| Recursive Decomposition | [massimodeluisa](https://github.com/massimodeluisa/recursive-decomposition-skill) | Handle 100+ file tasks |
| Model Routing | [zscole](https://github.com/zscole/model-hierarchy-skill) | Cost-optimized model selection |
| Prompt Engineering | [NeoLabHQ](https://github.com/NeoLabHQ/context-engineering-kit/tree/master/plugins/customaize-agent/skills/prompt-engineering) | Anthropic best practices |

---

## 📢 Marketing & Content

| Skill | Source | What it does |
|-------|--------|-------------|
| 17 Marketing Frameworks | [BrianRWagner](https://github.com/BrianRWagner/ai-marketing-skills) | Cold outreach, homepage audit |
| SEO Universal | [AgriciDaniel](https://github.com/AgriciDaniel/claude-seo) | Website SEO analysis |
| Email Marketing (55K words) | [CosmoBlk](https://github.com/CosmoBlk/email-marketing-bible) | Complete email marketing |
| Creative Director | [smixs](https://github.com/smixs/creative-director-skill) | 20+ creative methodologies |
| Social Publishing | [typefully](https://github.com/typefully/agent-skills/tree/main/skills/typefully) | X, LinkedIn, Threads, Bluesky |
| Humanizer | [blader](https://github.com/blader/humanizer) | Remove AI writing signals |
| Product Management | (multiple) | PM skills from Dean Peters & Paweł Huryn |

---

## 🏢 Google Workspace (26 skills)

Full Google Workspace CLI coverage:
Gmail, Calendar, Drive, Sheets, Docs, Slides, Tasks, People, Chat, Forms, Keep, Meet, Vault, Admin, Classroom, Apps Script, Cloud Identity, Alert Center, Events, Model Armor, Workflows
→ [Full list](https://github.com/googleworkspace/cli/tree/main/skills)

---

## 🔥 Top Picks — Must-Have Skills

If you install nothing else, get these:

1. **Trail of Bits Security** — Best security audit skills, period
2. **Vercel React/Next.js** — Official framework best practices
3. **Supabase Postgres** — Database patterns from the Supabase team
4. **Stripe Integration** — Payment integration done right
5. **Cloudflare Workers** — Edge deployment
6. **Anthropic Skill Creator** — Meta: create more skills
7. **NeoLab Code Review** — Multi-agent PR reviews
8. **Hugging Face ML** — Complete ML workflow
9. **obra Superpowers** — TDD, debugging, subagents, git workflow
10. **Context Engineering** — Understand agent context at a deep level

---

## Install Script

See `install-skills.sh` for automated installation of selected skill groups.
