import { Effect } from "effect"
import * as fs from "fs/promises"
import path from "path"
import z from "zod"

export namespace AgentMemory {
  const MEMORY_FILE = ".openxd/agent-memory.json"

  export const Skill = z.object({
    name: z.string().describe("Skill name or pattern"),
    domain: z.string().describe("Domain: software, security, research, writing, etc"),
    description: z.string().describe("What this skill is about"),
    lastUsed: z.number().describe("Timestamp when last applied"),
    useCount: z.number().describe("How many times applied"),
  })

  export type Skill = z.infer<typeof Skill>

  export const Memory = z.object({
    version: z.literal(1),
    createdAt: z.number(),
    skills: z.array(Skill),
  })

  export type Memory = z.infer<typeof Memory>

  const DEFAULT_MEMORY: Memory = {
    version: 1,
    createdAt: Date.now(),
    skills: [],
  }

  export async function load(): Promise<Memory> {
    try {
      const memPath = path.join(process.cwd(), MEMORY_FILE)
      const content = await fs.readFile(memPath, "utf-8")
      const parsed = JSON.parse(content)
      return Memory.parse(parsed)
    } catch {
      // Return a fresh copy, not a reference to the default
      return {
        version: 1,
        createdAt: Date.now(),
        skills: [],
      }
    }
  }

  export async function save(mem: Memory): Promise<void> {
    const memPath = path.join(process.cwd(), MEMORY_FILE)
    const dir = path.dirname(memPath)

    try {
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(memPath, JSON.stringify(mem, null, 2))
    } catch (err) {
      console.warn("Failed to save agent memory", err)
    }
  }

  export async function addSkill(skill: Skill): Promise<void> {
    const mem = await load()

    // Check if skill already exists
    const idx = mem.skills.findIndex((s) => s.name === skill.name)

    if (idx >= 0) {
      // Update existing
      mem.skills[idx] = {
        ...mem.skills[idx],
        ...skill,
        useCount: mem.skills[idx].useCount + 1,
        lastUsed: Date.now(),
      }
    } else {
      // Add new
      mem.skills.push({
        ...skill,
        useCount: 1,
        lastUsed: Date.now(),
      })
    }

    await save(mem)
  }

  export async function getSkillsByDomain(domain: string): Promise<Skill[]> {
    const mem = await load()
    return mem.skills.filter((s) => s.domain === domain)
  }

  export async function getAllSkills(): Promise<Skill[]> {
    const mem = await load()
    return mem.skills.sort((a, b) => b.lastUsed - a.lastUsed)
  }

  export async function clear(): Promise<void> {
    const empty: Memory = {
      version: 1,
      createdAt: Date.now(),
      skills: [],
    }
    await save(empty)
  }
}
