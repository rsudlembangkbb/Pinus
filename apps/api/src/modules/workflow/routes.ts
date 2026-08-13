import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { approvalActionSchema, createPeriodSchema, PERIOD_STATUS_LABELS } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { notifyByRole, notifyByWorkUnit, notifyUsers } from "../../lib/notify.js";
import { offsetFor, parsePagination } from "../../lib/pagination.js";
import { requireAuth } from "../../middleware/auth.js";
import { assertWorkUnitAccess, requirePermission } from "../../middleware/rbac.js";

export const workflowRoutes = new Hono<AppEnv>();
workflowRoutes.use("*", requireAuth);

function periodCode(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}
const MONTH_LABELS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

workflowRoutes.get("/periods", requirePermission("workflow.read"), async (c) => {
  const db = c.get("db");
  const { page, pageSize } = parsePagination(c);
  const status = c.req.query("status");
  const conditions = [status ? eq(schema.calculationPeriods.status, status) : undefined].filter(Boolean);
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const items = await db
    .select()
    .from(schema.calculationPeriods)
    .where(where)
    .orderBy(schema.calculationPeriods.code)
    .limit(pageSize)
    .offset(offsetFor(page, pageSize));
  return c.json({ items: items.reverse(), page, pageSize });
});

workflowRoutes.get("/periods/:id", requirePermission("workflow.read"), async (c) => {
  const db = c.get("db");
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, c.req.param("id")) });
  if (!period) throw Errors.notFound("Periode");
  const steps = await db.select().from(schema.approvalSteps).where(eq(schema.approvalSteps.periodId, period.id));
  return c.json({ period, approvalSteps: steps });
});

workflowRoutes.post("/periods", requirePermission("workflow.manage_period"), async (c) => {
  const body = createPeriodSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data periode tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const code = periodCode(body.data.year, body.data.month);

  const existing = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.code, code) });
  if (existing) throw Errors.conflict(`Periode ${code} sudah ada`);

  const id = newId();
  await db.insert(schema.calculationPeriods).values({
    id,
    code,
    label: `${MONTH_LABELS[body.data.month - 1]} ${body.data.year}`,
    year: body.data.year,
    month: body.data.month,
    status: "DRAFT",
    paguAmount: body.data.paguAmount ?? null,
    administrasiAllocationAmount: body.data.administrasiAllocationAmount ?? null,
    exemptMinimumFromAdjustment: body.data.exemptMinimumFromAdjustment,
    notes: body.data.notes ?? null,
    openedBy: user.id,
  });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "calculation_period",
    entityId: id,
    after: body.data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  return c.json(row, 201);
});

workflowRoutes.post("/periods/:id/submit-for-verification", requirePermission("workflow.manage_period"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period) throw Errors.notFound("Periode");
  if (period.status !== "DIPROSES") {
    throw Errors.conflict(`Periode harus berstatus DIPROSES (sudah dikalkulasi) sebelum diajukan verifikasi. Status saat ini: ${PERIOD_STATUS_LABELS[period.status as keyof typeof PERIOD_STATUS_LABELS]}`);
  }

  const resultsUnits = await db
    .select({ workUnitId: schema.employees.workUnitId })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.employees.id, schema.calculationResults.employeeId))
    .where(eq(schema.calculationResults.periodId, id));
  const distinctUnitIds = [...new Set(resultsUnits.map((r) => r.workUnitId))];
  if (distinctUnitIds.length === 0) throw Errors.conflict("Tidak ada hasil kalkulasi untuk periode ini");

  for (const workUnitId of distinctUnitIds) {
    await db.insert(schema.approvalSteps).values({
      id: newId(),
      periodId: id,
      stage: "VERIFIKASI_UNIT",
      workUnitId,
      status: "PENDING",
    });
    await notifyByWorkUnit(db, workUnitId, {
      kind: "APPROVAL_REQUIRED",
      title: `Verifikasi Jaspel ${period.label} menunggu Anda`,
      body: `Data Jaspel unit Anda untuk periode ${period.label} siap diverifikasi.`,
      relatedPeriodId: id,
    });
  }

  await db.update(schema.calculationPeriods).set({ status: "MENUNGGU_VERIFIKASI_UNIT" }).where(eq(schema.calculationPeriods.id, id));
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "calculation_period",
    entityId: id,
    before: { status: period.status },
    after: { status: "MENUNGGU_VERIFIKASI_UNIT" },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  const updated = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  return c.json(updated);
});

