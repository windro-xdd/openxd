import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dir, "../../../.opencode/skills")
const req = ["## Purpose", "## When to Use", "## Constraints", "## Workflow", "## Output Format"]
const max = 220
const warn = [] as string[]

function walk(dir: string, files: string[] = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(p, files)
      continue
    }
    if (entry.name !== "SKILL.md") continue
    files.push(p)
  }
  return files
}

const out = walk(root).flatMap((file) => {
  const text = readFileSync(file, "utf8")
  const lines = text.split(/\r?\n/)
  const miss = req.filter((x) => !text.includes(x))
  const err = [] as string[]
  if (miss.length) err.push(`missing sections: ${miss.join(", ")}`)
  if (lines.length > max) err.push(`too long: ${lines.length} lines (max ${max})`)
  if (!text.includes("description:")) err.push("missing frontmatter description")
  if (!text.includes("triggers:")) warn.push(`${path.relative(process.cwd(), file)} -> missing frontmatter triggers`)
  return err.length ? [`${path.relative(process.cwd(), file)} -> ${err.join("; ")}`] : []
})

if (out.length) {
  console.error("Skill lint failed:\n" + out.join("\n"))
  process.exit(1)
}

if (warn.length) {
  console.warn("Skill lint warnings:\n" + warn.join("\n"))
}

console.log(`Skill lint passed (${walk(root).length} skills)`)
