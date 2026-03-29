import { Config } from "effect"

function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

export namespace Flag {
  export const OPENXD_AUTO_SHARE = truthy("OPENXD_AUTO_SHARE")
  export const OPENXD_GIT_BASH_PATH = process.env["OPENXD_GIT_BASH_PATH"]
  export const OPENXD_CONFIG = process.env["OPENXD_CONFIG"]
  export declare const OPENXD_PURE: boolean
  export declare const OPENXD_TUI_CONFIG: string | undefined
  export declare const OPENXD_CONFIG_DIR: string | undefined
  export declare const OPENXD_PLUGIN_META_FILE: string | undefined
  export const OPENXD_CONFIG_CONTENT = process.env["OPENXD_CONFIG_CONTENT"]
  export const OPENXD_DISABLE_AUTOUPDATE = truthy("OPENXD_DISABLE_AUTOUPDATE")
  export const OPENXD_ALWAYS_NOTIFY_UPDATE = truthy("OPENXD_ALWAYS_NOTIFY_UPDATE")
  export const OPENXD_DISABLE_PRUNE = truthy("OPENXD_DISABLE_PRUNE")
  export const OPENXD_DISABLE_TERMINAL_TITLE = truthy("OPENXD_DISABLE_TERMINAL_TITLE")
  export const OPENXD_SHOW_TTFD = truthy("OPENXD_SHOW_TTFD")
  export const OPENXD_PERMISSION = process.env["OPENXD_PERMISSION"]
  export const OPENXD_DISABLE_DEFAULT_PLUGINS = truthy("OPENXD_DISABLE_DEFAULT_PLUGINS")
  export const OPENXD_DISABLE_LSP_DOWNLOAD = truthy("OPENXD_DISABLE_LSP_DOWNLOAD")
  export const OPENXD_ENABLE_EXPERIMENTAL_MODELS = truthy("OPENXD_ENABLE_EXPERIMENTAL_MODELS")
  export const OPENXD_DISABLE_AUTOCOMPACT = truthy("OPENXD_DISABLE_AUTOCOMPACT")
  export const OPENXD_DISABLE_MODELS_FETCH = truthy("OPENXD_DISABLE_MODELS_FETCH")
  export const OPENXD_DISABLE_CLAUDE_CODE = truthy("OPENXD_DISABLE_CLAUDE_CODE")
  export const OPENXD_DISABLE_CLAUDE_CODE_PROMPT =
    OPENXD_DISABLE_CLAUDE_CODE || truthy("OPENXD_DISABLE_CLAUDE_CODE_PROMPT")
  export const OPENXD_DISABLE_CLAUDE_CODE_SKILLS =
    OPENXD_DISABLE_CLAUDE_CODE || truthy("OPENXD_DISABLE_CLAUDE_CODE_SKILLS")
  export const OPENXD_DISABLE_EXTERNAL_SKILLS =
    OPENXD_DISABLE_CLAUDE_CODE_SKILLS || truthy("OPENXD_DISABLE_EXTERNAL_SKILLS")
  export declare const OPENXD_DISABLE_PROJECT_CONFIG: boolean
  export const OPENXD_FAKE_VCS = process.env["OPENXD_FAKE_VCS"]
  export declare const OPENXD_CLIENT: string
  export const OPENXD_SERVER_PASSWORD = process.env["OPENXD_SERVER_PASSWORD"]
  export const OPENXD_SERVER_USERNAME = process.env["OPENXD_SERVER_USERNAME"]
  export const OPENXD_ENABLE_QUESTION_TOOL = truthy("OPENXD_ENABLE_QUESTION_TOOL")

  // Experimental
  export const OPENXD_EXPERIMENTAL = truthy("OPENXD_EXPERIMENTAL")
  export const OPENXD_EXPERIMENTAL_FILEWATCHER = Config.boolean("OPENXD_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  )
  export const OPENXD_EXPERIMENTAL_DISABLE_FILEWATCHER = Config.boolean(
    "OPENXD_EXPERIMENTAL_DISABLE_FILEWATCHER",
  ).pipe(Config.withDefault(false))
  export const OPENXD_EXPERIMENTAL_ICON_DISCOVERY =
    OPENXD_EXPERIMENTAL || truthy("OPENXD_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["OPENXD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const OPENXD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("OPENXD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const OPENXD_ENABLE_EXA =
    truthy("OPENXD_ENABLE_EXA") || OPENXD_EXPERIMENTAL || truthy("OPENXD_EXPERIMENTAL_EXA")
  export const OPENXD_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("OPENXD_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const OPENXD_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("OPENXD_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const OPENXD_EXPERIMENTAL_OXFMT = OPENXD_EXPERIMENTAL || truthy("OPENXD_EXPERIMENTAL_OXFMT")
  export const OPENXD_EXPERIMENTAL_LSP_TY = truthy("OPENXD_EXPERIMENTAL_LSP_TY")
  export const OPENXD_EXPERIMENTAL_LSP_TOOL = OPENXD_EXPERIMENTAL || truthy("OPENXD_EXPERIMENTAL_LSP_TOOL")
  export const OPENXD_DISABLE_FILETIME_CHECK = Config.boolean("OPENXD_DISABLE_FILETIME_CHECK").pipe(
    Config.withDefault(false),
  )
  export const OPENXD_EXPERIMENTAL_PLAN_MODE = OPENXD_EXPERIMENTAL || truthy("OPENXD_EXPERIMENTAL_PLAN_MODE")
  export const OPENXD_EXPERIMENTAL_WORKSPACES = OPENXD_EXPERIMENTAL || truthy("OPENXD_EXPERIMENTAL_WORKSPACES")
  export const OPENXD_EXPERIMENTAL_MARKDOWN = !falsy("OPENXD_EXPERIMENTAL_MARKDOWN")
  export const OPENXD_MODELS_URL = process.env["OPENXD_MODELS_URL"]
  export const OPENXD_MODELS_PATH = process.env["OPENXD_MODELS_PATH"]
  export const OPENXD_DISABLE_EMBEDDED_WEB_UI = truthy("OPENXD_DISABLE_EMBEDDED_WEB_UI")
  export const OPENXD_DB = process.env["OPENXD_DB"]
  export const OPENXD_DISABLE_CHANNEL_DB = truthy("OPENXD_DISABLE_CHANNEL_DB")
  export const OPENXD_SKIP_MIGRATIONS = truthy("OPENXD_SKIP_MIGRATIONS")
  export const OPENXD_STRICT_CONFIG_DEPS = truthy("OPENXD_STRICT_CONFIG_DEPS")

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for OPENXD_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENXD_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("OPENXD_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENXD_TUI_CONFIG
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENXD_TUI_CONFIG", {
  get() {
    return process.env["OPENXD_TUI_CONFIG"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENXD_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENXD_CONFIG_DIR", {
  get() {
    return process.env["OPENXD_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENXD_PURE
// This must be evaluated at access time, not module load time,
// because the CLI can set this flag at runtime
Object.defineProperty(Flag, "OPENXD_PURE", {
  get() {
    return truthy("OPENXD_PURE")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENXD_PLUGIN_META_FILE
// This must be evaluated at access time, not module load time,
// because tests and external tooling may set this env var at runtime
Object.defineProperty(Flag, "OPENXD_PLUGIN_META_FILE", {
  get() {
    return process.env["OPENXD_PLUGIN_META_FILE"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for OPENXD_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "OPENXD_CLIENT", {
  get() {
    return process.env["OPENXD_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
