import type { NamedError } from "@opencode-ai/util/error"
import { MessageV2 } from "./message-v2"
import { iife } from "@/util/iife"

export namespace SessionRetry {
  export const RETRY_INITIAL_DELAY = 2000
  export const RETRY_BACKOFF_FACTOR = 2
  export const RETRY_MAX_DELAY_NO_HEADERS = 30_000 // 30 seconds
  export const RETRY_MAX_DELAY = 2_147_483_647 // max 32-bit signed integer for setTimeout

  function clamp(ms: number, max = RETRY_MAX_DELAY_NO_HEADERS) {
    if (!Number.isFinite(ms) || ms <= 0) return undefined
    return Math.min(Math.ceil(ms), max)
  }

  export async function sleep(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const abortHandler = () => {
        clearTimeout(timeout)
        reject(new DOMException("Aborted", "AbortError"))
      }
      const timeout = setTimeout(
        () => {
          signal.removeEventListener("abort", abortHandler)
          resolve()
        },
        Math.min(ms, RETRY_MAX_DELAY),
      )
      signal.addEventListener("abort", abortHandler, { once: true })
    })
  }

  export function delay(attempt: number, error?: MessageV2.APIError) {
    if (error) {
      const headers = error.data.responseHeaders
      if (headers) {
        const retryAfterMs = headers["retry-after-ms"]
        if (retryAfterMs) {
          const parsedMs = Number.parseFloat(retryAfterMs)
          const ms = clamp(parsedMs, RETRY_MAX_DELAY)
          if (ms) {
            return ms
          }
        }

        const retryAfter = headers["retry-after"]
        if (retryAfter) {
          const parsedSeconds = Number.parseFloat(retryAfter)
          const seconds = clamp(parsedSeconds * 1000, RETRY_MAX_DELAY)
          if (seconds) {
            return seconds
          }
          // Try parsing as HTTP date format
          const parsed = clamp(Date.parse(retryAfter) - Date.now(), RETRY_MAX_DELAY)
          if (parsed) {
            return parsed
          }
        }

        return RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1)
      }
    }

    return Math.min(RETRY_INITIAL_DELAY * Math.pow(RETRY_BACKOFF_FACTOR, attempt - 1), RETRY_MAX_DELAY_NO_HEADERS)
  }

  export function retryable(error: ReturnType<NamedError["toObject"]>) {
    // context overflow errors should not be retried
    if (MessageV2.ContextOverflowError.isInstance(error)) return undefined
    if (MessageV2.APIError.isInstance(error)) {
      if (!error.data.isRetryable) return undefined
      if (error.data.responseBody?.includes("FreeUsageLimitError"))
        return `Free usage exceeded, add credits https://openxd.ai/zen`
      return error.data.message.includes("Overloaded") ? "Provider is overloaded" : error.data.message
    }

    const json = iife(() => {
      try {
        if (typeof error.data?.message === "string") {
          const parsed = JSON.parse(error.data.message)
          return parsed
        }

        return JSON.parse(error.data.message)
      } catch {
        return undefined
      }
    })
    try {
      if (!json || typeof json !== "object") return undefined
      const code = typeof json.code === "string" ? json.code : ""

      if (json.type === "error" && json.error?.type === "too_many_requests") {
        return "Too Many Requests"
      }
      if (code.includes("exhausted") || code.includes("unavailable")) {
        return "Provider is overloaded"
      }
      if (json.type === "error" && json.error?.code?.includes("rate_limit")) {
        return "Rate Limited"
      }
      return JSON.stringify(json)
    } catch {
      return undefined
    }
  }

  /**
   * Returns true if the error is specifically a rate limit (429 / too_many_requests).
   * Used to decide whether to cycle to a fallback model instead of sleeping.
   */
  export function isRateLimit(error: ReturnType<NamedError["toObject"]>): boolean {
    if (MessageV2.APIError.isInstance(error)) {
      if (error.data.statusCode === 429) return true
      const msg = error.data.message?.toLowerCase() ?? ""
      if (msg.includes("rate limit") || msg.includes("too many requests")) return true
    }
    try {
      const json = typeof error.data?.message === "string" ? JSON.parse(error.data.message) : undefined
      if (!json) return false
      if (json.type === "error" && json.error?.type === "too_many_requests") return true
      if (json.type === "error" && json.error?.code?.includes("rate_limit")) return true
    } catch {}
    return false
  }

  /**
   * Returns true when provider says selected model is unavailable/unsupported.
   * Used to auto-cycle fallback models instead of hard-stopping the session.
   */
  export function isModelUnsupported(error: ReturnType<NamedError["toObject"]>): boolean {
    if (MessageV2.APIError.isInstance(error)) {
      const msg = error.data.message?.toLowerCase() ?? ""
      if (
        msg.includes("requested model is not supported") ||
        msg.includes("model is not supported") ||
        msg.includes("model not supported") ||
        msg.includes("model_not_found") ||
        msg.includes("unknown model") ||
        msg.includes("does not support model")
      ) {
        return true
      }
    }
    try {
      const json = typeof error.data?.message === "string" ? JSON.parse(error.data.message) : undefined
      if (!json) return false
      const code = typeof json.code === "string" ? json.code.toLowerCase() : ""
      const msg = typeof json.message === "string" ? json.message.toLowerCase() : ""
      if (
        code.includes("model_not_found") ||
        code.includes("unsupported_model") ||
        msg.includes("requested model is not supported") ||
        msg.includes("unknown model")
      ) {
        return true
      }
    } catch {}
    return false
  }
}
