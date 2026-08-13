import { eq, like } from "drizzle-orm";
import { Hono } from "hono";
import { jobGradeSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const jobGradeRoutes = new Hono<AppEnv>();
jobGradeRoutes.use("*", requireAuth);

jobGradeRoutes.get("/", requirePermission("master.job_grade.read"), async (c) => {
  const db = c.get("db");
  const { search } = parsePagination(c);
  const rows = search
    ? await db.select().from(schema.jobGrades).where(like(schema.jobGrades.name, `%${search}%`))
    : await db.select().from(schema.jobGrades);
  return c.json({ items: rows.sort((a, b) => a.name.localeCompare(b.name)) });
});

jobGradeRoutes.post("/", requirePermission("master.job_grade.write"), async (c) => {
  const body = jobGradeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data job grade tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;

  const existing = await db.query.jobGrades.findFirst({ where: eq(schema.jobGrades.code, body.data.code) });
  if (existing) throw Errors.conflict("Kode job grade sudah digunakan");

  const id = newId();
  await db.insert(schema.jobGrades).values({ id, ...body.data, description: body.data.description ?? null });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "job_grade",
    entityId: id,
    after: body.data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.jobGrades.findFirst({ where: eq(schema.jobGrades.id, id) });
  return c.json(row, 201);
});

jobGradeRoutes.put("/:id", requirePermission("master.job_grade.write"), async (c) => {
  const body = jobGradeSchema.partial().safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data job grade tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");

  const before = await db.query.jobGrades.findFirst({ where: eq(schema.jobGrades.id, id) });
  if (!before) throw Errors.notFound("Job grade");

  await db.update(schema.jobGrades).set(body.data).where(eq(schema.jobGrades.id, id));
  const after = await db.query.jobGrades.findFirst({ where: eq(schema.jobGrades.id, id) });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "job_grade",
    entityId: id,
    before,
    after,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json(after);
});
