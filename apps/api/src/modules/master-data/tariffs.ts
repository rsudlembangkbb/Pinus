import { eq, like } from "drizzle-orm";
import { Hono } from "hono";
import { tariffSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const tariffRoutes = new Hono<AppEnv>();
tariffRoutes.use("*", requireAuth);

tariffRoutes.get("/", requirePermission("master.tariff.read"), async (c) => {
  const db = c.get("db");
  const { search } = parsePagination(c);
  const rows = search
    ? await db.select().from(schema.tariffs).where(like(schema.tariffs.name, `%${search}%`))
    : await db.select().from(schema.tariffs);
  return c.json({ items: rows.sort((a, b) => a.name.localeCompare(b.name)) });
});

tariffRoutes.post("/", requirePermission("master.tariff.write"), async (c) => {
  const body = tariffSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data tarif tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;

  const existing = await db.query.tariffs.findFirst({ where: eq(schema.tariffs.code, body.data.code) });
  if (existing) throw Errors.conflict("Kode tarif/layanan sudah digunakan");

  const id = newId();
  await db.insert(schema.tariffs).values({ id, ...body.data });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "tariff",
    entityId: id,
    after: body.data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.tariffs.findFirst({ where: eq(schema.tariffs.id, id) });
  return c.json(row, 201);
});

tariffRoutes.put("/:id", requirePermission("master.tariff.write"), async (c) => {
  const body = tariffSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data tarif tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");

  const before = await db.query.tariffs.findFirst({ where: eq(schema.tariffs.id, id) });
  if (!before) throw Errors.notFound("Tarif");

  await db.update(schema.tariffs).set(body.data).where(eq(schema.tariffs.id, id));
  const after = await db.query.tariffs.findFirst({ where: eq(schema.tariffs.id, id) });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "tariff",
    entityId: id,
    before,
    after,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json(after);
});
