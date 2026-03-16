import z from "zod"
import { Tool } from "./tool"
import path from "path"
import DESCRIPTION from "./batch_edit.txt"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"
import { assertExternalDirectory } from "./external-directory"

export const BatchEditTool = Tool.define("batch_edit", {
  description: DESCRIPTION,
  parameters: z.object({
    files: z.array(z.string()).min(1).describe("Array of file paths to edit"),
    oldString: z.string().min(1).describe("The exact string to find and replace"),
    newString: z.string().describe("The replacement string"),
    replaceAll: z.boolean().optional().describe("Replace all occurrences in each file (default: false)"),
  }),
  execute: async (args, ctx) => {
    const results: {
      file: string
      status: "modified" | "skipped" | "not_found" | "error"
      matches?: number
      error?: string
    }[] = []

    // Resolve all paths
    const files = args.files.map((f) => (path.isAbsolute(f) ? f : path.join(Instance.directory, f)))

    // Validate oldString !== newString
    if (args.oldString === args.newString) {
      throw new Error("oldString and newString cannot be the same")
    }

    // Check permissions for all files first
    for (const file of files) {
      await assertExternalDirectory(ctx, file)
    }

    await ctx.ask({
      permission: "edit",
      patterns: files.map((f) => path.relative(Instance.worktree, f)),
      always: ["*"],
      metadata: { replaceAll: args.replaceAll ?? false },
    })

    // Process each file
    for (const file of files) {
      const rel = path.relative(Instance.worktree, file)

      // Check existence
      const exists = await Filesystem.exists(file)
      if (!exists) {
        results.push({ file: rel, status: "not_found" })
        continue
      }

      try {
        const content = await Bun.file(file).text()

        // Count occurrences
        const matches = content.split(args.oldString).length - 1
        if (matches === 0) {
          results.push({ file: rel, status: "skipped", matches: 0 })
          continue
        }

        // Check for multiple matches when replaceAll is false
        if (!args.replaceAll && matches > 1) {
          results.push({
            file: rel,
            status: "error",
            matches,
            error: `Found ${matches} matches but replaceAll=false. Set replaceAll=true to replace all.`,
          })
          continue
        }

        // Perform replacement
        const newContent = args.replaceAll
          ? content.replaceAll(args.oldString, args.newString)
          : content.replace(args.oldString, args.newString)

        await Bun.write(file, newContent)
        results.push({ file: rel, status: "modified", matches: args.replaceAll ? matches : 1 })
      } catch (err) {
        results.push({ file: rel, status: "error", error: err instanceof Error ? err.message : String(err) })
      }
    }

    const modified = results.filter((r) => r.status === "modified")
    const skipped = results.filter((r) => r.status === "skipped")
    const errors = results.filter((r) => r.status === "error" || r.status === "not_found")

    const lines: string[] = []

    if (modified.length > 0) {
      lines.push(`Modified (${modified.length}):`)
      for (const r of modified) {
        lines.push(`  ✓ ${r.file} (${r.matches} ${r.matches === 1 ? "match" : "matches"})`)
      }
    }

    if (skipped.length > 0) {
      lines.push(`\nSkipped (${skipped.length}):`)
      for (const r of skipped) {
        lines.push(`  - ${r.file} (no matches)`)
      }
    }

    if (errors.length > 0) {
      lines.push(`\nErrors (${errors.length}):`)
      for (const r of errors) {
        lines.push(`  ✗ ${r.file}: ${r.error ?? r.status}`)
      }
    }

    const totalMatches = modified.reduce((sum, r) => sum + (r.matches ?? 0), 0)

    return {
      title: `batch_edit: ${modified.length}/${files.length} files, ${totalMatches} replacements`,
      output: lines.join("\n"),
      metadata: {
        modified: modified.length,
        skipped: skipped.length,
        errors: errors.length,
        total: files.length,
        replacements: totalMatches,
        results,
      },
    }
  },
})
