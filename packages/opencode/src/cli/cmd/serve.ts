import { Server } from "../../server/server"
import { cmd } from "./cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "../../flag/flag"
import { Instance } from "../../project/instance"
import { TelegramBot } from "../../telegram/bot"
import { Heartbeat } from "../../daemon/heartbeat"
import { BrowserCDP } from "../../browser/cdp"

export const ServeCommand = cmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  handler: async (args) => {
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      console.log("Warning: OPENCODE_SERVER_PASSWORD is not set; server is unsecured.")
    }

    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const opts = await resolveNetworkOptions(args)
        if (!opts.port) opts.port = 4096
        const server = Server.listen(opts)
        console.log(`opencode server listening on http://${server.hostname}:${server.port}`)

        await TelegramBot.start()
        await Heartbeat.start()
        await BrowserCDP.start()

        await new Promise(() => {})

        BrowserCDP.stop()
        Heartbeat.stop()
        TelegramBot.stop()
        await server.stop()
      },
    })
  },
})
