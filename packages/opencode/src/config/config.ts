import { Log } from "../util/log"
import path from "path"
import { pathToFileURL } from "url"
import os from "os"
import z from "zod"
import { mergeDeep, unique } from "remeda"
import { Global } from "../global"
import fs from "fs/promises"
import { lazy } from "../util/lazy"
import { NamedError } from "@opencode-ai/util/error"
import { Flag } from "../flag/flag"
import { Auth } from "../auth"
import { Env } from "../env"
import { Instance } from "../project/instance"
import { LSPServer } from "../lsp/server"
import { BunProc } from "@/bun"
import { Installation } from "@/installation"
import { ConfigMarkdown } from "./markdown"
import { constants, existsSync } from "fs"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import { Event } from "../server/event"
import { Glob } from "../util/glob"
import { PackageRegistry } from "@/bun/registry"
import { proxied } from "@/util/proxied"
import { iife } from "@/util/iife"
import { Account } from "@/account"
import { ConfigPaths } from "./paths"
import { Filesystem } from "@/util/filesystem"
import { deduplicatePlugins as dedupePluginSpecifiers, getPluginName as pluginName, resolvePlugins } from "./plugin"
import { CONFIG_FILES, mergeFiles, normalizeWellKnownUrl, parseWellKnownConfig, wellKnownSource } from "./source"
import { applyFlagOverrides, mergeConfigConcatArrays, migrateMode, migrateShare, migrateTools } from "./transform"
import {
  globalConfigFile as resolveGlobalConfigFile,
  parseConfig as parseConfigText,
  patchJsonc as patchJsoncText,
} from "./update"

// Schema modules (extracted for maintainability)
import {
  McpLocal as McpLocalSchema,
  McpOAuth as McpOAuthSchema,
  McpRemote as McpRemoteSchema,
  Mcp as McpSchema,
  PermissionAction as PermissionActionSchema,
  PermissionObject as PermissionObjectSchema,
  PermissionRule as PermissionRuleSchema,
  Permission as PermissionSchema,
  Agent as AgentSchema,
  Command as CommandSchema,
  Skills as SkillsSchema,
  Provider as ProviderSchema,
  Keybinds as KeybindsSchema,
  Server as ServerSchema,
  Layout as LayoutSchema,
} from "./schema"

export namespace Config {
  const log = Log.create({ service: "config" })

  // Managed settings directory for enterprise deployments (highest priority, admin-controlled)
  // These settings override all user and project settings
  function systemManagedConfigDir(): string {
    switch (process.platform) {
      case "darwin":
        return "/Library/Application Support/opencode"
      case "win32":
        return path.join(process.env.ProgramData || "C:\\ProgramData", "openxd")
      default:
        return "/etc/opencode"
    }
  }

  export function managedConfigDir() {
    return process.env.OPENCODE_TEST_MANAGED_CONFIG_DIR || systemManagedConfigDir()
  }

  const managedDir = managedConfigDir()

  export const McpLocal = McpLocalSchema
  export const McpOAuth = McpOAuthSchema
  export const McpRemote = McpRemoteSchema
  export const Mcp = McpSchema
  export const PermissionAction = PermissionActionSchema
  export const PermissionObject = PermissionObjectSchema
  export const PermissionRule = PermissionRuleSchema
  export const Permission = PermissionSchema
  export const Agent = AgentSchema
  export const Command = CommandSchema
  export const Skills = SkillsSchema
  export const Provider = ProviderSchema
  export const Keybinds = KeybindsSchema
  export const Server = ServerSchema
  export const Layout = LayoutSchema

  export type McpOAuth = z.infer<typeof McpOAuth>
  export type Mcp = z.infer<typeof Mcp>
  export type PermissionAction = z.infer<typeof PermissionAction>
  export type PermissionObject = z.infer<typeof PermissionObject>
  export type PermissionRule = z.infer<typeof PermissionRule>
  export type Permission = z.infer<typeof Permission>
  export type Agent = z.infer<typeof Agent>
  export type Command = z.infer<typeof Command>
  export type Skills = z.infer<typeof Skills>
  export type Provider = z.infer<typeof Provider>
  export type Layout = z.infer<typeof Layout>

  export function getPluginName(plugin: string): string {
    return pluginName(plugin)
  }

  export function deduplicatePlugins(plugins: string[]): string[] {
    return dedupePluginSpecifiers(plugins)
  }

