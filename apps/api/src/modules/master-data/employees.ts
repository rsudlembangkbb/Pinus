import { and, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { employeeSchema } from "@pinus/shared";
import { schema, type Database } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { offsetFor, parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const employeeRoutes = new Hono<AppEnv>();
employeeRoutes.use("*", requireAuth);

employeeRoutes.get("/", requirePermission("master.employee.read"), async (c) => {
  const db = c.get("db");
  const { page, pageSize, search } = parsePagination(c);
  const category = c.req.query("category");
  const workUnitId = c.req.query("workUnitId");

  const conditions = [
    search ? or(like(schema.employees.fullName, `%${search}%`), like(schema.employees.nip, `%${search}%`)) : undefined,
    category ? eq(schema.employees.category, category) : undefined,
    workUnitId ? eq(schema.employees.workUnitId, workUnitId) : undefined,
  ].filter(Boolean);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(schema.employees)
    .where(where)
    .orderBy(schema.employees.fullName)
    .limit(pageSize)
    .offset(offsetFor(page, pageSize));
  const totalRows = await db.select({ id: schema.employees.id }).from(schema.employees).where(where);

  return c.json({ items, total: totalRows.length, page, pageSize });
});

employeeRoutes.get("/:id", requirePermission("master.employee.read"), async (c) => {
  const db = c.get("db");
  const row = await db.query.employees.findFirst({ where: eq(schema.employees.id, c.req.param("id")) });
  if (!row) throw Errors.notFound("Pegawai");
  return c.json(row);
});

async function assertReferencesExist(db: Database, workUnitId: string, jobGradeId: string | null | undefined) {
  const unit = await db.query.workUnits.findFirst({ where: eq(schema.workUnits.id, workUnitId) });
  if (!unit) throw Errors.badRequest("Unit kerja tidak ditemukan");
  if (jobGradeId) {
    const grade = await db.query.jobGrades.findFirst({ where: eq(schema.jobGrades.id, jobGradeId) });
    if (!grade) throw Errors.badRequest("Job grade tidak ditemukan");
  }
}

employeeRoutes.post("/", requirePermission("master.employee.write"), async (c) => {
  const body = employeeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data pegawai tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;

  await assertReferencesExist(db, body.data.workUnitId, body.data.jobGradeId);
  const existing = await db.query.employees.findFirst({ where: eq(schema.employees.nip, body.data.nip) });
  if (existing) throw Errors.conflict("NIP/NIK sudah terdaftar");

  const id = newId();
  await db.insert(schema.employees).values({
    id,
    ...body.data,
    profession: body.data.profession ?? null,
    positionTitle: body.data.positionTitle ?? null,
    jobGradeId: body.data.jobGradeId ?? null,
  });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "employee",
    entityId: id,
    after: body.data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.employees.findFirst({ where: eq(schema.employees.id, id) });
  return c.json(row, 201);
});

employeeRoutes.put("/:id", requirePermission("master.employee.write"), async (c) => {
  const body = employeeSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data pegawai tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");

  const before = await db.query.employees.findFirst({ where: eq(schema.employees.id, id) });
  if (!before) throw Errors.notFound("Pegawai");

  if (body.data.workUnitId || body.data.jobGradeId !== undefined) {
    await assertReferencesExist(db, body.data.workUnitId ?? before.workUnitId, body.data.jobGradeId ?? before.jobGradeId);
  }

  await db
    .update(schema.employees)
    .set({ ...body.data, updatedAt: new Date().toISOString() })
    .where(eq(schema.employees.id, id));

  const after = await db.query.employees.findFirst({ where: eq(schema.employees.id, id) });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "employee",
    entityId: id,
    before,
    after,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json(after);
});
