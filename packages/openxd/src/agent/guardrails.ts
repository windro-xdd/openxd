// Guardrails for preventing agent chaos and loops
// Protects against infinite loops, duplicate operations, and resource exhaustion

import { Effect } from "effect"

export interface GuardrailState {
  toolCallHistory: ToolCall[]
  recentMessages: string[]
  messageHashMap: Map<string, number> // hash -> count
  lastExecutionTime: number
  consecutiveFailures: number
}

export interface ToolCall {
  name: string
  timestamp: number
  params?: string
}

/**
 * Create new guardrail state
 */
export function createState(): GuardrailState {
  return {
    toolCallHistory: [],
    recentMessages: [],
    messageHashMap: new Map(),
    lastExecutionTime: Date.now(),
    consecutiveFailures: 0,
  }
}

/**
 * Simple hash function for deduplication
 */
function hashMessage(msg: string): string {
  let hash = 0
  for (let i = 0; i < msg.length; i++) {
    const char = msg.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash.toString(36)
}

/**
 * Check if we're in a loop: same tool called multiple times in sequence
 */
export function detectToolLoop(state: GuardrailState, toolName: string): {
  isLoop: boolean
  count: number
  threshold: number
} {
  const threshold = 3
  const recent = state.toolCallHistory.slice(-threshold)
  const count = recent.filter((call) => call.name === toolName).length

  return {
    isLoop: count >= threshold,
    count,
    threshold,
  }
}

/**
 * Check if we're repeating the same message
 */
export function detectMessageDedup(state: GuardrailState, message: string): {
  isDuplicate: boolean
  count: number
  threshold: number
} {
  const threshold = 2 // Allow same message twice, warn on third
  const hash = hashMessage(message)
  const count = (state.messageHashMap.get(hash) ?? 0) + 1

  return {
    isDuplicate: count >= threshold,
    count,
    threshold,
  }
}

/**
 * Check if we're rate limiting - too many tool calls too fast
 */
export function detectRateLimitViolation(state: GuardrailState): {
  isViolation: boolean
  callsPerSecond: number
  threshold: number
} {
  const threshold = 50 // max 50 calls within a 5 second window
  const now = Date.now()

  // Count tool calls within last 5 seconds
  const recentCalls = state.toolCallHistory.filter(
    (call) => now - call.timestamp < 5000,
  ).length

  const isViolation = recentCalls > threshold

  const callsPerSecond = recentCalls / 5 // Average over 5 seconds

  return {
    isViolation,
    callsPerSecond: Math.round(callsPerSecond * 100) / 100,
    threshold,
  }
}

/**
 * Check context chain depth - prevent infinite nesting
 */
export function detectDeepNesting(depth: number): {
  isTooDeep: boolean
  depth: number
  threshold: number
} {
  const threshold = 15 // max nesting depth
  return {
    isTooDeep: depth > threshold,
    depth,
    threshold,
  }
}

/**
 * Record a tool call in guardrail state
 */
export function recordToolCall(
  state: GuardrailState,
  toolName: string,
  params?: Record<string, unknown>,
): void {
  state.toolCallHistory.push({
    name: toolName,
    timestamp: Date.now(),
    params: params ? JSON.stringify(params) : undefined,
  })

  // Keep only last 50 tool calls to avoid memory bloat
  if (state.toolCallHistory.length > 50) {
    state.toolCallHistory = state.toolCallHistory.slice(-50)
  }

  // Update last execution time
  state.lastExecutionTime = Date.now()
}

/**
 * Record a message for deduplication
 */
export function recordMessage(state: GuardrailState, message: string): void {
  const hash = hashMessage(message)
  const count = (state.messageHashMap.get(hash) ?? 0) + 1
  state.messageHashMap.set(hash, count)

  // Keep recent messages for context
  state.recentMessages.push(message)
  if (state.recentMessages.length > 10) {
    state.recentMessages = state.recentMessages.slice(-10)
  }
}

/**
 * Reset failure counter on success
 */
export function recordSuccess(state: GuardrailState): void {
  state.consecutiveFailures = 0
}

/**
 * Increment failure counter
 */
export function recordFailure(state: GuardrailState): void {
  state.consecutiveFailures++
}

/**
 * Get failure status
 */
export function getTooManyFailures(state: GuardrailState): {
  tooMany: boolean
  count: number
  threshold: number
} {
  const threshold = 5
  return {
    tooMany: state.consecutiveFailures >= threshold,
    count: state.consecutiveFailures,
    threshold,
  }
}

/**
 * Validate guardrails - return issues if any guardrail is triggered
 */
export function validate(
  state: GuardrailState,
  recentToolName?: string,
  recentMessage?: string,
  nestingDepth: number = 0,
): string[] {
  const issues: string[] = []

  // Check tool loop
  if (recentToolName) {
    const loop = detectToolLoop(state, recentToolName)
    if (loop.isLoop) {
      issues.push(
        `Tool loop detected: ${recentToolName} called ${loop.count} times in sequence`,
      )
    }
  }

  // Check message deduplication
  if (recentMessage) {
    const dedup = detectMessageDedup(state, recentMessage)
    if (dedup.isDuplicate) {
      issues.push(
        `Duplicate message detected: same message sent ${dedup.count} times (threshold: ${dedup.threshold})`,
      )
    }
  }

  // Check rate limiting
  const rateLim = detectRateLimitViolation(state)
  if (rateLim.isViolation) {
    issues.push(
      `Rate limit exceeded: ${rateLim.callsPerSecond} calls/sec (threshold: ${rateLim.threshold})`,
    )
  }

  // Check nesting depth
  const nesting = detectDeepNesting(nestingDepth)
  if (nesting.isTooDeep) {
    issues.push(
      `Context nesting too deep: ${nesting.depth} levels (threshold: ${nesting.threshold})`,
    )
  }

  // Check failures
  const failures = getTooManyFailures(state)
  if (failures.tooMany) {
    issues.push(
      `Too many consecutive failures: ${failures.count} (threshold: ${failures.threshold})`,
    )
  }

  return issues
}

/**
 * Format validation results for display
 */
export function formatValidation(issues: string[]): string {
  if (issues.length === 0) return ""
  return (
    `## Guardrail Warnings\n` +
    issues.map((issue) => `- ⚠️ ${issue}`).join("\n")
  )
}
