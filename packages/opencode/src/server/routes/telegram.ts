import { Hono } from "hono"
import { TelegramState } from "../../telegram/state"

export function TelegramRoutes() {
  const app = new Hono()

  // POST /telegram/pair { code: "ABC123" }
  app.post("/pair", async (c) => {
    const body = await c.req.json<{ code: string }>()
    if (!body.code) {
      return c.json({ error: "Missing pairing code" }, 400)
    }
    const result = TelegramState.approvePairing(body.code)
    if (!result.success) {
      return c.json({ error: "Invalid or expired pairing code" }, 404)
    }
    return c.json({
      success: true,
      userId: result.userId,
      username: result.username,
      firstName: result.firstName,
    })
  })

  // GET /telegram/users
  app.get("/users", (c) => {
    return c.json({ users: TelegramState.listPairedUsers() })
  })

  // DELETE /telegram/users/:userId
  app.delete("/users/:userId", (c) => {
    const userId = parseInt(c.req.param("userId"))
    if (isNaN(userId)) return c.json({ error: "Invalid user ID" }, 400)
    const removed = TelegramState.removePairedUser(userId)
    return c.json({ success: removed })
  })

  // GET /telegram/pending
  app.get("/pending", (c) => {
    return c.json({ pending: TelegramState.getPendingPairings() })
  })

  return app
}
