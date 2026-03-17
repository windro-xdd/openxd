export namespace Token {
  const CHARS_PER_TOKEN = 4

  export function estimate(input: string) {
    return Math.max(0, Math.round((input || "").length / CHARS_PER_TOKEN))
  }

  /**
   * Estimate tokens for a base64 data URL (image/PDF).
   * Images are ~1 token per 750 bytes of raw image data for vision models,
   * but the base64 encoding inflates the actual payload sent.
   * We estimate based on the data URL length since that's what goes over the wire.
   */
  export function estimateDataUrl(dataUrl: string): number {
    if (!dataUrl) return 0
    // Most providers count image tokens based on resolution, not raw bytes.
    // But for context budget purposes, the base64 data URL still contributes
    // to the HTTP payload size. A 1MB image ≈ 1.33MB base64 ≈ 330K chars ≈ 85K tokens.
    // Use a conservative estimate: base64 chars / 4 (same as text).
    return estimate(dataUrl)
  }
}