  export const state = Instance.state(async () => {
    const auth = await Auth.all()

    // Config loading order (low -> high precedence): https://openxd.ai/docs/config#precedence-order
    // 1) Remote .well-known/opencode (org defaults)
    // 2) Global config (~/.config/opencode/openxd.json{,c})
    // 3) Custom config (OPENCODE_CONFIG)
    // 4) Project config (openxd.json{,c})
    // 5) .opencode directories (.openxd/agents/, .openxd/commands/, .openxd/plugins/, .openxd/openxd.json{,c})
    // 6) Inline config (OPENCODE_CONFIG_CONTENT)
    // Managed config directory is enterprise-only and always overrides everything above.
    let result: Info = {}
    for (const [key, value] of Object.entries(auth)) {
      if (value.type === "wellknown") {
        const url = normalizeWellKnownUrl(key)
        const source = wellKnownSource(url)
        process.env[value.key] = value.token
        log.debug("fetching remote config", { url: source })
        const response = await fetch(source)
        if (!response.ok) {
          throw new Error(`failed to fetch remote config from ${url}: ${response.status}`)
        }
        const remoteConfig = parseWellKnownConfig(await response.json())
        // Add $schema to prevent load() from trying to write back to a non-existent file
        if (!remoteConfig.$schema) remoteConfig.$schema = "https://openxd.ai/config.json"
        result = mergeConfigConcatArrays(
          result,
          await load(JSON.stringify(remoteConfig), {
            dir: path.dirname(source),
            source,
          }),
        )
        log.debug("loaded remote config from well-known", { url })
      }
    }

    // Global user config overrides remote config.
    result = mergeConfigConcatArrays(result, await global())

    // Custom config path overrides global config.
    if (Flag.OPENCODE_CONFIG) {
      result = mergeConfigConcatArrays(result, await loadFile(Flag.OPENCODE_CONFIG))
      log.debug("loaded custom config", { path: Flag.OPENCODE_CONFIG })
    }

    // Project config overrides global and remote config.
    if (!Flag.OPENCODE_DISABLE_PROJECT_CONFIG) {
      for (const file of await ConfigPaths.projectFiles("openxd", Instance.directory, Instance.worktree)) {
        result = mergeConfigConcatArrays(result, await loadFile(file))
      }
    }

    result.agent = result.agent || {}
    result.mode = result.mode || {}
    result.plugin = result.plugin || []

    const directories = await ConfigPaths.directories(Instance.directory, Instance.worktree)

    // .opencode directory config overrides (project and global) config sources.
    if (Flag.OPENCODE_CONFIG_DIR) {
      log.debug("loading config from OPENCODE_CONFIG_DIR", { path: Flag.OPENCODE_CONFIG_DIR })
    }

    const deps = []

    for (const dir of unique(directories)) {
      if (dir.endsWith(".opencode") || dir === Flag.OPENCODE_CONFIG_DIR) {
        for (const file of ["openxd.jsonc", "openxd.json"]) {
          log.debug(`loading config from ${path.join(dir, file)}`)
          result = mergeConfigConcatArrays(result, await loadFile(path.join(dir, file)))
          // to satisfy the type checker
          result.agent ??= {}
          result.mode ??= {}
          result.plugin ??= []
        }
      }

      deps.push(
        iife(async () => {
          const shouldInstall = await needsInstall(dir)
          if (shouldInstall) await installDependencies(dir)
        }),
      )

      result.command = mergeDeep(result.command ?? {}, await loadCommand(dir))
      result.agent = mergeDeep(result.agent, await loadAgent(dir))
      result.agent = mergeDeep(result.agent, await loadMode(dir))
      result.plugin.push(...(await loadPlugin(dir)))
    }

    // Inline config content overrides all non-managed config sources.
    if (process.env.OPENCODE_CONFIG_CONTENT) {
      result = mergeConfigConcatArrays(
        result,
        await load(process.env.OPENCODE_CONFIG_CONTENT, {
          dir: Instance.directory,
          source: "OPENCODE_CONFIG_CONTENT",
        }),
      )
      log.debug("loaded custom config from OPENCODE_CONFIG_CONTENT")
    }

    const active = Account.active()
    if (active?.active_org_id) {
      try {
        const [config, token] = await Promise.all([
          Account.config(active.id, active.active_org_id),
          Account.token(active.id),
        ])
        if (token) {
          process.env["OPENCODE_CONSOLE_TOKEN"] = token
          Env.set("OPENCODE_CONSOLE_TOKEN", token)
        }

        if (config) {
          result = mergeConfigConcatArrays(
            result,
            await load(JSON.stringify(config), {
              dir: path.dirname(`${active.url}/api/config`),
              source: `${active.url}/api/config`,
            }),
          )
        }
      } catch (err: any) {
        log.debug("failed to fetch remote account config", { error: err?.message ?? err })
      }
    }

    // Load managed config files last (highest priority) - enterprise admin-controlled
    // Kept separate from directories array to avoid write operations when installing plugins
    // which would fail on system directories requiring elevated permissions
    // This way it only loads config file and not skills/plugins/commands
    if (existsSync(managedDir)) {
      for (const file of CONFIG_FILES) {
        result = mergeConfigConcatArrays(result, await loadFile(path.join(managedDir, file)))
      }
    }

    // Migrate deprecated mode field to agent field
    result = migrateMode(result)

    if (Flag.OPENCODE_PERMISSION) {
      result.permission = mergeDeep(result.permission ?? {}, JSON.parse(Flag.OPENCODE_PERMISSION))
    }

    result = migrateTools(result)

    if (!result.username) result.username = os.userInfo().username

    // Handle migration from autoshare to share field
    result = migrateShare(result)

    // Apply flag overrides for compaction settings
    result = applyFlagOverrides(result, {
      disableAutocompact: Flag.OPENCODE_DISABLE_AUTOCOMPACT,
      disablePrune: Flag.OPENCODE_DISABLE_PRUNE,
    })

    result.plugin = deduplicatePlugins(result.plugin ?? [])

    return {
      config: result,
      directories,
      deps,
    }
  })

