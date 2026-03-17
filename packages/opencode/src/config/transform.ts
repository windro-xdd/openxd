import { mergeDeep } from "remeda"
import type { Config } from "./config"

export function mergeConfigConcatArrays(target: Config.Info, source: Config.Info): Config.Info {
  const merged = mergeDeep(target, source)
  if (target.plugin && source.plugin) {
    merged.plugin = Array.from(new Set([...target.plugin, ...source.plugin]))
  }
  if (target.instructions && source.instructions) {
    merged.instructions = Array.from(new Set([...target.instructions, ...source.instructions]))
  }
  return merged
}

export function migrateMode(config: Config.Info): Config.Info {
  let result = config
  for (const [name, mode] of Object.entries(config.mode ?? {})) {
    result = mergeDeep(result, {
      agent: {
        [name]: {
          ...mode,
          mode: "primary" as const,
        },
      },
    })
  }
  return result
}

export function migrateTools(config: Config.Info): Config.Info {
  if (!config.tools) return config
  const perms: Record<string, Config.PermissionAction> = {}
  for (const [tool, enabled] of Object.entries(config.tools)) {
    const action: Config.PermissionAction = enabled ? "allow" : "deny"
    if (tool === "write" || tool === "edit" || tool === "patch" || tool === "multiedit") {
      perms.edit = action
      continue
    }
    perms[tool] = action
  }
  return {
    ...config,
    permission: mergeDeep(perms, config.permission ?? {}),
  }
}

export function migrateShare(config: Config.Info): Config.Info {
  if (config.autoshare !== true || config.share) return config
  return {
    ...config,
    share: "auto",
  }
}

export function applyFlagOverrides(
  config: Config.Info,
  flags: {
    disableAutocompact: boolean
    disablePrune: boolean
  },
): Config.Info {
  let result = config
  if (flags.disableAutocompact) {
    result = {
      ...result,
      compaction: { ...result.compaction, auto: false },
    }
  }
  if (flags.disablePrune) {
    result = {
      ...result,
      compaction: { ...result.compaction, prune: false },
    }
  }
  return result
}
