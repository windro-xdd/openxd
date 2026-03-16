import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { BunProc } from "../bun"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { Process } from "../util/process"
import { Archive } from "../util/archive"
import { which } from "../util/which"
import { Module } from "@opencode-ai/util/module"
import type { Info } from "./server.types"
import { bunEnv, log, nearestRoot, resolveUp, readHelp } from "./server.shared"

export const Deno: Info = {
  id: "deno",
  root: async (file) => {
    const files = Filesystem.up({
      targets: ["deno.json", "deno.jsonc"],
      start: path.dirname(file),
      stop: Instance.directory,
    })
    const first = await files.next()
    await files.return()
    if (!first.value) return undefined
    return path.dirname(first.value)
  },
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
  async spawn(root) {
    const deno = which("deno")
    if (!deno) {
      log.info("deno not found, please install deno first")
      return
    }
    return {
      process: spawn(deno, ["lsp"], { cwd: root }),
    }
  },
}

export const Typescript: Info = {
  id: "typescript",
  root: nearestRoot(
    ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
    ["deno.json", "deno.jsonc"],
  ),
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
  async spawn(root) {
    const tsserver = Module.resolve("typescript/lib/tsserver.js", Instance.directory)
    log.info("typescript server", { tsserver })
    if (!tsserver) return
    return {
      process: spawn(BunProc.which(), ["x", "typescript-language-server", "--stdio"], {
        cwd: root,
        env: bunEnv(),
      }),
      initialization: {
        tsserver: {
          path: tsserver,
        },
      },
    }
  },
}

export const Vue: Info = {
  id: "vue",
  extensions: [".vue"],
  root: nearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
  async spawn(root) {
    let bin = which("vue-language-server")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "@vue", "language-server", "bin", "vue-language-server.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "@vue/language-server"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
      initialization: {},
    }
  },
}

export const ESLint: Info = {
  id: "eslint",
  root: nearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue"],
  async spawn(root) {
    const eslint = Module.resolve("eslint", Instance.directory)
    if (!eslint) return

    const srv = path.join(Global.Path.bin, "vscode-eslint", "server", "out", "eslintServer.js")
    if (!(await Filesystem.exists(srv))) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      log.info("downloading and building VS Code ESLint server")
      const res = await fetch("https://github.com/microsoft/vscode-eslint/archive/refs/heads/main.zip")
      if (!res.ok || !res.body) return

      const zip = path.join(Global.Path.bin, "vscode-eslint.zip")
      await Filesystem.writeStream(zip, res.body)
      const ok = await Archive.extractZip(zip, Global.Path.bin)
        .then(() => true)
        .catch((error) => {
          log.error("Failed to extract vscode-eslint archive", { error })
          return false
        })
      if (!ok) return
      await fs.rm(zip, { force: true })

      const src = path.join(Global.Path.bin, "vscode-eslint-main")
      const dst = path.join(Global.Path.bin, "vscode-eslint")
      const exists = await fs.stat(dst).catch(() => undefined)
      if (exists) await fs.rm(dst, { force: true, recursive: true })
      await fs.rename(src, dst)

      const npm = process.platform === "win32" ? "npm.cmd" : "npm"
      await Process.run([npm, "install"], { cwd: dst })
      await Process.run([npm, "run", "compile"], { cwd: dst })
      log.info("installed VS Code ESLint server", { serverPath: srv })
    }

    return {
      process: spawn(BunProc.which(), [srv, "--stdio"], {
        cwd: root,
        env: bunEnv(),
      }),
    }
  },
}

export const Oxlint: Info = {
  id: "oxlint",
  root: nearestRoot([
    ".oxlintrc.json",
    "package-lock.json",
    "bun.lockb",
    "bun.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package.json",
  ]),
  extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".astro", ".svelte"],
  async spawn(root) {
    const ext = process.platform === "win32" ? ".cmd" : ""
    const lintTarget = path.join("node_modules", ".bin", "oxlint" + ext)
    const srvTarget = path.join("node_modules", ".bin", "oxc_language_server" + ext)

    let lint = await resolveUp(root, lintTarget)
    if (!lint) lint = which("oxlint") ?? undefined
    if (lint) {
      const help = await readHelp(lint)
      if (help.includes("--lsp")) {
        return {
          process: spawn(lint, ["--lsp"], { cwd: root }),
        }
      }
    }

    let srv = await resolveUp(root, srvTarget)
    if (!srv) srv = which("oxc_language_server") ?? undefined
    if (srv) {
      return {
        process: spawn(srv, [], { cwd: root }),
      }
    }

    log.info("oxlint not found, please install oxlint")
    return
  },
}