async function sendBackToDraft(db: AppEnv["Variables"]["db"], periodId: string, note: string | null | undefined) {
  await db.update(schema.calculationPeriods).set({ status: "DRAFT" }).where(eq(schema.calculationPeriods.id, periodId));
  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, periodId) });
  await notifyByRole(db, "ADMIN_JASPEL", {
    kind: "REJECTED",
    title: `Periode ${period?.label} dikembalikan untuk perbaikan`,
    body: note ?? "Data perlu diperbaiki sebelum diajukan kembali.",
    relatedPeriodId: periodId,
  });
}

workflowRoutes.post("/periods/:id/verify/unit/:workUnitId", requirePermission("workflow.verify_unit"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const workUnitId = c.req.param("workUnitId");
  assertWorkUnitAccess(user, workUnitId);

  const body = approvalActionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data keputusan verifikasi tidak valid", body.error.flatten());

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period || period.status !== "MENUNGGU_VERIFIKASI_UNIT") throw Errors.conflict("Periode tidak sedang menunggu verifikasi unit");

  const step = await db.query.approvalSteps.findFirst({
    where: and(eq(schema.approvalSteps.periodId, id), eq(schema.approvalSteps.stage, "VERIFIKASI_UNIT"), eq(schema.approvalSteps.workUnitId, workUnitId)),
  });
  if (!step) throw Errors.notFound("Tahap verifikasi unit");
  if (step.status !== "PENDING") throw Errors.conflict("Tahap verifikasi ini sudah diputuskan");

  await db
    .update(schema.approvalSteps)
    .set({ status: body.data.status, actedByUserId: user.id, actedByName: user.fullName, actedAt: new Date().toISOString(), note: body.data.note ?? null })
    .where(eq(schema.approvalSteps.id, step.id));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: body.data.status === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "approval_step",
    entityId: step.id,
    after: { stage: "VERIFIKASI_UNIT", workUnitId, status: body.data.status, note: body.data.note },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  if (body.data.status === "REJECTED") {
    await sendBackToDraft(db, id, body.data.note);
  } else {
    const allSteps = await db
      .select()
      .from(schema.approvalSteps)
      .where(and(eq(schema.approvalSteps.periodId, id), eq(schema.approvalSteps.stage, "VERIFIKASI_UNIT")));
    const allApproved = allSteps.every((s) => s.id === step.id || s.status === "APPROVED");
    if (allApproved) {
      await db.insert(schema.approvalSteps).values({ id: newId(), periodId: id, stage: "VERIFIKASI_KEUANGAN", status: "PENDING" });
      await db.update(schema.calculationPeriods).set({ status: "MENUNGGU_VERIFIKASI_KEUANGAN" }).where(eq(schema.calculationPeriods.id, id));
      await notifyByRole(db, "KEUANGAN", {
        kind: "APPROVAL_REQUIRED",
        title: `Verifikasi Keuangan ${period.label} menunggu Anda`,
        body: "Seluruh unit telah memverifikasi data Jaspel periode ini.",
        relatedPeriodId: id,
      });
    }
  }

  const updated = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  return c.json(updated);
});

workflowRoutes.post("/periods/:id/verify/keuangan", requirePermission("workflow.verify_keuangan"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = approvalActionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data keputusan verifikasi tidak valid", body.error.flatten());

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period || period.status !== "MENUNGGU_VERIFIKASI_KEUANGAN") throw Errors.conflict("Periode tidak sedang menunggu verifikasi keuangan");

  const step = await db.query.approvalSteps.findFirst({
    where: and(eq(schema.approvalSteps.periodId, id), eq(schema.approvalSteps.stage, "VERIFIKASI_KEUANGAN"), eq(schema.approvalSteps.status, "PENDING")),
  });
  if (!step) throw Errors.notFound("Tahap verifikasi keuangan");

  await db
    .update(schema.approvalSteps)
    .set({ status: body.data.status, actedByUserId: user.id, actedByName: user.fullName, actedAt: new Date().toISOString(), note: body.data.note ?? null })
    .where(eq(schema.approvalSteps.id, step.id));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: body.data.status === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "approval_step",
    entityId: step.id,
    after: { stage: "VERIFIKASI_KEUANGAN", status: body.data.status, note: body.data.note },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  if (body.data.status === "REJECTED") {
    await sendBackToDraft(db, id, body.data.note);
  } else {
    await db.insert(schema.approvalSteps).values({ id: newId(), periodId: id, stage: "PERSETUJUAN_DIREKTUR", status: "PENDING" });
    await db.update(schema.calculationPeriods).set({ status: "MENUNGGU_PERSETUJUAN_DIREKTUR" }).where(eq(schema.calculationPeriods.id, id));
    await notifyByRole(db, "DIREKTUR", {
      kind: "APPROVAL_REQUIRED",
      title: `Persetujuan akhir ${period.label} menunggu Anda`,
      body: "Bagian Keuangan telah memverifikasi kesesuaian pagu Jaspel periode ini.",
      relatedPeriodId: id,
    });
  }

  const updated = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  return c.json(updated);
});

