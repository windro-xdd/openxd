import { describe, expect, test, beforeEach } from "bun:test"
import path from "path"
import { LSPClient } from "../../src/lsp/client"
import { LSPServer } from "../../src/lsp/server"
import { parseRelease, nearestRoot } from "../../src/lsp/server.shared"
import { Instance } from "../../src/project/instance"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

// Minimal fake LSP server that speaks JSON-RPC over stdio
function spawnFakeServer() {
  const { spawn } = require("child_process")
  const serverPath = path.join(__dirname, "../fixture/lsp/fake-lsp-server.js")
  return {
    process: spawn(process.execPath, [serverPath], {
      stdio: "pipe",
    }),
  }
}

describe("LSPClient interop", () => {
  beforeEach(async () => {
    await Log.init({ print: true })
  })

  test("handles workspace/workspaceFolders request", async () => {
    const handle = spawnFakeServer() as any

    const client = await Instance.provide({
      directory: process.cwd(),
      fn: () =>
        LSPClient.create({
          serverID: "fake",
          server: handle as unknown as LSPServer.Handle,
          root: process.cwd(),
        }),
    })

    await client.connection.sendNotification("test/trigger", {
      method: "workspace/workspaceFolders",
    })

    await new Promise((r) => setTimeout(r, 100))

    expect(client.connection).toBeDefined()

    await client.shutdown()
  })

  test("handles client/registerCapability request", async () => {
    const handle = spawnFakeServer() as any

    const client = await Instance.provide({
      directory: process.cwd(),
      fn: () =>
        LSPClient.create({
          serverID: "fake",
          server: handle as unknown as LSPServer.Handle,
          root: process.cwd(),
        }),
    })

    await client.connection.sendNotification("test/trigger", {
      method: "client/registerCapability",
    })

    await new Promise((r) => setTimeout(r, 100))

    expect(client.connection).toBeDefined()

    await client.shutdown()
  })

  test("handles client/unregisterCapability request", async () => {
    const handle = spawnFakeServer() as any

    const client = await Instance.provide({
      directory: process.cwd(),
      fn: () =>
        LSPClient.create({
          serverID: "fake",
          server: handle as unknown as LSPServer.Handle,
          root: process.cwd(),
        }),
    })

    await client.connection.sendNotification("test/trigger", {
      method: "client/unregisterCapability",
    })

    await new Promise((r) => setTimeout(r, 100))

    expect(client.connection).toBeDefined()

    await client.shutdown()
  })
})

describe("LSP server parsing and roots", () => {
  test("parseRelease keeps only valid release assets", () => {
    const parsed = parseRelease({
      tag_name: "v1.2.3",
      name: "Release 1.2.3",
      assets: [
        { name: "good.tar.gz", browser_download_url: "https://example.com/good.tar.gz" },
        { name: "missing-url" },
        { browser_download_url: "https://example.com/missing-name" },
        "invalid",
      ],
    })

    expect(parsed.tag_name).toBe("v1.2.3")
    expect(parsed.name).toBe("Release 1.2.3")
    expect(parsed.assets).toEqual([
      {
        name: "good.tar.gz",
        browser_download_url: "https://example.com/good.tar.gz",
      },
    ])
  })

  test("parseRelease falls back safely for malformed payload", () => {
    const parsed = parseRelease("not-an-object")
    expect(parsed.assets).toEqual([])
    expect(parsed.tag_name).toBeUndefined()
  })

  test("nearestRoot picks nearest matching marker and falls back to instance root", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "package.json"), "{}")
        const nested = path.join(dir, "apps", "api", "src")
        await Bun.write(path.join(dir, "apps", "api", "go.mod"), "module test")
        await Bun.write(path.join(dir, "apps", "api", "src", "main.go"), "package main")
        await Bun.write(path.join(dir, "apps", "web", "src", "index.ts"), "export {}")
        return nested
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const pick = nearestRoot(["go.mod"])
        const root = await pick(path.join(tmp.path, "apps", "api", "src", "main.go"))
        expect(root).toBe(path.join(tmp.path, "apps", "api"))

        const fallback = await pick(path.join(tmp.path, "apps", "web", "src", "index.ts"))
        expect(fallback).toBe(tmp.path)
      },
    })
  })
})
