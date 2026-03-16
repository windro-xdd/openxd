import z from "zod"
import { Tool } from "./tool"
import path from "path"
import DESCRIPTION from "./deps.txt"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"
import { assertExternalDirectory } from "./external-directory"
import { glob } from "glob"

// Regex to match import statements
const IMPORT_REGEX = /(?:^|\n)import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"]([^'"]+)['"]/g
const EXPORT_FROM_REGEX = /(?:^|\n)export\s+(?:[\w*{}\s,]+)\s+from\s+['"]([^'"]+)['"]/g
const REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

function isRelative(p: string): boolean {
  return p.startsWith("./") || p.startsWith("../")
}

function isPackage(p: string): boolean {
  return !isRelative(p) && !path.isAbsolute(p)
}

async function extractImports(file: string): Promise<{ relative: string[]; packages: string[] }> {
  const content = await Bun.file(file).text()
  const relative: string[] = []
  const packages: string[] = []

  const patterns = [IMPORT_REGEX, EXPORT_FROM_REGEX, REQUIRE_REGEX]
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const spec = match[1]
      if (isPackage(spec)) {
        // Extract package name (handle scoped packages)
        const pkg = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
        if (!packages.includes(pkg)) packages.push(pkg)
      } else if (isRelative(spec)) {
        relative.push(spec)
      }
    }
  }

  return { relative, packages }
}

async function resolveImport(from: string, spec: string): Promise<string | null> {
  const dir = path.dirname(from)
  const base = path.resolve(dir, spec)

  // Try exact match
  if (await Filesystem.exists(base)) {
    const stat = await Bun.file(base).stat()
    if (stat && stat.isFile()) return base
  }

  // Try with extensions
  for (const ext of [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]) {
    const p = base + ext
    if (await Filesystem.exists(p)) return p
  }

  // Try index files
  for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
    const p = path.join(base, `index${ext}`)
    if (await Filesystem.exists(p)) return p
  }

  return null
}

async function findImporters(target: string, searchDir: string): Promise<string[]> {
  const files = await glob("**/*.{ts,tsx,js,jsx,mjs,cjs}", {
    cwd: searchDir,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**"],
  })

  const importers: string[] = []

  for (const file of files) {
    if (file === target) continue

    const { relative } = await extractImports(file)
    for (const spec of relative) {
      const resolved = await resolveImport(file, spec)
      if (resolved === target) {
        importers.push(file)
        break
      }
    }
  }

  return importers
}

export const DepsTool = Tool.define("deps", {
  description: DESCRIPTION,
  parameters: z.object({
    action: z.enum(["imports", "imported_by", "graph"]).describe("The action to perform"),
    path: z.string().describe("File path to analyze"),
    depth: z.number().int().min(1).max(3).optional().describe("Traversal depth (default: 1, max: 3)"),
  }),
  execute: async (args, ctx) => {
    const file = path.isAbsolute(args.path) ? args.path : path.join(Instance.directory, args.path)
    await assertExternalDirectory(ctx, file)

    const exists = await Filesystem.exists(file)
    if (!exists) {
      throw new Error(`File not found: ${file}`)
    }

    await ctx.ask({
      permission: "read",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const rel = path.relative(Instance.worktree, file)
    const depth = args.depth ?? 1
    const lines: string[] = []

    if (args.action === "imports" || args.action === "graph") {
      const { relative, packages } = await extractImports(file)

      lines.push(`Imports (${rel}):`)

      if (relative.length > 0) {
        lines.push("\n  Local:")
        for (const spec of relative) {
          const resolved = await resolveImport(file, spec)
          if (resolved) {
            lines.push(`    ${spec} → ${path.relative(Instance.worktree, resolved)}`)
          } else {
            lines.push(`    ${spec} (unresolved)`)
          }
        }
      }

      if (packages.length > 0) {
        lines.push("\n  Packages:")
        for (const pkg of packages) {
          lines.push(`    ${pkg}`)
        }
      }

      if (relative.length === 0 && packages.length === 0) {
        lines.push("  (none)")
      }
    }

    if (args.action === "imported_by" || args.action === "graph") {
      if (args.action === "graph") lines.push("")

      const importers = await findImporters(file, Instance.worktree)

      lines.push(`Imported by (${rel}):`)
      if (importers.length > 0) {
        for (const imp of importers.slice(0, 50)) {
          lines.push(`  ← ${path.relative(Instance.worktree, imp)}`)
        }
        if (importers.length > 50) {
          lines.push(`  ... and ${importers.length - 50} more`)
        }
      } else {
        lines.push("  (none)")
      }
    }

    return {
      title: `deps ${args.action} ${rel}`,
      output: lines.join("\n"),
      metadata: { action: args.action, file: rel, depth },
    }
  },
})
