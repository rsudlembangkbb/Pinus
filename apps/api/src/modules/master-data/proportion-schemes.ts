import { and, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { proportionSchemeSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const proportionSchemeRoutes = new Hono<AppEnv>();
proportionSchemeRoutes.use("*", requireAuth);

// Skema proporsi bersifat versioned/time-bound (PRD section 7): perubahan
// kebijakan tidak boleh menimpa hasil periode yang sudah final. Endpoint ini
// hanya mendukung create (versi baru) + deactivate; tidak ada update nilai
// persentase pada baris yang sudah ada.

proportionSchemeRoutes.get("/", requirePermission("master.proportion_scheme.read"), async (c) => {
  const db = c.get("db");
  const serviceCategory = c.req.query("serviceCategory");
  const rows = await db.select().from(schema.proportionSchemes);
  const filtered = serviceCategory ? rows.filter((r) => r.serviceCategory === serviceCategory) : rows;
  filtered.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return c.json({ items: filtered });
});

proportionSchemeRoutes.post("/", requirePermission("master.proportion_scheme.write"), async (c) => {
  const body = proportionSchemeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data skema proporsi tidak valid", body.error.flatten());
  const db = c.get("db");
  const user = c.get("user")!;
  const data = body.data;

  // close any open-ended version of the same (category, penjaminan, role) key
  const openVersions = await db
    .select()
    .from(schema.proportionSchemes)
    .where(
      and(
        eq(schema.proportionSchemes.serviceCategory, data.serviceCategory),
        eq(schema.proportionSchemes.penjaminanStatus, data.penjaminanStatus),
        data.serviceRole
          ? eq(schema.proportionSchemes.serviceRole, data.serviceRole)
          : isNull(schema.proportionSchemes.serviceRole),
        isNull(schema.proportionSchemes.effectiveTo),
      ),
    );

  for (const open of openVersions) {
    if (open.effectiveFrom >= data.effectiveFrom) {
      throw Errors.conflict(
        `Sudah ada versi skema proporsi ini yang mulai berlaku ${open.effectiveFrom}; versi baru harus dimulai setelah tanggal tersebut`,
      );
    }
    await db
      .update(schema.proportionSchemes)
      .set({ effectiveTo: data.effectiveFrom })
      .where(eq(schema.proportionSchemes.id, open.id));
  }

  const id = newId();
  await db.insert(schema.proportionSchemes).values({
    id,
    serviceCategory: data.serviceCategory,
    penjaminanStatus: data.penjaminanStatus,
    serviceRole: data.serviceRole ?? null,
    percentBp: data.percentBp,
    effectiveFrom: data.effectiveFrom,
    effectiveTo: data.effectiveTo ?? null,
    notes: data.notes ?? null,
    createdBy: user.id,
  });
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "CREATE",
    entityType: "proportion_scheme",
    entityId: id,
    after: data,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  const row = await db.query.proportionSchemes.findFirst({ where: eq(schema.proportionSchemes.id, id) });
  return c.json(row, 201);
});

proportionSchemeRoutes.post("/:id/deactivate", requirePermission("master.proportion_scheme.write"), async (c) => {
  const db = c.get("db");
  const user = c.get("user")!;
  const id = c.req.param("id");
  const before = await db.query.proportionSchemes.findFirst({ where: eq(schema.proportionSchemes.id, id) });
  if (!before) throw Errors.notFound("Skema proporsi");

  await db.update(schema.proportionSchemes).set({ isActive: false }).where(eq(schema.proportionSchemes.id, id));
  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "proportion_scheme",
    entityId: id,
    before,
    after: { ...before, isActive: false },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json({ ok: true });
});
