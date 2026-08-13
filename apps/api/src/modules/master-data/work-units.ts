import { eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { workUnitSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { offsetFor, parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const workUnitRoutes = new Hono<AppEnv>();
workUnitRoutes.use("*", requireAuth);

workUnitRoutes.get("/", requirePermission("master.work_unit.read"), async (c) => {
  const db = c.get("db");
  const { page, pageSize, search } = parsePagination(c);
  const where = search ? or(like(schema.workUnits.name, `%${search}%`), like(schema.workUnits.code, `%${search}%`)) : undefined;

  const items = await db
    .select()
    .from(schema.workUnits)
    .where(where)
    .orderBy(schema.workUnits.name)
    .limit(pageSize)
    .offset(offsetFor(page, pageSize));
  const totalRows = await db.select({ id: schema.workUnits.id }).from(schema.workUnits).where(where);

  return c.json({ items, total: totalRows.length, page, pageSize });
});

workUnitRoutes.get("/:id", requirePermission("master.work_unit.read"), async (c) => {
  const db = c.get("db");
  const row = await db.query.workUnits.findFirst({ where: eq(schema.workUnits.id, c.req.param("id")) });
  if (!row) throw Errors.notFound("Unit kerja");
  return c.json(row);
});

workUnitRoutes.post("/", requirePermission("master.work_unit.write"), async (c) => {
  const body = workUnitSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data unit kerja tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;

  const existing = await db.query.workUnits.findFirst({ where: eq(schema.workUnits.code, body.data.code) });
  if (existing) throw Errors.conflict("Kode unit kerja sudah digunakan");

  const id = newId();
  await db.insert(schema.workUnits).values({ id, ...body.data });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "work_unit",
    entityId: id,
    after: body.data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.workUnits.findFirst({ where: eq(schema.workUnits.id, id) });
  return c.json(row, 201);
});

workUnitRoutes.put("/:id", requirePermission("master.work_unit.write"), async (c) => {
  const body = workUnitSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data unit kerja tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");

  const before = await db.query.workUnits.findFirst({ where: eq(schema.workUnits.id, id) });
  if (!before) throw Errors.notFound("Unit kerja");

  await db
    .update(schema.workUnits)
    .set({ ...body.data, updatedAt: new Date().toISOString() })
    .where(eq(schema.workUnits.id, id));

  const after = await db.query.workUnits.findFirst({ where: eq(schema.workUnits.id, id) });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "work_unit",
    entityId: id,
    before,
    after,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json(after);
});
