import type { AgentMemory } from "./memory"

export namespace MemoryFilter {
  /**
   * Extract domain context from messages and system prompts
   */
  export function extractDomain(
    system: string[],
    userMessage: string,
  ): string[] {
    const domains = new Set<string>()

    // Explicit domain keywords from user message
    const keywords = {
      software: ["code", "bug", "feature", "refactor", "api", "database", "deploy"],
      security: ["security", "vuln", "exploit", "hacking", "pen test", "wapt", "payload"],
      research: ["research", "investigate", "analyze", "compare", "study", "benchmark"],
      writing: ["write", "draft", "article", "documentation", "blog", "email", "report"],
      infrastructure: ["infra", "deploy", "devops", "docker", "kubernetes", "ci/cd"],
      web: ["web", "frontend", "react", "vue", "html", "css", "javascript"],
      mobile: ["mobile", "ios", "android", "react native", "flutter"],
      data: ["data", "sql", "database", "analytics", "csv", "json"],
    }

    const lowerMsg = userMessage.toLowerCase()
    for (const [domain, kws] of Object.entries(keywords)) {
      if (kws.some((kw) => lowerMsg.includes(kw))) {
        domains.add(domain)
      }
    }

    // Extract from system prompts (if they mention specific frameworks/tools)
    const sysText = system.join(" ").toLowerCase()
    if (sysText.includes("typescript") || sysText.includes("javascript"))
      domains.add("software")
    if (sysText.includes("security") || sysText.includes("vulnerability"))
      domains.add("security")
    if (sysText.includes("documentation")) domains.add("writing")

    return Array.from(domains)
  }

  /**
   * Score a skill based on relevance to current context
   */
  export function scoreSkill(
    skill: AgentMemory.Skill,
    domains: string[],
    recentSkillNames: Set<string>,
  ): number {
    let score = 0

    // Domain match: +100
    if (domains.includes(skill.domain)) score += 100

    // Recently used skills get a small boost: +5
    if (recentSkillNames.has(skill.name)) score += 5

    // More frequently used = more relevant: +1 per use (cap at 10)
    score += Math.min(skill.useCount, 10)

    // Very recent usage: +10
    const daysSinceUse = (Date.now() - skill.lastUsed) / (1000 * 60 * 60 * 24)
    if (daysSinceUse < 1) score += 10
    if (daysSinceUse < 7) score += 3

    return score
  }

  /**
   * Filter and rank skills for inclusion in system prompt
   */
  export function selectRelevant(
    allSkills: AgentMemory.Skill[],
    system: string[],
    userMessage: string,
    limit: number = 5,
  ): AgentMemory.Skill[] {
    if (allSkills.length === 0) return []

    const domains = extractDomain(system, userMessage)
    if (domains.length === 0) {
      // No domain detected, return top most recently used
      return allSkills
        .slice()
        .sort((a, b) => b.lastUsed - a.lastUsed)
        .slice(0, limit)
    }

    // Track recently used skills (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const recent = new Set(
      allSkills.filter((s) => s.lastUsed > weekAgo).map((s) => s.name),
    )

    // Score and sort
    const scored = allSkills.map((skill) => ({
      skill,
      score: scoreSkill(skill, domains, recent),
    }))

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.skill)
  }
}
