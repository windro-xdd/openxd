import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"
import { Workspace } from "../../control-plane/workspace"
import { Project } from "../../project/project"
import { Installation } from "../../installation"
import { TelegramBot } from "../../telegram/bot"
import { Heartbeat } from "../../daemon/heartbeat"
import { BrowserRelay } from "../../browser/relay"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const opts = await resolveNetworkOptions(args)
    const server = Server.listen(opts)
    console.log(`opencode server listening on http://${server.hostname}:${server.port}`)

    // Start Telegram bot if configured
    await TelegramBot.start()

    // Start heartbeat if configured
    await Heartbeat.start()

    // Start browser relay if configured
    await BrowserRelay.start()

    await new Promise(() => {})

    BrowserRelay.stop()
    Heartbeat.stop()
    TelegramBot.stop()
    await server.stop()
  },
})
