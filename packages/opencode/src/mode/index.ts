import z from "zod"
import { ModeTypes } from "./types"
import { BUILTIN_MODES } from "./builtin"
import { detectMode } from "./detector"
import { Config } from "../config/config"
import { Instance } from "../project/instance"
import { BusEvent } from "@/bus/bus-event"
import { Log } from "../util/log"

export namespace Mode {
  export type Info = ModeTypes.Info
  export type DetectionResult = ModeTypes.DetectionResult
  export const Info = ModeTypes.Info

  const log = Log.create({ service: "mode" })

  export const Event = {
    Activated: BusEvent.define(
      "mode.activated",
      z.object({
        sessionID: z.string(),
        mode: z.string(),
      }),
    ),
    Deactivated: BusEvent.define(
      "mode.deactivated",
      z.object({
        sessionID: z.string(),
        mode: z.string(),
      }),
    ),
  }

  /** All available modes: builtins merged with user config overrides */
  const modes = Instance.state(async () => {
    const cfg = await Config.get()
    const result = { ...BUILTIN_MODES }

    // User-defined modes from config override builtins
    for (const [name, userMode] of Object.entries((cfg as any).modes ?? {})) {
      const existing = result[name]
      if (existing) {
        result[name] = { ...existing, ...(userMode as any), name }
      } else {
        result[name] = { name, readOnly: false, loop: false, maxIterations: 50, ...(userMode as any) }
      }
    }

    return result
  })

  /** Active mode per session (in-memory, not persisted) */
  const activeModes = Instance.state(() => new Map<string, string>())

  /** Get a mode by name */
  export async function get(name: string): Promise<Info | undefined> {
    const m = await modes()
    return m[name]
  }

  /** List all available modes */
  export async function list(): Promise<Info[]> {
    const m = await modes()
    return Object.values(m)
  }

  /** Detect mode from user input text */
  export function detect(text: string): DetectionResult | undefined {
    return detectMode(text)
  }

  /** Set the active mode for a session */
  export function setActive(sessionID: string, modeName: string): void {
    activeModes().set(sessionID, modeName)
  }

  /** Get the active mode name for a session */
  export function getActive(sessionID: string): string | undefined {
    return activeModes().get(sessionID)
  }

  /** Clear the active mode for a session */
  export function clearActive(sessionID: string): void {
    activeModes().delete(sessionID)
  }

  /**
   * Resolve the permission overrides for a mode.
   * Returns tool permission entries that should be merged into the agent's permission set.
   */
  export function resolvePermissions(mode: Info): Array<{ permission: string; action: "allow" | "deny"; pattern: string }> {
    const permissions: Array<{ permission: string; action: "allow" | "deny"; pattern: string }> = []

    if (mode.readOnly) {
      // Deny all write operations
      permissions.push(
        { permission: "write", action: "deny", pattern: "*" },
        { permission: "edit", action: "deny", pattern: "*" },
        { permission: "multiedit", action: "deny", pattern: "*" },
        { permission: "patch", action: "deny", pattern: "*" },
        { permission: "notebook_edit", action: "deny", pattern: "*" },
      )
    }

    // Apply explicit tool overrides from mode config
    if (mode.tools) {
      for (const [tool, enabled] of Object.entries(mode.tools)) {
        permissions.push({
          permission: tool,
          action: enabled ? "allow" : "deny",
          pattern: "*",
        })
      }
    }

    return permissions
  }
}

export { detectMode } from "./detector"
export { BUILTIN_MODES } from "./builtin"