  export async function waitForDependencies() {
    const deps = await state().then((x) => x.deps)
    await Promise.all(deps)
  }

  export async function installDependencies(dir: string) {
    const pkg = path.join(dir, "package.json")
    const targetVersion = Installation.isLocal() ? "*" : Installation.VERSION

    const json = await Filesystem.readJson<{ dependencies?: Record<string, string> }>(pkg).catch(() => ({
      dependencies: {},
    }))
    json.dependencies = {
      ...json.dependencies,
      "@opencode-ai/plugin": targetVersion,
    }
    await Filesystem.writeJson(pkg, json)

    const gitignore = path.join(dir, ".gitignore")
    const hasGitIgnore = await Filesystem.exists(gitignore)
    if (!hasGitIgnore)
      await Filesystem.write(gitignore, ["node_modules", "package.json", "bun.lock", ".gitignore"].join("\n"))

    // Install any additional dependencies defined in the package.json
    // This allows local plugins and custom tools to use external packages
    await BunProc.run(
      [
        "install",
        // TODO: get rid of this case (see: https://github.com/oven-sh/bun/issues/19936)
        ...(proxied() || process.env.CI ? ["--no-cache"] : []),
      ],
      { cwd: dir },
    ).catch((err) => {
      log.warn("failed to install dependencies", { dir, error: err })
    })
  }

  async function isWritable(dir: string) {
    try {
      await fs.access(dir, constants.W_OK)
      return true
    } catch {
      return false
    }
  }

  export async function needsInstall(dir: string) {
    // Some config dirs may be read-only.
    // Installing deps there will fail; skip installation in that case.
    const writable = await isWritable(dir)
    if (!writable) {
      log.debug("config dir is not writable, skipping dependency install", { dir })
      return false
    }

    const nodeModules = path.join(dir, "node_modules")
    if (!existsSync(nodeModules)) return true

    const pkg = path.join(dir, "package.json")
    const pkgExists = await Filesystem.exists(pkg)
    if (!pkgExists) return true

    const parsed = await Filesystem.readJson<{ dependencies?: Record<string, string> }>(pkg).catch(() => null)
    const dependencies = parsed?.dependencies ?? {}
    const depVersion = dependencies["@opencode-ai/plugin"]
    if (!depVersion) return true

    const targetVersion = Installation.isLocal() ? "latest" : Installation.VERSION
    if (targetVersion === "latest") {
      const isOutdated = await PackageRegistry.isOutdated("@opencode-ai/plugin", depVersion, dir)
      if (!isOutdated) return false
      log.info("Cached version is outdated, proceeding with install", {
        pkg: "@opencode-ai/plugin",
        cachedVersion: depVersion,
      })
      return true
    }
    if (depVersion === targetVersion) return false
    return true
  }

