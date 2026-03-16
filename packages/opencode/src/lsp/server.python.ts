import { spawn } from "child_process"
import path from "path"
import { Global } from "../global"
import { BunProc } from "../bun"
import { Filesystem } from "../util/filesystem"
import { Flag } from "../flag/flag"
import { Process } from "../util/process"
import { which } from "../util/which"
import type { Info } from "./server.types"
import { bunEnv, log, nearestRoot } from "./server.shared"

const pythonPath = async (root: string) => {
  const dirs = [process.env["VIRTUAL_ENV"], path.join(root, ".venv"), path.join(root, "venv")].filter(
    (p): p is string => p !== undefined,
  )

  for (const dir of dirs) {
    const win = process.platform === "win32"
    const py = win ? path.join(dir, "Scripts", "python.exe") : path.join(dir, "bin", "python")
    if (await Filesystem.exists(py)) return py
  }
  return undefined
}

const tyPath = async (root: string) => {
  const dirs = [process.env["VIRTUAL_ENV"], path.join(root, ".venv"), path.join(root, "venv")].filter(
    (p): p is string => p !== undefined,
  )
  for (const dir of dirs) {
    const win = process.platform === "win32"
    const ty = win ? path.join(dir, "Scripts", "ty.exe") : path.join(dir, "bin", "ty")
    if (await Filesystem.exists(ty)) return ty
  }
  return undefined
}

export const Ty: Info = {
  id: "ty",
  extensions: [".py", ".pyi"],
  root: nearestRoot([
    "pyproject.toml",
    "ty.toml",
    "setup.py",
    "setup.cfg",
    "requirements.txt",
    "Pipfile",
    "pyrightconfig.json",
  ]),
  async spawn(root) {
    if (!Flag.OPENCODE_EXPERIMENTAL_LSP_TY) return

    let bin = which("ty") ?? undefined
    const init: Record<string, string> = {}
    const py = await pythonPath(root)
    if (py) init["pythonPath"] = py
    if (!bin) bin = await tyPath(root)
    if (!bin) {
      log.error("ty not found, please install ty first")
      return
    }

    return {
      process: spawn(bin, ["server"], { cwd: root }),
      initialization: init,
    }
  },
}

export const Pyright: Info = {
  id: "pyright",
  extensions: [".py", ".pyi"],
  root: nearestRoot(["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile", "pyrightconfig.json"]),
  async spawn(root) {
    let bin = which("pyright-langserver")
    const args: string[] = []
    if (!bin) {
      const js = path.join(Global.Path.bin, "node_modules", "pyright", "dist", "pyright-langserver.js")
      if (!(await Filesystem.exists(js))) {
        if (Flag.OPENCODE_DISABLE_LSP_DOWNLOAD) return
        await Process.spawn([BunProc.which(), "install", "pyright"], {
          cwd: Global.Path.bin,
          env: bunEnv(),
        }).exited
      }
      bin = BunProc.which()
      args.push("run", js)
    }
    args.push("--stdio")

    const init: Record<string, string> = {}
    const py = await pythonPath(root)
    if (py) init["pythonPath"] = py

    return {
      process: spawn(bin, args, {
        cwd: root,
        env: bunEnv(),
      }),
      initialization: init,
    }
  },
}
