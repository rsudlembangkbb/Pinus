import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { Errors } from "../../lib/errors.js";
import { currentUser, requireAuth } from "../../middleware/auth.js";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth);

notificationRoutes.get("/", async (c) => {
  const db = c.get("db");
  const user = currentUser(c);
  const rows = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(50);
  return c.json({ items: rows, unreadCount: rows.filter((r) => !r.isRead).length });
});

notificationRoutes.post("/:id/read", async (c) => {
  const db = c.get("db");
  const user = currentUser(c);
  const id = c.req.param("id");
  const row = await db.query.notifications.findFirst({ where: eq(schema.notifications.id, id) });
  if (!row || row.userId !== user.id) throw Errors.notFound("Notifikasi");
  await db.update(schema.notifications).set({ isRead: true }).where(eq(schema.notifications.id, id));
  return c.json({ ok: true });
});

notificationRoutes.post("/read-all", async (c) => {
  const db = c.get("db");
  const user = currentUser(c);
  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(and(eq(schema.notifications.userId, user.id), eq(schema.notifications.isRead, false)));
  return c.json({ ok: true });
});
