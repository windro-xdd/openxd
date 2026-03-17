function record(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x)
}

export const CONFIG_FILES = ["opencode.jsonc", "opencode.json"] as const

export function normalizeWellKnownUrl(url: string) {
  return url.replace(/\/+$/, "")
}

export function wellKnownSource(url: string) {
  return `${url}/.well-known/opencode`
}

export function parseWellKnownConfig(payload: unknown) {
  if (!record(payload)) return {}
  if (!record(payload.config)) return {}
  return payload.config
}

export async function mergeFiles<T>(
  seed: T,
  files: string[],
  read: (file: string) => Promise<T>,
  merge: (target: T, source: T) => T,
) {
  let result = seed
  for (const file of files) {
    result = merge(result, await read(file))
  }
  return result
}