export const Biome: Info = {
  id: "biome",
  root: nearestRoot([
    "biome.json",
    "biome.jsonc",
    "package-lock.json",
    "bun.lockb",
    "bun.lock",
    "pnpm-lock.yaml",
    "yarn.lock",
  ]),
  extensions: [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".json",
    ".jsonc",
    ".vue",
    ".astro",
    ".svelte",
    ".css",
    ".graphql",
    ".gql",
    ".html",
  ],
  async spawn(root) {
    const local = path.join(root, "node_modules", ".bin", "biome")
    let bin = (await Filesystem.exists(local)) ? local : which("biome")
    let args = ["lsp-proxy", "--stdio"]
    if (!bin) {
      const mod = Module.resolve("biome", root)
      if (!mod) return
      bin = BunProc.which()
      args = ["x", "biome", "lsp-proxy", "--stdio"]
    }

    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
    }
  },
}

export const Svelte: Info = {
  id: "svelte",
  extensions: [".svelte"],
  root: nearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
  async spawn(root) {
    let bin = which("svelteserver")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "svelte-language-server", "bin", "server.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "svelte-language-server"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
      initialization: {},
    }
  },
}

export const Astro: Info = {
  id: "astro",
  extensions: [".astro"],
  root: nearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
  async spawn(root) {
    const tsserver = Module.resolve("typescript/lib/tsserver.js", Instance.directory)
    if (!tsserver) {
      log.info("typescript not found, required for Astro language server")
      return
    }
    const tsdk = path.dirname(tsserver)

    let bin = which("astro-ls")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "@astrojs", "language-server", "bin", "nodeServer.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "@astrojs/language-server"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
      initialization: {
        typescript: {
          tsdk,
        },
      },
    }
  },
}

export const YamlLS: Info = {
  id: "yaml-ls",
  extensions: [".yaml", ".yml"],
  root: nearestRoot(["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"]),
  async spawn(root) {
    let bin = which("yaml-language-server")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "yaml-language-server", "out", "server", "src", "server.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "yaml-language-server"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
    }
  },
}

export const BashLS: Info = {
  id: "bash",
  extensions: [".sh", ".bash", ".zsh", ".ksh"],
  root: async () => Instance.directory,
  async spawn(root) {
    let bin = which("bash-language-server")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "bash-language-server", "out", "cli.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "bash-language-server"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("start")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
    }
  },
}

export const DockerfileLS: Info = {
  id: "dockerfile",
  extensions: [".dockerfile", "Dockerfile"],
  root: async () => Instance.directory,
  async spawn(root) {
    let bin = which("docker-langserver")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "dockerfile-language-server-nodejs", "lib", "server.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "dockerfile-language-server-nodejs"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
    }
  },
}

export const PHPIntelephense: Info = {
  id: "php intelephense",
  extensions: [".php"],
  root: nearestRoot(["composer.json", "composer.lock", ".php-version"]),
  async spawn(root) {
    let bin = which("intelephense")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "intelephense", "lib", "intelephense.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "intelephense"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
          stdout: "pipe",
          stderr: "pipe",
          stdin: "pipe",
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")
    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
      initialization: {
        telemetry: {
          enabled: false,
        },
      },
    }
  },
}

export const Prisma: Info = {
  id: "prisma",
  extensions: [".prisma"],
  root: nearestRoot(["schema.prisma", "prisma/schema.prisma", "prisma"], ["package.json"]),
  async spawn(root) {
    const prisma = which("prisma")
    if (!prisma) {
      log.info("prisma not found, please install prisma")
      return
    }
    return {
      process: spawn(prisma, ["language-server"], { cwd: root }),
    }
  },
}
