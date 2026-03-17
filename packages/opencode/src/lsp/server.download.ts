import { spawn } from "child_process"
import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { Filesystem } from "../util/filesystem"
import { Flag } from "../flag/flag"
import { which } from "../util/which"
import type { Info } from "./server.types"
import { download, ensureExec, extract, log, nearestRoot, parseRelease, run, withGlobalBinPath } from "./server.shared"

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object"

const parseTerraform = (x: unknown) => {
  const base = isObj(x) ? x : {}
  const list = Array.isArray(base.builds) ? base.builds : []
  return {
    version: typeof base.version === "string" ? base.version : undefined,
    builds: list
      .filter(isObj)
      .map((item) => {
        const arch = typeof item.arch === "string" ? item.arch : undefined
        const os = typeof item.os === "string" ? item.os : undefined
        const url = typeof item.url === "string" ? item.url : undefined
        if (!arch || !os || !url) return undefined
        return { arch, os, url }
      })
      .filter((item): item is { arch: string; os: string; url: string } => !!item),
  }
}

export const ElixirLS: Info = {
  id: "elixir-ls",
  extensions: [".ex", ".exs"],
  root: nearestRoot(["mix.exs", "mix.lock"]),
  async spawn(root) {
    let bin = which("elixir-ls")
    if (!bin) {
      const target = path.join(
        Global.Path.bin,
        "elixir-ls-master",
        "release",
        process.platform === "win32" ? "language_server.bat" : "language_server.sh",
      )
      bin = target
      if (!(await Filesystem.exists(target))) {
        if (!which("elixir") || Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        const zip = path.join(Global.Path.bin, "elixir-ls.zip")
        const ok = await download("https://github.com/elixir-lsp/elixir-ls/archive/refs/heads/master.zip", zip)
        if (!ok) return
        const extracted = await extract({ file: zip, dir: Global.Path.bin, kind: "zip", name: "elixir-ls" })
        if (!extracted) return
        await fs.rm(zip, { force: true, recursive: true })
        const cwd = path.join(Global.Path.bin, "elixir-ls-master")
        const env = { MIX_ENV: "prod", ...process.env }
        await run(["mix", "deps.get"], { cwd, env })
        await run(["mix", "compile"], { cwd, env })
        await run(["mix", "elixir_ls.release2", "-o", "release"], { cwd, env })
      }
    }

    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}

export const Zls: Info = {
  id: "zls",
  extensions: [".zig", ".zon"],
  root: nearestRoot(["build.zig"]),
  async spawn(root) {
    let bin = which("zls", withGlobalBinPath())
    if (!bin) {
      if (!which("zig") || Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const rel = await fetch("https://api.github.com/repos/zigtools/zls/releases/latest")
      if (!rel.ok) {
        log.error("Failed to fetch zls release info")
        return
      }

      const release = parseRelease(await rel.json())
      const platform = process.platform
      const arch = process.arch
      const zarch = arch === "arm64" ? "aarch64" : arch === "x64" ? "x86_64" : arch === "ia32" ? "x86" : arch
      const zplat = platform === "darwin" ? "macos" : platform === "win32" ? "windows" : platform
      const ext = platform === "win32" ? "zip" : "tar.xz"
      const name = `zls-${zarch}-${zplat}.${ext}`
      const supported = [
        "zls-x86_64-linux.tar.xz",
        "zls-x86_64-macos.tar.xz",
        "zls-x86_64-windows.zip",
        "zls-aarch64-linux.tar.xz",
        "zls-aarch64-macos.tar.xz",
        "zls-aarch64-windows.zip",
        "zls-x86-linux.tar.xz",
        "zls-x86-windows.zip",
      ]
      if (!supported.includes(name)) return

      const asset = release.assets.find((x) => x.name === name)
      if (!asset) {
        log.error(`Could not find asset ${name} in latest zls release`)
        return
      }

      const tmp = path.join(Global.Path.bin, name)
      const ok = await download(asset.browser_download_url, tmp)
      if (!ok) return
      const extracted = await extract({
        file: tmp,
        dir: Global.Path.bin,
        kind: ext === "zip" ? "zip" : "tar.xz",
        name: "zls",
      })
      if (!extracted) return
      await fs.rm(tmp, { force: true })

      bin = path.join(Global.Path.bin, "zls" + (platform === "win32" ? ".exe" : ""))
      if (!(await Filesystem.exists(bin))) return
      if (!(await ensureExec(bin))) return
      log.info("installed zls", { bin })
    }

    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}

export const Clangd: Info = {
  id: "clangd",
  root: nearestRoot(["compile_commands.json", "compile_flags.txt", ".clangd", "CMakeLists.txt", "Makefile"]),
  extensions: [".c", ".cpp", ".cc", ".cxx", ".c++", ".h", ".hpp", ".hh", ".hxx", ".h++"],
  async spawn(root) {
    const args = ["--background-index", "--clang-tidy"]
    const fromPath = which("clangd")
    if (fromPath) return { process: spawn(fromPath, args, { cwd: root }) }

    const ext = process.platform === "win32" ? ".exe" : ""
    const direct = path.join(Global.Path.bin, "clangd" + ext)
    if (await Filesystem.exists(direct)) return { process: spawn(direct, args, { cwd: root }) }

    const entries = await fs.readdir(Global.Path.bin, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith("clangd_")) continue
      const candidate = path.join(Global.Path.bin, entry.name, "bin", "clangd" + ext)
      if (await Filesystem.exists(candidate)) return { process: spawn(candidate, args, { cwd: root }) }
    }

    if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
    const rel = await fetch("https://api.github.com/repos/clangd/clangd/releases/latest")
    if (!rel.ok) return
    const release = parseRelease(await rel.json())
    const tag = release.tag_name
    if (!tag) return

    const token =
      process.platform === "darwin"
        ? "mac"
        : process.platform === "linux"
          ? "linux"
          : process.platform === "win32"
            ? "windows"
            : undefined
    if (!token) return

    const valid = (name: string) => name.includes(token) && name.includes(tag)
    const asset =
      release.assets.find((x) => valid(x.name) && x.name.endsWith(".zip")) ??
      release.assets.find((x) => valid(x.name) && x.name.endsWith(".tar.xz")) ??
      release.assets.find((x) => valid(x.name))
    if (!asset) return

    const archive = path.join(Global.Path.bin, asset.name)
    const ok = await download(asset.browser_download_url, archive)
    if (!ok) return

    const kind = asset.name.endsWith(".zip") ? "zip" : asset.name.endsWith(".tar.xz") ? "tar.xz" : undefined
    if (!kind) return
    const extracted = await extract({ file: archive, dir: Global.Path.bin, kind, name: "clangd" })
    if (!extracted) return
    await fs.rm(archive, { force: true })

    const bin = path.join(Global.Path.bin, "clangd_" + tag, "bin", "clangd" + ext)
    if (!(await Filesystem.exists(bin))) return
    if (!(await ensureExec(bin))) return
    await fs.unlink(path.join(Global.Path.bin, "clangd")).catch(() => {})
    await fs.symlink(bin, path.join(Global.Path.bin, "clangd")).catch(() => {})

    return {
      process: spawn(bin, args, { cwd: root }),
    }
  },
}

export const LuaLS: Info = {
  id: "lua-ls",
  root: nearestRoot([
    ".luarc.json",
    ".luarc.jsonc",
    ".luacheckrc",
    ".stylua.toml",
    "stylua.toml",
    "selene.toml",
    "selene.yml",
  ]),
  extensions: [".lua"],
  async spawn(root) {
    let bin = which("lua-language-server", withGlobalBinPath())
    if (!bin) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const rel = await fetch("https://api.github.com/repos/LuaLS/lua-language-server/releases/latest")
      if (!rel.ok) return
      const release = parseRelease(await rel.json())

      const platform = process.platform
      const arch = process.arch
      const larch = arch === "arm64" ? "arm64" : arch === "x64" ? "x64" : arch === "ia32" ? "ia32" : arch
      const lplat = platform === "darwin" ? "darwin" : platform === "linux" ? "linux" : "win32"
      const ext = platform === "win32" ? "zip" : "tar.gz"
      const name = `lua-language-server-${release.tag_name}-${lplat}-${larch}.${ext}`
      const suffix = `${lplat}-${larch}.${ext}`
      const supported = [
        "darwin-arm64.tar.gz",
        "darwin-x64.tar.gz",
        "linux-x64.tar.gz",
        "linux-arm64.tar.gz",
        "win32-x64.zip",
        "win32-ia32.zip",
      ]
      if (!supported.includes(suffix)) return

      const asset = release.assets.find((x) => x.name === name)
      if (!asset) return
      const tmp = path.join(Global.Path.bin, name)
      const ok = await download(asset.browser_download_url, tmp)
      if (!ok) return

      const dir = path.join(Global.Path.bin, `lua-language-server-${larch}-${lplat}`)
      if (await fs.stat(dir).catch(() => undefined)) await fs.rm(dir, { force: true, recursive: true })
      await fs.mkdir(dir, { recursive: true })

      const extracted = await extract({
        file: tmp,
        dir,
        kind: ext === "zip" ? "zip" : "tar.gz",
        name: "lua-language-server",
      })
      if (!extracted) return
      await fs.rm(tmp, { force: true })

      bin = path.join(dir, "bin", "lua-language-server" + (platform === "win32" ? ".exe" : ""))
      if (!(await Filesystem.exists(bin))) return
      if (!(await ensureExec(bin))) return
    }

    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}

export const TerraformLS: Info = {
  id: "terraform",
  extensions: [".tf", ".tfvars"],
  root: nearestRoot([".terraform.lock.hcl", "terraform.tfstate", "*.tf"]),
  async spawn(root) {
    let bin = which("terraform-ls", withGlobalBinPath())
    if (!bin) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const rel = await fetch("https://api.releases.hashicorp.com/v1/releases/terraform-ls/latest")
      if (!rel.ok) return
      const release = parseTerraform(await rel.json())
      const arch = process.arch === "arm64" ? "arm64" : "amd64"
      const os = process.platform === "win32" ? "windows" : process.platform
      const build = release.builds.find((x) => x.arch === arch && x.os === os)
      if (!build) return
      const tmp = path.join(Global.Path.bin, "terraform-ls.zip")
      const ok = await download(build.url, tmp)
      if (!ok) return
      const extracted = await extract({ file: tmp, dir: Global.Path.bin, kind: "zip", name: "terraform-ls" })
      if (!extracted) return
      await fs.rm(tmp, { force: true })

      bin = path.join(Global.Path.bin, "terraform-ls" + (process.platform === "win32" ? ".exe" : ""))
      if (!(await Filesystem.exists(bin))) return
      if (!(await ensureExec(bin))) return
    }

    return {
      process: spawn(bin, ["serve"], { cwd: root }),
      initialization: {
        experimentalFeatures: {
          prefillRequiredFields: true,
          validateOnSave: true,
        },
      },
    }
  },
}

export const TexLab: Info = {
  id: "texlab",
  extensions: [".tex", ".bib"],
  root: nearestRoot([".latexmkrc", "latexmkrc", ".texlabroot", "texlabroot"]),
  async spawn(root) {
    let bin = which("texlab", withGlobalBinPath())
    if (!bin) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const rel = await fetch("https://api.github.com/repos/latex-lsp/texlab/releases/latest")
      if (!rel.ok) return
      const release = parseRelease(await rel.json())
      const platform = process.platform
      const arch = process.arch === "arm64" ? "aarch64" : "x86_64"
      const os = platform === "darwin" ? "macos" : platform === "win32" ? "windows" : "linux"
      const ext = platform === "win32" ? "zip" : "tar.gz"
      const name = `texlab-${arch}-${os}.${ext}`
      const asset = release.assets.find((x) => x.name === name)
      if (!asset) return
      const tmp = path.join(Global.Path.bin, name)
      const ok = await download(asset.browser_download_url, tmp)
      if (!ok) return
      const extracted = await extract({
        file: tmp,
        dir: Global.Path.bin,
        kind: ext === "zip" ? "zip" : "tar.gz",
        name: "texlab",
      })
      if (!extracted) return
      await fs.rm(tmp, { force: true })

      bin = path.join(Global.Path.bin, "texlab" + (platform === "win32" ? ".exe" : ""))
      if (!(await Filesystem.exists(bin))) return
      if (!(await ensureExec(bin))) return
    }
    return { process: spawn(bin, { cwd: root }) }
  },
}

export const Tinymist: Info = {
  id: "tinymist",
  extensions: [".typ", ".typc"],
  root: nearestRoot(["typst.toml"]),
  async spawn(root) {
    let bin = which("tinymist", withGlobalBinPath())
    if (!bin) {
      if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
      const rel = await fetch("https://api.github.com/repos/Myriad-Dreamin/tinymist/releases/latest")
      if (!rel.ok) return
      const release = parseRelease(await rel.json())

      const platform = process.platform
      const arch = process.arch === "arm64" ? "aarch64" : "x86_64"
      const os = platform === "darwin" ? "apple-darwin" : platform === "win32" ? "pc-windows-msvc" : "unknown-linux-gnu"
      const ext = platform === "win32" ? "zip" : "tar.gz"
      const name = `tinymist-${arch}-${os}.${ext}`
      const asset = release.assets.find((x) => x.name === name)
      if (!asset) return

      const tmp = path.join(Global.Path.bin, name)
      const ok = await download(asset.browser_download_url, tmp)
      if (!ok) return
      const extracted = await extract({
        file: tmp,
        dir: Global.Path.bin,
        kind: ext === "zip" ? "zip" : "tar.gz",
        strip: ext === "zip" ? undefined : 1,
        name: "tinymist",
      })
      if (!extracted) return
      await fs.rm(tmp, { force: true })

      bin = path.join(Global.Path.bin, "tinymist" + (platform === "win32" ? ".exe" : ""))
      if (!(await Filesystem.exists(bin))) return
      if (!(await ensureExec(bin))) return
    }

    return {
      process: spawn(bin, { cwd: root }),
    }
  },
}
