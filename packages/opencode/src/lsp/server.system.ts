import { spawn } from "child_process"
import path from "path"
import os from "os"
import fs from "fs/promises"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { Process } from "../util/process"
import { which } from "../util/which"
import type { Info } from "./server.types"
import { extract, log, nearestRoot, output, pathExists, run, withGlobalBinPath } from "./server.shared"

export const Gopls: Info = {
  id: "gopls",
  root: async (file) => {
    const work = await nearestRoot(["go.work"])(file)
    if (work) return work
    return nearestRoot(["go.mod", "go.sum"])(file)
  },
  extensions: [".go"],
  async spawn(root) {
    let bin = which("gopls", withGlobalBinPath())
    if (!bin) {
      if (!which("go") || Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const proc = Process.spawn(["go", "install", "golang.org/x/tools/gopls@latest"], {
        env: { ...process.env, GOBIN: Global.Path.bin },
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      })
      const exit = await proc.exited
      if (exit !== 0) return
      bin = path.join(Global.Path.bin, "gopls" + (process.platform === "win32" ? ".exe" : ""))
      log.info("installed gopls", { bin })
    }
    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}

export const Rubocop: Info = {
  id: "ruby-lsp",
  root: nearestRoot(["Gemfile"]),
  extensions: [".rb", ".rake", ".gemspec", ".ru"],
  async spawn(root) {
    let bin = which("rubocop", withGlobalBinPath())
    if (!bin) {
      if (!which("ruby") || !which("gem") || Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) {
        log.info("Ruby not found, please install Ruby first")
        return
      }
      const proc = Process.spawn(["gem", "install", "rubocop", "--bindir", Global.Path.bin], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      })
      const exit = await proc.exited
      if (exit !== 0) return
      bin = path.join(Global.Path.bin, "rubocop" + (process.platform === "win32" ? ".exe" : ""))
      log.info("installed rubocop", { bin })
    }
    return {
      process: spawn(bin, ["--lsp"], { cwd: root }),
    }
  },
}

export const CSharp: Info = {
  id: "csharp",
  root: nearestRoot([".slnx", ".sln", ".csproj", "global.json"]),
  extensions: [".cs"],
  async spawn(root) {
    let bin = which("csharp-ls", withGlobalBinPath())
    if (!bin) {
      if (!which("dotnet") || Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const proc = Process.spawn(["dotnet", "tool", "install", "csharp-ls", "--tool-path", Global.Path.bin], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      })
      const exit = await proc.exited
      if (exit !== 0) return
      bin = path.join(Global.Path.bin, "csharp-ls" + (process.platform === "win32" ? ".exe" : ""))
      log.info("installed csharp-ls", { bin })
    }
    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}

export const FSharp: Info = {
  id: "fsharp",
  root: nearestRoot([".slnx", ".sln", ".fsproj", "global.json"]),
  extensions: [".fs", ".fsi", ".fsx", ".fsscript"],
  async spawn(root) {
    let bin = which("fsautocomplete", withGlobalBinPath())
    if (!bin) {
      if (!which("dotnet") || Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const proc = Process.spawn(["dotnet", "tool", "install", "fsautocomplete", "--tool-path", Global.Path.bin], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "pipe",
      })
      const exit = await proc.exited
      if (exit !== 0) return
      bin = path.join(Global.Path.bin, "fsautocomplete" + (process.platform === "win32" ? ".exe" : ""))
      log.info("installed fsautocomplete", { bin })
    }
    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}

export const SourceKit: Info = {
  id: "sourcekit-lsp",
  extensions: [".swift", ".objc", "objcpp"],
  root: nearestRoot(["Package.swift", "*.xcodeproj", "*.xcworkspace"]),
  async spawn(root) {
    const sourcekit = which("sourcekit-lsp")
    if (sourcekit) return { process: spawn(sourcekit, { cwd: root }) }
    if (!which("xcrun")) return
    const loc = await output(["xcrun", "--find", "sourcekit-lsp"])
    if (loc.code !== 0) return
    return {
      process: spawn(loc.text.trim(), { cwd: root }),
    }
  },
}

export const RustAnalyzer: Info = {
  id: "rust",
  root: async (file) => {
    const crate = await nearestRoot(["Cargo.toml", "Cargo.lock"])(file)
    if (!crate) return
    let cur = crate
    while (cur !== path.dirname(cur)) {
      const cargo = path.join(cur, "Cargo.toml")
      try {
        if ((await Filesystem.readText(cargo)).includes("[workspace]")) return cur
      } catch {}
      const next = path.dirname(cur)
      if (next === cur) break
      cur = next
      if (!cur.startsWith(Instance.worktree)) break
    }
    return crate
  },
  extensions: [".rs"],
  async spawn(root) {
    const bin = which("rust-analyzer")
    if (!bin) {
      log.info("rust-analyzer not found in path, please install it")
      return
    }
    return { process: spawn(bin, { cwd: root }) }
  },
}

export const JDTLS: Info = {
  id: "jdtls",
  root: async (file) => {
    const settings = ["settings.gradle", "settings.gradle.kts"]
    const gradle = ["gradlew", "gradlew.bat"]
    const exclude = gradle.concat(settings)
    const [project, wrapper, setting] = await Promise.all([
      nearestRoot(["pom.xml", "build.gradle", "build.gradle.kts", ".project", ".classpath"], exclude)(file),
      nearestRoot(gradle, settings)(file),
      nearestRoot(settings)(file),
    ])
    if (project) return project
    if (wrapper) return wrapper
    return setting
  },
  extensions: [".java"],
  async spawn(root) {
    const java = which("java")
    if (!java) {
      log.error("Java 21 or newer is required to run the JDTLS. Please install it first.")
      return
    }
    const major = await run(["java", "-version"]).then((rs) => {
      const m = /"(\d+)\.\d+\.\d+"/.exec(rs.stderr.toString())
      return m ? parseInt(m[1]) : undefined
    })
    if (major == null || major < 21) return

    const dist = path.join(Global.Path.bin, "jdtls")
    const plugins = path.join(dist, "plugins")
    if (!(await pathExists(plugins))) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      await fs.mkdir(dist, { recursive: true })
      const url =
        "https://www.eclipse.org/downloads/download.php?file=/jdtls/snapshots/jdt-language-server-latest.tar.gz"
      const name = path.join(dist, "release.tar.gz")
      const dl = await fetch(url)
      if (!dl.ok || !dl.body) return
      await Filesystem.writeStream(name, dl.body)
      const ok = await run(["tar", "-xzf", "release.tar.gz"], { cwd: dist })
      if (ok.code !== 0) return
      await fs.rm(name, { force: true })
    }

    const jar =
      (await fs.readdir(plugins).catch(() => []))
        .find((x) => /^org\.eclipse\.equinox\.launcher_.*\.jar$/.test(x))
        ?.trim() ?? ""
    const launcher = path.join(plugins, jar)
    if (!(await pathExists(launcher))) return

    const cfg = path.join(
      dist,
      process.platform === "darwin" ? "config_mac" : process.platform === "win32" ? "config_win" : "config_linux",
    )
    const data = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-jdtls-data"))
    return {
      process: spawn(
        java,
        [
          "-jar",
          launcher,
          "-configuration",
          cfg,
          "-data",
          data,
          "-Declipse.application=org.eclipse.jdt.ls.core.id1",
          "-Dosgi.bundles.defaultStartLevel=4",
          "-Declipse.product=org.eclipse.jdt.ls.core.product",
          "-Dlog.level=ALL",
          "--add-modules=ALL-SYSTEM",
          "--add-opens java.base/java.util=ALL-UNNAMED",
          "--add-opens java.base/java.lang=ALL-UNNAMED",
        ],
        { cwd: root },
      ),
    }
  },
}

export const KotlinLS: Info = {
  id: "kotlin-ls",
  extensions: [".kt", ".kts"],
  root: async (file) => {
    const settings = await nearestRoot(["settings.gradle.kts", "settings.gradle"])(file)
    if (settings) return settings
    const wrapper = await nearestRoot(["gradlew", "gradlew.bat"])(file)
    if (wrapper) return wrapper
    const build = await nearestRoot(["build.gradle.kts", "build.gradle"])(file)
    if (build) return build
    return nearestRoot(["pom.xml"])(file)
  },
  async spawn(root) {
    const dist = path.join(Global.Path.bin, "kotlin-ls")
    const launcher = process.platform === "win32" ? path.join(dist, "kotlin-lsp.cmd") : path.join(dist, "kotlin-lsp.sh")
    if (!(await Filesystem.exists(launcher))) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const rel = await fetch("https://api.github.com/repos/Kotlin/kotlin-lsp/releases/latest")
      if (!rel.ok) return
      const json = await rel.json()
      const version = typeof json.name === "string" ? json.name.replace(/^v/, "") : undefined
      if (!version) return

      const arch = process.arch === "arm64" ? "aarch64" : process.arch
      const plat = process.platform === "darwin" ? "mac" : process.platform === "win32" ? "win" : "linux"
      const combo = `${plat}-${arch}`
      const ok = ["mac-x64", "mac-aarch64", "linux-x64", "linux-aarch64", "win-x64", "win-aarch64"].includes(combo)
      if (!ok) return

      const asset = `kotlin-lsp-${version}-${plat}-${arch}.zip`
      const url = `https://download-cdn.jetbrains.com/kotlin-lsp/${version}/${asset}`
      await fs.mkdir(dist, { recursive: true })
      const zip = path.join(dist, "kotlin-ls.zip")
      const dl = await fetch(url)
      if (!dl.ok || !dl.body) return
      await Filesystem.writeStream(zip, dl.body)
      const extracted = await extract({
        file: zip,
        dir: dist,
        kind: "zip",
        name: "kotlin-ls",
      })
      if (!extracted) return
      await fs.rm(zip, { force: true })
      if (process.platform !== "win32") await fs.chmod(launcher, 0o755).catch(() => {})
    }
    if (!(await Filesystem.exists(launcher))) return
    return {
      process: spawn(launcher, ["--stdio"], { cwd: root }),
    }
  },
}

export const Gleam: Info = {
  id: "gleam",
  extensions: [".gleam"],
  root: nearestRoot(["gleam.toml"]),
  async spawn(root) {
    const gleam = which("gleam")
    if (!gleam) return
    return {
      process: spawn(gleam, ["lsp"], { cwd: root }),
    }
  },
}

export const Clojure: Info = {
  id: "clojure-lsp",
  extensions: [".clj", ".cljs", ".cljc", ".edn"],
  root: nearestRoot(["deps.edn", "project.clj", "shadow-cljs.edn", "bb.edn", "build.boot"]),
  async spawn(root) {
    let bin = which("clojure-lsp")
    if (!bin && process.platform === "win32") bin = which("clojure-lsp.exe")
    if (!bin) return
    return {
      process: spawn(bin, ["listen"], { cwd: root }),
    }
  },
}

export const Nixd: Info = {
  id: "nixd",
  extensions: [".nix"],
  root: async (file) => {
    const flake = await nearestRoot(["flake.nix"])(file)
    if (flake && flake !== Instance.directory) return flake
    if (Instance.worktree && Instance.worktree !== Instance.directory) return Instance.worktree
    return Instance.directory
  },
  async spawn(root) {
    const nixd = which("nixd")
    if (!nixd) return
    return {
      process: spawn(nixd, [], { cwd: root, env: { ...process.env } }),
    }
  },
}

export const HLS: Info = {
  id: "haskell-language-server",
  extensions: [".hs", ".lhs"],
  root: nearestRoot(["stack.yaml", "cabal.project", "hie.yaml", "*.cabal"]),
  async spawn(root) {
    const bin = which("haskell-language-server-wrapper")
    if (!bin) return
    return {
      process: spawn(bin, ["--lsp"], { cwd: root }),
    }
  },
}

export const JuliaLS: Info = {
  id: "julials",
  extensions: [".jl"],
  root: nearestRoot(["Project.toml", "Manifest.toml", "*.jl"]),
  async spawn(root) {
    const julia = which("julia")
    if (!julia) return
    return {
      process: spawn(julia, ["--startup-file=no", "--history-file=no", "-e", "using LanguageServer; runserver()"], {
        cwd: root,
      }),
    }
  },
}

export const Dart: Info = {
  id: "dart",
  extensions: [".dart"],
  root: nearestRoot(["pubspec.yaml", "analysis_options.yaml"]),
  async spawn(root) {
    const dart = which("dart")
    if (!dart) return
    return {
      process: spawn(dart, ["language-server", "--lsp"], { cwd: root }),
    }
  },
}

export const Ocaml: Info = {
  id: "ocaml-lsp",
  extensions: [".ml", ".mli"],
  root: nearestRoot(["dune-project", "dune-workspace", ".merlin", "opam"]),
  async spawn(root) {
    const bin = which("ocamllsp")
    if (!bin) return
    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}
