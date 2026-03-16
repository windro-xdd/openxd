#!/usr/bin/env bash
# install-skills.sh — Install curated skills for OpenCode
# Usage: ./install-skills.sh [--all | --category CATEGORY | --list]
#
# Categories: frontend, backend, cloud, security, testing, ai-ml, devops, docs, mobile, context, marketing, google

set -euo pipefail

SKILLS_DIR="${OPENCODE_SKILLS_DIR:-.opencode/skills}"
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Color output
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err() { echo -e "${RED}[-]${NC} $1"; }

install_skill() {
  local name="$1" repo="$2" path="$3"
  local dest="$SKILLS_DIR/$name"

  if [[ -d "$dest" ]]; then
    warn "Skipping $name (already installed)"
    return
  fi

  log "Installing $name..."
  local repo_dir="$TEMP_DIR/$(echo "$repo" | md5sum | cut -c1-8)"

  if [[ ! -d "$repo_dir" ]]; then
    git clone --depth 1 --quiet "$repo" "$repo_dir" 2>/dev/null || {
      err "Failed to clone $repo"
      return
    }
  fi

  if [[ -d "$repo_dir/$path" ]]; then
    mkdir -p "$dest"
    cp -r "$repo_dir/$path"/* "$dest/" 2>/dev/null || cp -r "$repo_dir/$path"/. "$dest/"
  else
    err "Path $path not found in $repo"
  fi
}

install_frontend() {
  log "=== Frontend Skills ==="
  install_skill "react-best-practices" "https://github.com/vercel-labs/agent-skills.git" "skills/react-best-practices"
  install_skill "next-best-practices" "https://github.com/vercel-labs/next-skills.git" "skills/next-best-practices"
  install_skill "next-cache-components" "https://github.com/vercel-labs/next-skills.git" "skills/next-cache-components"
  install_skill "next-upgrade" "https://github.com/vercel-labs/next-skills.git" "skills/next-upgrade"
  install_skill "composition-patterns" "https://github.com/vercel-labs/agent-skills.git" "skills/composition-patterns"
  install_skill "web-design-guidelines" "https://github.com/vercel-labs/agent-skills.git" "skills/web-design-guidelines"
  install_skill "frontend-design" "https://github.com/anthropics/skills.git" "skills/frontend-design"
  install_skill "shadcn-ui" "https://github.com/google-labs-code/stitch-skills.git" "skills/shadcn-ui"
  install_skill "playwright-testing" "https://github.com/testdino-hq/playwright-skill.git" "."
  install_skill "webapp-testing" "https://github.com/anthropics/skills.git" "skills/webapp-testing"
  install_skill "web-perf" "https://github.com/cloudflare/skills.git" "skills/web-perf"
  install_skill "react-native" "https://github.com/vercel-labs/agent-skills.git" "skills/react-native-skills"
  install_skill "threejs" "https://github.com/CloudAI-X/threejs-skills.git" "."
}

install_backend() {
  log "=== Backend Skills ==="
  install_skill "stripe-best-practices" "https://github.com/stripe/ai.git" "skills/stripe-best-practices"
  install_skill "upgrade-stripe" "https://github.com/stripe/ai.git" "skills/upgrade-stripe"
  install_skill "supabase-postgres" "https://github.com/supabase/agent-skills.git" "skills/supabase-postgres-best-practices"
  install_skill "neon-postgres" "https://github.com/neondatabase/agent-skills.git" "skills/neon-postgres"
  install_skill "clickhouse" "https://github.com/ClickHouse/agent-skills.git" "."
  install_skill "tinybird" "https://github.com/tinybirdco/tinybird-agent-skills.git" "skills/tinybird-best-practices"
  install_skill "better-auth" "https://github.com/better-auth/skills.git" "better-auth/best-practices"
  install_skill "sanity" "https://github.com/sanity-io/agent-toolkit.git" "skills/sanity-best-practices"
}

install_cloud() {
  log "=== Cloud & Infrastructure Skills ==="
  install_skill "cloudflare-wrangler" "https://github.com/cloudflare/skills.git" "skills/wrangler"
  install_skill "cloudflare-agents-sdk" "https://github.com/cloudflare/skills.git" "skills/agents-sdk"
  install_skill "cloudflare-durable-objects" "https://github.com/cloudflare/skills.git" "skills/durable-objects"
  install_skill "cloudflare-mcp" "https://github.com/cloudflare/skills.git" "skills/building-mcp-server-on-cloudflare"
  install_skill "terraform-code-gen" "https://github.com/hashicorp/agent-skills.git" "terraform/code-generation"
  install_skill "terraform-modules" "https://github.com/hashicorp/agent-skills.git" "terraform/module-generation"
  install_skill "aws" "https://github.com/zxkane/aws-skills.git" "."
}

install_security() {
  log "=== Security Skills ==="
  install_skill "tob-static-analysis" "https://github.com/trailofbits/skills.git" "plugins/static-analysis"
  install_skill "tob-differential-review" "https://github.com/trailofbits/skills.git" "plugins/differential-review"
  install_skill "tob-property-testing" "https://github.com/trailofbits/skills.git" "plugins/property-based-testing"
  install_skill "tob-semgrep" "https://github.com/trailofbits/skills.git" "plugins/semgrep-rule-creator"
  install_skill "tob-insecure-defaults" "https://github.com/trailofbits/skills.git" "plugins/insecure-defaults"
  install_skill "tob-secure-contracts" "https://github.com/trailofbits/skills.git" "plugins/building-secure-contracts"
  install_skill "tob-testing-handbook" "https://github.com/trailofbits/skills.git" "plugins/testing-handbook-skills"
  install_skill "vibesec" "https://github.com/BehiSecc/VibeSec-Skill.git" "."
  install_skill "clawsec" "https://github.com/prompt-security/clawsec.git" "."
  install_skill "varlock" "https://github.com/wrsmith108/varlock-claude-skill.git" "."
}

install_testing() {
  log "=== Testing & Quality Skills ==="
  install_skill "tdd" "https://github.com/obra/superpowers.git" "skills/test-driven-development"
  install_skill "systematic-debugging" "https://github.com/obra/superpowers.git" "skills/systematic-debugging"
  install_skill "root-cause-tracing" "https://github.com/obra/superpowers.git" "skills/root-cause-tracing"
  install_skill "testing-anti-patterns" "https://github.com/obra/superpowers.git" "skills/testing-anti-patterns"
  install_skill "verification" "https://github.com/obra/superpowers.git" "skills/verification-before-completion"
  install_skill "code-review" "https://github.com/NeoLabHQ/context-engineering-kit.git" "plugins/code-review"
  install_skill "reflexion" "https://github.com/NeoLabHQ/context-engineering-kit.git" "plugins/reflexion"
}

install_ai_ml() {
  log "=== AI/ML Skills ==="
  install_skill "hf-cli" "https://github.com/huggingface/skills.git" "skills/hugging-face-cli"
  install_skill "hf-model-trainer" "https://github.com/huggingface/skills.git" "skills/hugging-face-model-trainer"
  install_skill "hf-evaluation" "https://github.com/huggingface/skills.git" "skills/hugging-face-evaluation"
  install_skill "hf-datasets" "https://github.com/huggingface/skills.git" "skills/hugging-face-datasets"
  install_skill "replicate" "https://github.com/replicate/skills.git" "skills/replicate"
  install_skill "eval-audit" "https://github.com/hamelsmu/prompts.git" "evals-skills/skills/eval-audit"
  install_skill "error-analysis" "https://github.com/hamelsmu/prompts.git" "evals-skills/skills/error-analysis"
  install_skill "synthetic-data" "https://github.com/hamelsmu/prompts.git" "evals-skills/skills/generate-synthetic-data"
}

install_devops() {
  log "=== DevOps Skills ==="
  install_skill "github-workflow" "https://github.com/callstackincubator/agent-skills.git" "skills/github"
  install_skill "sentry-skills" "https://github.com/getsentry/skills.git" "plugins/sentry-skills"
  install_skill "git-worktrees" "https://github.com/obra/superpowers.git" "skills/using-git-worktrees"
  install_skill "mcp-builder" "https://github.com/anthropics/skills.git" "skills/mcp-builder"
  install_skill "skill-creator" "https://github.com/anthropics/skills.git" "skills/skill-creator"
}

install_docs() {
  log "=== Document & Media Skills ==="
  install_skill "docx" "https://github.com/anthropics/skills.git" "skills/docx"
  install_skill "pptx" "https://github.com/anthropics/skills.git" "skills/pptx"
  install_skill "xlsx" "https://github.com/anthropics/skills.git" "skills/xlsx"
  install_skill "pdf" "https://github.com/anthropics/skills.git" "skills/pdf"
  install_skill "remotion" "https://github.com/remotion-dev/skills.git" "skills/remotion"
}

install_mobile() {
  log "=== Mobile Skills ==="
  install_skill "expo-design" "https://github.com/expo/skills.git" "plugins/expo-app-design"
  install_skill "expo-deployment" "https://github.com/expo/skills.git" "plugins/expo-deployment"
  install_skill "expo-upgrade" "https://github.com/expo/skills.git" "plugins/upgrading-expo"
  install_skill "rn-upgrade" "https://github.com/callstackincubator/agent-skills.git" "skills/upgrading-react-native"
}

install_context() {
  log "=== Context Engineering Skills ==="
  install_skill "context-fundamentals" "https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering.git" "skills/context-fundamentals"
  install_skill "context-compression" "https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering.git" "skills/context-compression"
  install_skill "multi-agent-patterns" "https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering.git" "skills/multi-agent-patterns"
  install_skill "memory-systems" "https://github.com/muratcankoylan/Agent-Skills-for-Context-Engineering.git" "skills/memory-systems"
  install_skill "ddd" "https://github.com/NeoLabHQ/context-engineering-kit.git" "plugins/ddd"
  install_skill "sdd" "https://github.com/NeoLabHQ/context-engineering-kit.git" "plugins/sdd"
  install_skill "recursive-decomposition" "https://github.com/massimodeluisa/recursive-decomposition-skill.git" "."
}

install_marketing() {
  log "=== Marketing Skills ==="
  install_skill "marketing-frameworks" "https://github.com/BrianRWagner/ai-marketing-skills.git" "."
  install_skill "seo" "https://github.com/AgriciDaniel/claude-seo.git" "."
  install_skill "typefully" "https://github.com/typefully/agent-skills.git" "skills/typefully"
  install_skill "humanizer" "https://github.com/blader/humanizer.git" "."
}

install_google() {
  log "=== Google Workspace Skills ==="
  local gws_repo="https://github.com/googleworkspace/cli.git"
  for skill in gws-gmail gws-calendar gws-drive gws-sheets gws-docs gws-slides gws-tasks gws-people gws-chat gws-forms gws-meet; do
    install_skill "$skill" "$gws_repo" "skills/$skill"
  done
}

list_categories() {
  echo "Available categories:"
  echo "  frontend    — React, Next.js, shadcn, design, testing"
  echo "  backend     — Stripe, databases, auth, CMS"
  echo "  cloud       — Cloudflare, Netlify, Terraform, AWS"
  echo "  security    — Trail of Bits, static analysis, contracts"
  echo "  testing     — TDD, debugging, code review, quality"
  echo "  ai-ml       — Hugging Face, Replicate, LLM evals"
  echo "  devops      — Git, GitHub, Sentry, MCP"
  echo "  docs        — Word, PPT, Excel, PDF, video"
  echo "  mobile      — Expo, React Native, Swift"
  echo "  context     — Context engineering, architecture"
  echo "  marketing   — SEO, email, social, writing"
  echo "  google      — Google Workspace (Gmail, Calendar, etc.)"
  echo ""
  echo "Usage:"
  echo "  ./install-skills.sh --all              Install everything"
  echo "  ./install-skills.sh --category frontend Install one category"
  echo "  ./install-skills.sh --list             Show categories"
}

main() {
  mkdir -p "$SKILLS_DIR"

  case "${1:---list}" in
    --all)
      install_frontend; install_backend; install_cloud; install_security
      install_testing; install_ai_ml; install_devops; install_docs
      install_mobile; install_context; install_marketing; install_google
      ;;
    --category)
      case "${2:-}" in
        frontend) install_frontend ;;
        backend) install_backend ;;
        cloud) install_cloud ;;
        security) install_security ;;
        testing) install_testing ;;
        ai-ml) install_ai_ml ;;
        devops) install_devops ;;
        docs) install_docs ;;
        mobile) install_mobile ;;
        context) install_context ;;
        marketing) install_marketing ;;
        google) install_google ;;
        *) err "Unknown category: ${2:-}"; list_categories; exit 1 ;;
      esac
      ;;
    --list) list_categories ;;
    *) list_categories ;;
  esac

  log "Done! Skills installed to $SKILLS_DIR/"
  echo ""
  echo "Skills will be auto-discovered by OpenCode on next session."
}

main "$@"
