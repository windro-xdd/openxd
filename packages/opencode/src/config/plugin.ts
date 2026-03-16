import path from "path"
import { createRequire } from "module"
import { pathToFileURL } from "url"

/**
 * Extracts a canonical plugin name from a plugin specifier.
 * - For file:// URLs: extracts filename without extension
 * - For npm packages: extracts package name without version
 */
export function getPluginName(plugin: string): string {
  if (plugin.startsWith("file://")) {
    return path.parse(new URL(plugin).pathname).name
  }
  const lastAt = plugin.lastIndexOf("@")
  if (lastAt > 0) {
    return plugin.substring(0, lastAt)
  }
  return plugin
}

/**
 * Deduplicates plugins by name, with later entries (higher priority) winning.
 * Since plugins are added in low-to-high priority order,
 * we reverse, deduplicate (keeping first occurrence), then restore order.
 */
export function deduplicatePlugins(plugins: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const specifier of plugins.toReversed()) {
    const name = getPluginName(specifier)
    if (seen.has(name)) continue
    seen.add(name)
    result.push(specifier)
  }

  return result.toReversed()
}

export async function resolvePlugins(plugins: string[], filepath: string): Promise<string[]> {
  return Promise.all(
    plugins.map(async (plugin) => {
      try {
        return import.meta.resolve!(plugin, filepath)
      } catch {
        try {
          const require = createRequire(filepath)
          const resolvedPath = require.resolve(plugin)
          return pathToFileURL(resolvedPath).href
        } catch {
          // plugin might be a generic string identifier like "mcp-server"
          return plugin
        }
      }
    }),
  )
}