workflowRoutes.post("/periods/:id/verify/direktur", requirePermission("workflow.approve_direktur"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = approvalActionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data keputusan persetujuan tidak valid", body.error.flatten());

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period || period.status !== "MENUNGGU_PERSETUJUAN_DIREKTUR") throw Errors.conflict("Periode tidak sedang menunggu persetujuan direktur");

  const step = await db.query.approvalSteps.findFirst({
    where: and(eq(schema.approvalSteps.periodId, id), eq(schema.approvalSteps.stage, "PERSETUJUAN_DIREKTUR"), eq(schema.approvalSteps.status, "PENDING")),
  });
  if (!step) throw Errors.notFound("Tahap persetujuan direktur");

  await db
    .update(schema.approvalSteps)
    .set({ status: body.data.status, actedByUserId: user.id, actedByName: user.fullName, actedAt: new Date().toISOString(), note: body.data.note ?? null })
    .where(eq(schema.approvalSteps.id, step.id));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: body.data.status === "APPROVED" ? "APPROVE" : "REJECT",
    entityType: "approval_step",
    entityId: step.id,
    after: { stage: "PERSETUJUAN_DIREKTUR", status: body.data.status, note: body.data.note },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  if (body.data.status === "REJECTED") {
    await sendBackToDraft(db, id, body.data.note);
  } else {
    const now = new Date().toISOString();
    await db.update(schema.calculationPeriods).set({ status: "FINAL", lockedAt: now, lockedBy: user.id }).where(eq(schema.calculationPeriods.id, id));
    await recordAudit(db, {
      actorUserId: user.id,
      actorName: user.fullName,
      action: "LOCK",
      entityType: "calculation_period",
      entityId: id,
      after: { status: "FINAL", lockedAt: now },
      ipAddress: clientIp(c),
      userAgent: clientUserAgent(c),
    });

    const employeeIds = await db
      .select({ employeeId: schema.calculationResults.employeeId })
      .from(schema.calculationResults)
      .where(eq(schema.calculationResults.periodId, id));
    const employeeIdSet = new Set(employeeIds.map((e) => e.employeeId));
    const usersWithEmployee = await db
      .select({ id: schema.users.id, employeeId: schema.users.employeeId })
      .from(schema.users)
      .where(eq(schema.users.isActive, true));
    const publishTargets = usersWithEmployee.filter((u) => u.employeeId && employeeIdSet.has(u.employeeId)).map((u) => u.id);
    await notifyUsers(db, publishTargets, {
      kind: "PUBLISHED",
      title: `Jaspel ${period.label} telah dipublikasikan`,
      body: "Rincian Jaspel Anda untuk periode ini sudah dapat dilihat pada dashboard transparansi.",
      relatedPeriodId: id,
    });
  }

  const updated = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  return c.json(updated);
});

workflowRoutes.post("/periods/:id/reopen-correction", requirePermission("workflow.correction"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as { reason?: string };
  if (!body.reason) throw Errors.badRequest("Alasan koreksi wajib diisi");

  const period = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  if (!period) throw Errors.notFound("Periode");
  if (period.status !== "FINAL") throw Errors.conflict("Hanya periode berstatus final yang dapat dibuka untuk koreksi");

  await db
    .update(schema.calculationPeriods)
    .set({ status: "DRAFT", lockedAt: null, lockedBy: null, notes: `[KOREKSI ${new Date().toISOString()}] ${body.reason}\n${period.notes ?? ""}` })
    .where(eq(schema.calculationPeriods.id, id));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UNLOCK",
    entityType: "calculation_period",
    entityId: id,
    before: { status: "FINAL" },
    after: { status: "DRAFT", reason: body.reason },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  const updated = await db.query.calculationPeriods.findFirst({ where: eq(schema.calculationPeriods.id, id) });
  return c.json(updated);
});
