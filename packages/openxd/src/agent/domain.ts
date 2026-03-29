// Domain detection and routing for OpenXD
// Automatically categorizes tasks by domain based on user input

export type Domain = 
  | "software"
  | "security" 
  | "research"
  | "writing"
  | "infrastructure"

export interface DomainMatch {
  domain: Domain
  confidence: number // 0-1 scale
  keywords: string[]
}

// Keywords that trigger each domain with priority weighting
const domainPatterns: Record<Domain, { keywords: RegExp; weight: number }[]> = {
  software: [
    { keywords: /\b(code|coding|debug|debugging|bug|feature|refactor|test|build|compile|lint|format)\b/gi, weight: 0.9 },
    { keywords: /\b(typescript|javascript|python|rust|go|java|c\+\+|typescript)\b/gi, weight: 0.8 },
    { keywords: /\b(function|class|interface|type|variable|const|let|var)\b/gi, weight: 0.7 },
    { keywords: /\b(api|endpoint|rest|graphql|database|schema|migration)\b/gi, weight: 0.85 },
    { keywords: /\b(architecture|design|pattern|refactor|optimize|performance)\b/gi, weight: 0.8 },
    { keywords: /\b(git|commit|branch|merge|pull request|rebase)\b/gi, weight: 0.75 },
    { keywords: /\b(deploy|deployment|docker|container|kubernetes|devops)\b/gi, weight: 0.85 },
  ],
  security: [
    { keywords: /\b(security|secure|hack|hacking|penetration|pentest|exploit|vulnerability|vuln|cve)\b/gi, weight: 0.95 },
    { keywords: /\b(breach|attack|xss|sql injection|csrf|authentication|encryption)\b/gi, weight: 0.9 },
    { keywords: /\b(bug bounty|vapt|owasp|firewall|ssl|tls|certificate)\b/gi, weight: 0.85 },
    { keywords: /\b(payload|reverse shell|privilege escalation|malware)\b/gi, weight: 0.9 },
    { keywords: /\b(security audit|risk assessment|threat model|compliance)\b/gi, weight: 0.8 },
  ],
  research: [
    { keywords: /\b(research|investigate|analysis|analyze|compare|benchmark|data|statistics)\b/gi, weight: 0.85 },
    { keywords: /\b(scrape|crawl|fetch|gather|collect|explore|discover|find|search)\b/gi, weight: 0.8 },
    { keywords: /\b(performance|metrics|measurement|profiling|monitoring)\b/gi, weight: 0.75 },
    { keywords: /\b(competitive|market|trend|insight|pattern)\b/gi, weight: 0.8 },
    { keywords: /\b(report|summary|findings|conclusion|evidence|data-driven)\b/gi, weight: 0.7 },
  ],
  writing: [
    { keywords: /\b(write|writing|document|documentation|content|blog|article|email|memo|letter)\b/gi, weight: 0.9 },
    { keywords: /\b(readme|guide|tutorial|book|report|proposal|specification)\b/gi, weight: 0.85 },
    { keywords: /\b(edit|editing|proofread|copyedit|revise|polish|improve)\b/gi, weight: 0.8 },
    { keywords: /\b(narrative|story|paragraph|section|chapter|outline)\b/gi, weight: 0.75 },
  ],
  infrastructure: [
    { keywords: /\b(infrastructure|devops|deploy|deployment|server|hosting|cloud)\b/gi, weight: 0.9 },
    { keywords: /\b(docker|kubernetes|container|orchestration|helm|terraform)\b/gi, weight: 0.85 },
    { keywords: /\b(database|sql|postgres|mongodb|redis|cache)\b/gi, weight: 0.8 },
    { keywords: /\b(monitoring|logging|metrics|prometheus|grafana|elk)\b/gi, weight: 0.8 },
    { keywords: /\b(ci\/cd|pipeline|github actions|jenkins|automation|workflow)\b/gi, weight: 0.85 },
    { keywords: /\b(network|firewall|load balancer|dns|cdn|ssl)\b/gi, weight: 0.8 },
  ],
}

/**
 * Detects the domain for a given user message
 * Returns the most likely domain based on keyword matching and weighting
 */
export function detectDomain(message: string): DomainMatch {
  const scores: Record<Domain, { score: number; keywords: string[] }> = {
    software: { score: 0, keywords: [] },
    security: { score: 0, keywords: [] },
    research: { score: 0, keywords: [] },
    writing: { score: 0, keywords: [] },
    infrastructure: { score: 0, keywords: [] },
  }

  // Score each domain based on keyword matches
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    for (const { keywords, weight } of patterns) {
      const matches = message.match(keywords)
      if (matches) {
        scores[domain as Domain].score += matches.length * weight
        scores[domain as Domain].keywords.push(...matches)
      }
    }
  }

  // Find domain with highest score
  let topDomain: Domain = "software" // default
  let topScore = 0

  for (const [domain, { score }] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score
      topDomain = domain as Domain
    }
  }

  // Calculate confidence (0-1 scale)
  // If top score is 0, confidence is 0 (pure default/guess)
  // Otherwise, scale based on score (increased threshold for better confidence)
  const confidence = topScore > 0 ? Math.min(topScore / 5, 1) : 0

  // Get unique keywords for this domain
  const keywords = [...new Set(scores[topDomain].keywords)].slice(0, 5)

  return {
    domain: topDomain,
    confidence,
    keywords,
  }
}

/**
 * Get domain context string for system prompt
 * Includes current domain detection and available tools
 */
export function getDomainContext(message: string): string {
  const match = detectDomain(message)
  
  const confidenceLevel = 
    match.confidence >= 0.8 ? "HIGH" :
    match.confidence >= 0.5 ? "MEDIUM" :
    "LOW (defaulting to software)"

  return `
## Domain Detection

Detected Domain: **${match.domain.toUpperCase()}**
Confidence: ${confidenceLevel} (${(match.confidence * 100).toFixed(0)}%)
Keywords: ${match.keywords.join(", ") || "none (default)"}

This domain classification affects which tools and practices you'll emphasize.
`.trim()
}

/**
 * Get domain-specific guidelines for the system prompt
 */
export function getDomainGuidelines(domain: Domain): string {
  const guidelines: Record<Domain, string> = {
    software: `
## Software Engineering Focus
- Use TypeScript strict mode, follow coding standards
- Prioritize clean architecture and testable code
- Consider performance, security, and maintainability
- Reference patterns and best practices
- Run type checking and tests before completing
`.trim(),
    security: `
## Security Research Focus
- Always prioritize safety and legal/ethical boundaries
- Explain security implications and risks clearly
- Suggest defensive strategies and mitigations
- Reference CVEs, OWASP, and security standards
- Include threat modeling and risk assessment
`.trim(),
    research: `
## Research & Analysis Focus
- Use web search for current data and trends
- Compare multiple sources objectively
- Present findings with evidence and citations
- Highlight confidence levels and uncertainties
- Structure findings clearly with key insights
`.trim(),
    writing: `
## Content & Writing Focus
- Tailor tone and style to audience
- Structure content logically and clearly
- Use examples and analogies where helpful
- Proofread and polish for clarity
- Include relevant formatting and emphasis
`.trim(),
    infrastructure: `
## Infrastructure & DevOps Focus
- Consider scalability, reliability, and security
- Use infrastructure-as-code principles
- Plan for monitoring and incident response
- Document deployment processes clearly
- Consider cost optimization and resource usage
`.trim(),
  }

  return guidelines[domain]
}
