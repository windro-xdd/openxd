import { describe, it, expect } from "bun:test"
import { detectDomain, getDomainContext, getDomainGuidelines } from "../../src/agent/domain"

describe("Domain Detection", () => {
  it("detects software domain from code keywords", () => {
    const result = detectDomain("I need to debug this TypeScript function and refactor the API endpoint")
    expect(result.domain).toBe("software")
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.keywords.length).toBeGreaterThan(0)
  })

  it("detects security domain from security keywords", () => {
    const result = detectDomain("Help me find vulnerabilities in this application through penetration testing")
    expect(result.domain).toBe("security")
    expect(result.confidence).toBeGreaterThan(0.1)
  })

  it("detects research domain from analysis keywords", () => {
    const result = detectDomain("Research and compare the top 5 frameworks in the market")
    expect(result.domain).toBe("research")
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it("detects writing domain from content keywords", () => {
    const result = detectDomain("Write documentation for this API and create a README")
    expect(result.domain).toBe("writing")
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it("detects infrastructure domain from devops keywords", () => {
    const result = detectDomain("Set up Docker containers and deploy with Kubernetes")
    expect(result.domain).toBe("infrastructure")
    expect(result.confidence).toBeGreaterThan(0.3)
  })

  it("defaults to software when domain is unclear", () => {
    const result = detectDomain("Help me with something general")
    expect(result.domain).toBe("software")
  })

  it("includes detected keywords in result", () => {
    const result = detectDomain("Fix the bug in my code and optimize performance")
    expect(result.keywords).toContain("bug")
    expect(result.keywords.length).toBeGreaterThan(0)
  })

  it("handles case-insensitive matching", () => {
    const result1 = detectDomain("DEBUG this function")
    const result2 = detectDomain("debug this function")
    expect(result1.domain).toBe(result2.domain)
  })

  it("prioritizes high-confidence keywords", () => {
    const softResult = detectDomain("I need to code a new feature")
    const secResult = detectDomain("I found a security vulnerability")
    
    // Both should have some confidence
    expect(secResult.confidence).toBeGreaterThan(0.2)
    expect(softResult.confidence).toBeGreaterThan(0.2)
  })

  it("getDomainContext returns formatted output", () => {
    const context = getDomainContext("Fix this bug in TypeScript")
    expect(context).toContain("Domain Detection")
    expect(context).toContain("Detected Domain")
    expect(context).toContain("Confidence")
  })

  it("getDomainGuidelines returns domain-specific guidance", () => {
    const softGuide = getDomainGuidelines("software")
    expect(softGuide).toContain("TypeScript")
    
    const secGuide = getDomainGuidelines("security")
    expect(secGuide).toContain("OWASP")
    
    const researchGuide = getDomainGuidelines("research")
    expect(researchGuide).toContain("web search")
  })
})
