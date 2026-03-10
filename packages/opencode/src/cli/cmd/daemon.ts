import { cmd } from "./cmd"
import path from "path"
import os from "os"
import fs from "fs"
import { Global } from "../../global"

const DAEMON_PORT = 4096
const SERVICE_NAME = "opencode"

function getServicePath(): string {
  const platform = os.platform()
  if (platform === "linux") {
    const dir = path.join(os.homedir(), ".config", "systemd", "user")
    return path.join(dir, `${SERVICE_NAME}.service`)
  }
  if (platform === "darwin") {
    const dir = path.join(os.homedir(), "Library", "LaunchAgents")
    return path.join(dir, `com.${SERVICE_NAME}.daemon.plist`)
  }
  throw new Error(`Unsupported platform: ${platform}. Daemon mode supports Linux (systemd) and macOS (launchd).`)
}

function findOpenCodeBin(): string {
  // Try to find the opencode binary
  const candidates = [
    process.argv[1], // current script
    path.join(os.homedir(), ".local", "bin", "opencode"),
    "/usr/local/bin/opencode",
    "/usr/bin/opencode",
  ]
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate
  }
  // Fallback: assume it's in PATH
  return "opencode"
}

function generateSystemdUnit(bin: string, port: number): string {
  return `[Unit]
Description=OpenCode Server
After=network.target

[Service]
Type=simple
ExecStart=${bin} serve --port ${port}
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
`
}

function generateLaunchdPlist(bin: string, port: number): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.opencode.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>${bin}</string>
    <string>serve</string>
    <string>--port</string>
    <string>${port}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>StandardOutPath</key>
  <string>${path.join(Global.Path.data, "daemon.log")}</string>
  <key>StandardErrorPath</key>
  <string>${path.join(Global.Path.data, "daemon.err")}</string>
</dict>
</plist>
`
}

const InstallCommand = cmd({
  command: "install",
  describe: "Install opencode as a background service (systemd/launchd)",
  builder: (yargs) =>
    yargs.option("port", {
      type: "number",
      describe: "Port for the daemon server",
      default: DAEMON_PORT,
    }),
  handler: async (args) => {
    const servicePath = getServicePath()
    const bin = findOpenCodeBin()
    const port = args.port

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(servicePath), { recursive: true })

    if (os.platform() === "linux") {
      fs.writeFileSync(servicePath, generateSystemdUnit(bin, port))
      console.log(`Systemd service written to ${servicePath}`)
      console.log(`Run these commands to start:`)
      console.log(`  systemctl --user daemon-reload`)
      console.log(`  systemctl --user enable ${SERVICE_NAME}`)
      console.log(`  systemctl --user start ${SERVICE_NAME}`)
    } else if (os.platform() === "darwin") {
      fs.writeFileSync(servicePath, generateLaunchdPlist(bin, port))
      console.log(`LaunchAgent written to ${servicePath}`)
      console.log(`Run this to start:`)
      console.log(`  launchctl load ${servicePath}`)
    }

    console.log(`\nDaemon will listen on port ${port}`)
    console.log(`TUI will auto-attach when daemon is running.`)
  },
})

const UninstallCommand = cmd({
  command: "uninstall",
  describe: "Remove the opencode background service",
  builder: (yargs) => yargs,
  handler: async () => {
    const servicePath = getServicePath()

    if (!fs.existsSync(servicePath)) {
      console.log("No daemon service found. Nothing to uninstall.")
      return
    }

    if (os.platform() === "linux") {
      console.log(`Stopping and disabling service...`)
      const { execSync } = await import("child_process")
      try {
        execSync(`systemctl --user stop ${SERVICE_NAME}`, { stdio: "inherit" })
        execSync(`systemctl --user disable ${SERVICE_NAME}`, { stdio: "inherit" })
      } catch {
        // Service might not be running, that's fine
      }
      fs.unlinkSync(servicePath)
      try {
        execSync(`systemctl --user daemon-reload`, { stdio: "inherit" })
      } catch {
        // ignore
      }
    } else if (os.platform() === "darwin") {
      const { execSync } = await import("child_process")
      try {
        execSync(`launchctl unload ${servicePath}`, { stdio: "inherit" })
      } catch {
        // might not be loaded
      }
      fs.unlinkSync(servicePath)
    }

    console.log(`Daemon service removed.`)
  },
})

const StatusCommand = cmd({
  command: "status",
  describe: "Check if the opencode daemon is running",
  builder: (yargs) =>
    yargs.option("port", {
      type: "number",
      describe: "Port to check",
      default: DAEMON_PORT,
    }),
  handler: async (args) => {
    const port = args.port
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(2000),
      })
      if (response.ok) {
        console.log(`✓ Daemon is running on port ${port}`)
      } else {
        console.log(`✗ Daemon responded but with status ${response.status}`)
      }
    } catch {
      console.log(`✗ Daemon is not running on port ${port}`)

      // Check if service is installed
      const servicePath = getServicePath()
      if (fs.existsSync(servicePath)) {
        console.log(`  Service is installed at ${servicePath}`)
        if (os.platform() === "linux") {
          console.log(`  Start with: systemctl --user start ${SERVICE_NAME}`)
        } else if (os.platform() === "darwin") {
          console.log(`  Start with: launchctl load ${servicePath}`)
        }
      } else {
        console.log(`  Service not installed. Run: opencode daemon install`)
      }
    }
  },
})

export const DaemonCommand = cmd({
  command: "daemon",
  describe: "Manage the opencode background daemon",
  builder: (yargs) =>
    yargs.command(InstallCommand).command(UninstallCommand).command(StatusCommand).demandCommand(),
  handler: async () => {},
})
