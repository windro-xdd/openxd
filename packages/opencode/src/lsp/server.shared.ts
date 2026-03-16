import path from "path"
import fs from "fs/promises"
import { text } from "node:stream/consumers"
import { Global } from "../global"
import { Log } from "../util/log"
import { Process } from "../util/process"
import { Archive } from "../util/archive"
import { Filesystem } from "../util/filesystem"
import { Instance } from "../project/instance"

export const log = Log.create({ service: "lsp.server" })

export const pathExists = async (p: string) =>
  fs
    .stat(p)
    .then(() => true)
    .catch(() => false)

export const run = (cmd: string[], opts: Process.RunOptions = {}) => Process.run(cmd, { ...opts, nothrow: true })

export const output = (cmd: string[], opts: Process.RunOptions = {}) => Process.text(cmd, { ...opts, nothrow: true })

export const bunEnv = () => ({
  ...process.env,
  BUN_BE_BUN: "1",
})

export const nearestRoot = (include: string[], exclude?: string[]) => {
  return async (file: string) => {
    if (exclude) {
      const blocked = Filesystem.up({
        targets: exclude,
        start: path.dirname(file),
        stop: Instance.directory,
      })
      const hit = await blocked.next()
      await blocked.return()
      if (hit.value) return undefined
    }

    const files = Filesystem.up({
      targets: include,
      start: path.dirname(file),
      stop: Instance.directory,
    })
    const first = await files.next()
    await files.return()
    if (!first.value) return Instance.directory
    return path.dirname(first.value)
  }
}

export const resolveUp = async (root: string, target: string, stop = Instance.worktree) => {
  const local = path.join(root, target)
  if (await Filesystem.exists(local)) return local
  const files = Filesystem.up({
    targets: [target],
    start: root,
    stop,
  })
  const first = await files.next()
  await files.return()
  return first.value
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object"

const str = (x: unknown) => (typeof x === "string" ? x : undefined)

export interface ReleaseAsset {
  name: string
  browser_download_url: string
}

export interface Release {
  tag_name?: string
  name?: string
  assets: ReleaseAsset[]
}

export const parseRelease = (x: unknown): Release => {
  if (!isObj(x)) return { assets: [] }
  const list = Array.isArray(x.assets) ? x.assets : []
  const assets = list
    .filter(isObj)
    .map((item) => {
      const name = str(item.name)
      const url = str(item.browser_download_url)
      if (!name || !url) return undefined
      return { name, browser_download_url: url }
    })
    .filter((item): item is ReleaseAsset => !!item)
  return {
    tag_name: str(x.tag_name),
    name: str(x.name),
    assets,
  }
}

export const download = async (url: string, dest: string) => {
  const res = await fetch(url)
  if (!res.ok || !res.body) return false
  await Filesystem.writeStream(dest, res.body)
  return true
}

export const extract = async (input: {
  file: string
  dir: string
  kind: "zip" | "tar.gz" | "tar.xz"
  strip?: number
  name: string
}) => {
  if (input.kind === "zip") {
    const ok = await Archive.extractZip(input.file, input.dir)
      .then(() => true)
      .catch((error) => {
        log.error(`Failed to extract ${input.name} archive`, { error })
        return false
      })
    return ok
  }

  const args = ["tar", "-xf", input.file]
  if (input.kind === "tar.gz") args[1] = "-xzf"
  if (input.strip != null) args.push(`--strip-components=${input.strip}`)
  const rs = await run(args, { cwd: input.dir })
  return rs.code === 0
}

export const ensureExec = async (bin: string) => {
  if (process.platform === "win32") return true
  return fs
    .chmod(bin, 0o755)
    .then(() => true)
    .catch(() => false)
}

export const readHelp = async (bin: string) => {
  const proc = Process.spawn([bin, "--help"], { stdout: "pipe" })
  await proc.exited
  if (!proc.stdout) return ""
  return text(proc.stdout)
}

export const withGlobalBinPath = () => ({
  PATH: (process.env["PATH"] ?? "") + path.delimiter + Global.Path.bin,
})