  function rel(item: string, patterns: string[]) {
    const normalizedItem = item.replaceAll("\\", "/")
    for (const pattern of patterns) {
      const index = normalizedItem.indexOf(pattern)
      if (index === -1) continue
      return normalizedItem.slice(index + pattern.length)
    }
  }

  function trim(file: string) {
    const ext = path.extname(file)
    return ext.length ? file.slice(0, -ext.length) : file
  }

  async function loadCommand(dir: string) {
    const result: Record<string, Command> = {}
    for (const item of await Glob.scan("{command,commands}/**/*.md", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      const md = await ConfigMarkdown.parse(item).catch(async (err) => {
        const message = ConfigMarkdown.FrontmatterError.isInstance(err)
          ? err.data.message
          : `Failed to parse command ${item}`
        const { Session } = await import("@/session")
        Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to load command", { command: item, err })
        return undefined
      })
      if (!md) continue

      const patterns = ["/.openxd/command/", "/.openxd/commands/", "/command/", "/commands/"]
      const file = rel(item, patterns) ?? path.basename(item)
      const name = trim(file)

      const config = {
        name,
        ...md.data,
        template: md.content.trim(),
      }
      const parsed = Command.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item, issues: parsed.error.issues }, { cause: parsed.error })
    }
    return result
  }

  async function loadAgent(dir: string) {
    const result: Record<string, Agent> = {}

    for (const item of await Glob.scan("{agent,agents}/**/*.md", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      const md = await ConfigMarkdown.parse(item).catch(async (err) => {
        const message = ConfigMarkdown.FrontmatterError.isInstance(err)
          ? err.data.message
          : `Failed to parse agent ${item}`
        const { Session } = await import("@/session")
        Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to load agent", { agent: item, err })
        return undefined
      })
      if (!md) continue

      const patterns = ["/.openxd/agent/", "/.openxd/agents/", "/agent/", "/agents/"]
      const file = rel(item, patterns) ?? path.basename(item)
      const agentName = trim(file)

      const config = {
        name: agentName,
        ...md.data,
        prompt: md.content.trim(),
      }
      const parsed = Agent.safeParse(config)
      if (parsed.success) {
        result[config.name] = parsed.data
        continue
      }
      throw new InvalidError({ path: item, issues: parsed.error.issues }, { cause: parsed.error })
    }
    return result
  }

  async function loadMode(dir: string) {
    const result: Record<string, Agent> = {}
    for (const item of await Glob.scan("{mode,modes}/*.md", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      const md = await ConfigMarkdown.parse(item).catch(async (err) => {
        const message = ConfigMarkdown.FrontmatterError.isInstance(err)
          ? err.data.message
          : `Failed to parse mode ${item}`
        const { Session } = await import("@/session")
        Bus.publish(Session.Event.Error, { error: new NamedError.Unknown({ message }).toObject() })
        log.error("failed to load mode", { mode: item, err })
        return undefined
      })
      if (!md) continue

      const config = {
        name: path.basename(item, ".md"),
        ...md.data,
        prompt: md.content.trim(),
      }
      const parsed = Agent.safeParse(config)
      if (parsed.success) {
        result[config.name] = {
          ...parsed.data,
          mode: "primary" as const,
        }
        continue
      }
    }
    return result
  }

  async function loadPlugin(dir: string) {
    const plugins: string[] = []

    for (const item of await Glob.scan("{plugin,plugins}/*.{ts,js}", {
      cwd: dir,
      absolute: true,
      dot: true,
      symlink: true,
    })) {
      plugins.push(pathToFileURL(item).href)
    }
    return plugins
  }

  export const Info = z
    .object({
      $schema: z.string().optional().describe("JSON schema reference for configuration validation"),
      logLevel: Log.Level.optional().describe("Log level"),
      server: Server.optional().describe("Server configuration for opencode serve and web commands"),
      command: z
        .record(z.string(), Command)
        .optional()
        .describe("Command configuration, see https://openxd.ai/docs/commands"),
      skills: Skills.optional().describe("Additional skill folder paths"),
      watcher: z
        .object({
          ignore: z.array(z.string()).optional(),
        })
        .optional(),
      plugin: z.string().array().optional(),
      snapshot: z.boolean().optional(),
      share: z
        .enum(["manual", "auto", "disabled"])
        .optional()
        .describe(
          "Control sharing behavior:'manual' allows manual sharing via commands, 'auto' enables automatic sharing, 'disabled' disables all sharing",
        ),
      autoshare: z
        .boolean()
        .optional()
        .describe("@deprecated Use 'share' field instead. Share newly created sessions automatically"),
      autoupdate: z
        .union([z.boolean(), z.literal("notify")])
        .optional()
        .describe(
          "Automatically update to the latest version. Set to true to auto-update, false to disable, or 'notify' to show update notifications",
        ),
      disabled_providers: z.array(z.string()).optional().describe("Disable providers that are loaded automatically"),
      enabled_providers: z
        .array(z.string())
        .optional()
        .describe("When set, ONLY these providers will be enabled. All other providers will be ignored"),
      model: z
        .string()
        .meta({ $ref: "https://models.dev/model-schema.json#/$defs/Model" })
        .describe("Model to use in the format of provider/model, eg anthropic/claude-2")
        .optional(),
      small_model: z
        .string()
        .meta({ $ref: "https://models.dev/model-schema.json#/$defs/Model" })
        .describe("Small model to use for tasks like title generation in the format of provider/model")
        .optional(),
      default_agent: z
        .string()
        .optional()
        .describe(
          "Default agent to use when none is specified. Must be a primary agent. Falls back to 'build' if not set or if the specified agent is invalid.",
        ),
      username: z
        .string()
        .optional()
        .describe("Custom username to display in conversations instead of system username"),
      mode: z
        .object({
          build: Agent.optional(),
          plan: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("@deprecated Use `agent` field instead."),
      agent: z
        .object({
          // primary
          plan: Agent.optional(),
          build: Agent.optional(),
          // subagent
          general: Agent.optional(),
          explore: Agent.optional(),
          // specialized
          title: Agent.optional(),
          summary: Agent.optional(),
          compaction: Agent.optional(),
        })
        .catchall(Agent)
        .optional()
        .describe("Agent configuration, see https://openxd.ai/docs/agents"),
      provider: z
        .record(z.string(), Provider)
        .optional()
        .describe("Custom provider configurations and model overrides"),
      mcp: z
        .record(
          z.string(),
          z.union([
            Mcp,
            z
              .object({
                enabled: z.boolean(),
              })
              .strict(),
          ]),
        )
        .optional()
        .describe("MCP (Model Context Protocol) server configurations"),
      formatter: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.object({
              disabled: z.boolean().optional(),
              command: z.array(z.string()).optional(),
              environment: z.record(z.string(), z.string()).optional(),
              extensions: z.array(z.string()).optional(),
            }),
          ),
        ])
        .optional(),
      lsp: z
        .union([
          z.literal(false),
          z.record(
            z.string(),
            z.union([
              z.object({
                disabled: z.literal(true),
              }),
              z.object({
                command: z.array(z.string()),
                extensions: z.array(z.string()).optional(),
                disabled: z.boolean().optional(),
                env: z.record(z.string(), z.string()).optional(),
                initialization: z.record(z.string(), z.any()).optional(),
              }),
            ]),
          ),
        ])
        .optional()
        .refine(
          (data) => {
            if (!data) return true
            if (typeof data === "boolean") return true
            const serverIds = new Set(Object.values(LSPServer).map((s) => s.id))

            return Object.entries(data).every(([id, config]) => {
              if (config.disabled) return true
              if (serverIds.has(id)) return true
              return Boolean(config.extensions)
            })
          },
          {
            error: "For custom LSP servers, 'extensions' array is required.",
          },
        ),
      instructions: z.array(z.string()).optional().describe("Additional instruction files or patterns to include"),
      layout: Layout.optional().describe("@deprecated Always uses stretch layout."),
      permission: Permission.optional(),
      tools: z.record(z.string(), z.boolean()).optional(),
      enterprise: z
        .object({
          url: z.string().optional().describe("Enterprise URL"),
        })
        .optional(),
      rateLimitFallback: z
        .object({
          enabled: z.boolean().optional().describe("Enable automatic model cycling when rate limited (default: false)"),
          models: z
            .array(z.string())
            .optional()
            .describe(
              "Ordered list of model IDs to cycle through when rate limited. e.g. ['github-copilot/gpt-4.1', 'github-copilot/o4-mini']. When the active model is rate limited, the next model in the list is used. Cycles back to the primary model when rate limit clears.",
            ),
        })
        .optional()
        .describe("Automatically switch models when rate limited — useful for long unattended runs"),
      compaction: z
        .object({
          auto: z.boolean().optional().describe("Enable automatic compaction when context is full (default: true)"),
          prune: z.boolean().optional().describe("Enable pruning of old tool outputs (default: true)"),
          reserved: z
            .number()
            .int()
            .min(0)
            .optional()
            .describe("Token buffer for compaction. Leaves enough window to avoid overflow during compaction."),
        })
        .optional(),
      modes: z
        .record(
          z.string(),
          z
            .object({
              description: z.string().optional().describe("Description of this mode"),
              loop: z.boolean().optional().describe("Enable autonomous loop (default: false)"),
              readOnly: z
                .boolean()
                .optional()
                .describe("Disable write/edit tools — read-only exploration (default: false)"),
              maxIterations: z
                .number()
                .int()
                .min(1)
                .max(200)
                .optional()
                .describe("Maximum loop iterations before forced stop (default: 50)"),
              prompt: z.string().optional().describe("System prompt injection when mode is active"),
              model: z
                .string()
                .meta({ $ref: "https://models.dev/model-schema.json#/$defs/Model" })
                .optional()
                .describe("Override model for this mode"),
              tools: z
                .record(z.string(), z.boolean())
                .optional()
                .describe("Override specific tool permissions (tool name → enabled)"),
            })
            .describe("Mode configuration"),
        )
        .optional()
        .describe("Custom modes — keyword-triggered session configurations (ultrawork, search, analyze, plan)"),
      experimental: z
        .object({
          disable_paste_summary: z.boolean().optional(),
          batch_tool: z.boolean().optional().describe("Enable the batch tool"),
          retry_attempts: z
            .number()
            .int()
            .min(1)
            .optional()
            .describe("Maximum retry attempts for retryable session errors (default: 8)"),
          openTelemetry: z
            .boolean()
            .optional()
            .describe("Enable OpenTelemetry spans for AI SDK calls (using the 'experimental_telemetry' flag)"),
          primary_tools: z
            .array(z.string())
            .optional()
            .describe("Tools that should only be available to primary agents."),
          continue_loop_on_deny: z.boolean().optional().describe("Continue the agent loop when a tool call is denied"),
          mcp_timeout: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("Timeout in milliseconds for model context protocol (MCP) requests"),
        })
        .optional(),
      telegram: z
        .object({
          botToken: z.string().optional().describe("Telegram bot token from @BotFather"),
          allowedUsers: z
            .array(z.number())
            .optional()
            .describe("Telegram user IDs allowed to use the bot. Empty = allow all."),
        })
        .optional()
        .describe("Telegram bot configuration for remote access"),
      daemon: z
        .object({
          heartbeat: z
            .object({
              enabled: z.boolean().optional().describe("Enable heartbeat system (default: false)"),
              intervalMinutes: z
                .number()
                .int()
                .positive()
                .optional()
                .describe("Heartbeat interval in minutes (default: 30)"),
              quietHours: z
                .object({
                  start: z.string().optional().describe("Quiet hours start time (HH:MM, 24h format)"),
                  end: z.string().optional().describe("Quiet hours end time (HH:MM, 24h format)"),
                })
                .optional()
                .describe("Time range to skip heartbeats"),
            })
            .optional()
            .describe("Heartbeat configuration for proactive checks"),
        })
        .optional()
        .describe("Daemon configuration"),
      browser: z
        .object({
          cdp: z
            .object({
              port: z.number().int().positive().optional().describe("CDP debugging port to connect to (default: 9222)"),
            })
            .optional(),
          pinchtab: z
            .object({
              enabled: z.boolean().optional().describe("Use PinchTab daemon if available (default: true)"),
              url: z.string().optional().describe("PinchTab server URL (default: http://localhost:9867)"),
            })
            .optional()
            .describe("PinchTab integration for persistent browser profiles"),
        })
        .optional()
        .describe("Browser control via Chrome DevTools Protocol or PinchTab"),
    })
    .strict()
    .meta({
      ref: "Config",
    })

  export type Info = z.output<typeof Info>

  export const global = lazy(async () => {
    let result: Info = await mergeFiles(
      {},
      ["config.json", ...CONFIG_FILES].map((file) => path.join(Global.Path.config, file)),
      loadFile,
      mergeDeep,
    )

    const legacy = path.join(Global.Path.config, "config")
    if (existsSync(legacy)) {
      await import(pathToFileURL(legacy).href, {
        with: {
          type: "toml",
        },
      })
        .then(async (mod) => {
          const { provider, model, ...rest } = mod.default
          if (provider && model) result.model = `${provider}/${model}`
          result["$schema"] = "https://openxd.ai/config.json"
          result = mergeDeep(result, rest)
          await Filesystem.writeJson(path.join(Global.Path.config, "config.json"), result)
          await fs.unlink(legacy)
        })
        .catch(() => {})
    }

    return result
  })

  export const { readFile } = ConfigPaths

  async function loadFile(filepath: string): Promise<Info> {
    log.info("loading", { path: filepath })
    const text = await readFile(filepath)
    if (!text) return {}
    return load(text, { path: filepath })
  }

  async function load(text: string, options: { path: string } | { dir: string; source: string }) {
    const original = text
    const source = "path" in options ? options.path : options.source
    const isFile = "path" in options
    const data = await ConfigPaths.parseText(
      text,
      "path" in options ? options.path : { source: options.source, dir: options.dir },
    )

    const normalized = (() => {
      if (!data || typeof data !== "object" || Array.isArray(data)) return data
      const copy = { ...(data as Record<string, unknown>) }
      const hadLegacy = "theme" in copy || "keybinds" in copy || "tui" in copy
      if (!hadLegacy) return copy
      delete copy.theme
      delete copy.keybinds
      delete copy.tui
      log.warn("tui keys in opencode config are deprecated; move them to tui.json", { path: source })
      return copy
    })()

    const parsed = Info.safeParse(normalized)
    if (parsed.success) {
      if (!parsed.data.$schema && isFile) {
        parsed.data.$schema = "https://openxd.ai/config.json"
        const updated = original.replace(/^\s*\{/, '{\n  "$schema": "https://openxd.ai/config.json",')
        await Filesystem.write(options.path, updated).catch(() => {})
      }
      const data = parsed.data
      if (data.plugin && isFile) {
        data.plugin = await resolvePlugins(data.plugin, options.path)
      }
      return data
    }

    throw new InvalidError({
      path: source,
      issues: parsed.error.issues,
    })
  }
  export const { JsonError, InvalidError } = ConfigPaths

  export const ConfigDirectoryTypoError = NamedError.create(
    "ConfigDirectoryTypoError",
    z.object({
      path: z.string(),
      dir: z.string(),
      suggestion: z.string(),
    }),
  )

  export async function get() {
    return state().then((x) => x.config)
  }

  export async function getGlobal() {
    return global()
  }

  export async function update(config: Info) {
    const filepath = path.join(Instance.directory, "config.json")
    const existing = await loadFile(filepath)
    await Filesystem.writeJson(filepath, mergeDeep(existing, config))
    await Instance.dispose()
  }

  export async function updateGlobal(config: Info) {
    const filepath = resolveGlobalConfigFile(Global.Path.config, existsSync)
    const before = await Filesystem.readText(filepath).catch((err: any) => {
      if (err.code === "ENOENT") return "{}"
      throw new JsonError({ path: filepath }, { cause: err })
    })

    const parse = (text: string) =>
      parseConfigText(
        text,
        filepath,
        (data) => {
          const parsed = Info.safeParse(data)
          if (parsed.success) return parsed.data
          throw new InvalidError({
            path: filepath,
            issues: parsed.error.issues,
          })
        },
        (data) => {
          throw new JsonError(data)
        },
      ) as Info

    const next = await (async () => {
      if (!filepath.endsWith(".jsonc")) {
        const existing = parse(before)
        const merged = mergeDeep(existing, config)
        await Filesystem.writeJson(filepath, merged)
        return merged
      }

      const updated = patchJsoncText(before, config)
      const merged = parse(updated)
      await Filesystem.write(filepath, updated)
      return merged
    })()

    global.reset()

    void Instance.disposeAll()
      .catch(() => undefined)
      .finally(() => {
        GlobalBus.emit("event", {
          directory: "global",
          payload: {
            type: Event.Disposed.type,
            properties: {},
          },
        })
      })

    return next
  }

  export async function directories() {
    return state().then((x) => x.directories)
  }
}
