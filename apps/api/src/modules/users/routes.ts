import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { ROLE_CODES, userCreateSchema, userUpdateSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { parsePagination } from "../../lib/pagination.js";
import { hashPassword } from "../../lib/password.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";

export const userRoutes = new Hono<AppEnv>();
userRoutes.use("*", requireAuth);

function sanitizeUser<T extends { passwordHash: string }>(user: T): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

function randomTempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return `Pinus${btoa(String.fromCharCode(...bytes)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}!`;
}

userRoutes.get("/", requirePermission("user.read"), async (c) => {
  const db = c.get("db");
  const { search } = parsePagination(c);
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      roleCode: schema.users.roleCode,
      employeeId: schema.users.employeeId,
      isActive: schema.users.isActive,
      mustChangePassword: schema.users.mustChangePassword,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users);
  const filtered = search
    ? rows.filter((r) => r.fullName.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase()))
    : rows;
  return c.json({ items: filtered.sort((a, b) => a.fullName.localeCompare(b.fullName)) });
});

userRoutes.get("/roles", requirePermission("role.read"), async (c) => {
  const db = c.get("db");
  const roles = await db.select().from(schema.roles);
  const rolePermissions = await db.select().from(schema.rolePermissions);
  return c.json({
    roles,
    permissionsByRole: Object.fromEntries(
      ROLE_CODES.map((code) => [code, rolePermissions.filter((rp) => rp.roleCode === code).map((rp) => rp.permissionCode)]),
    ),
  });
});

userRoutes.post("/", requirePermission("user.write"), async (c) => {
  const body = userCreateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data pengguna tidak valid", body.error.flatten());
  const db = c.get("db");
  const actor = c.get("user")!;
  const data = body.data;

  if (!ROLE_CODES.includes(data.roleCode as (typeof ROLE_CODES)[number])) {
    throw Errors.badRequest("Kode peran tidak dikenal");
  }
  const existing = await db.query.users.findFirst({ where: eq(schema.users.email, data.email) });
  if (existing) throw Errors.conflict("Email sudah terdaftar");

  const tempPassword = data.password ?? randomTempPassword();
  const id = newId();
  await db.insert(schema.users).values({
    id,
    email: data.email,
    passwordHash: await hashPassword(tempPassword),
    fullName: data.fullName,
    roleCode: data.roleCode,
    employeeId: data.employeeId ?? null,
    mustChangePassword: true,
  });

  await recordAudit(db, {
    actorUserId: actor.id,
    actorName: actor.fullName,
    action: "CREATE",
    entityType: "user",
    entityId: id,
    after: { email: data.email, fullName: data.fullName, roleCode: data.roleCode },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  const row = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  // temp password returned once so an admin can hand it to the new user out-of-band; never stored in plaintext or logged.
  return c.json({ user: sanitizeUser(row!), temporaryPassword: tempPassword }, 201);
});

userRoutes.put("/:id", requirePermission("user.write"), async (c) => {
  const body = userUpdateSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data pengguna tidak valid", body.error.flatten());
  const db = c.get("db");
  const actor = c.get("user")!;
  const id = c.req.param("id");

  const before = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!before) throw Errors.notFound("Pengguna");

  await db
    .update(schema.users)
    .set({ ...body.data, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, id));

  const after = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  await recordAudit(db, {
    actorUserId: actor.id,
    actorName: actor.fullName,
    action: "UPDATE",
    entityType: "user",
    entityId: id,
    before: { fullName: before.fullName, roleCode: before.roleCode, isActive: before.isActive, employeeId: before.employeeId },
    after: { fullName: after!.fullName, roleCode: after!.roleCode, isActive: after!.isActive, employeeId: after!.employeeId },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json(sanitizeUser(after!));
});

userRoutes.put("/:id/work-units", requirePermission("user.write"), async (c) => {
  const db = c.get("db");
  const actor = c.get("user")!;
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as { workUnitIds?: string[] } | null;
  if (!body || !Array.isArray(body.workUnitIds)) throw Errors.badRequest("workUnitIds wajib berupa array");

  const target = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!target) throw Errors.notFound("Pengguna");

  await db.delete(schema.userWorkUnits).where(eq(schema.userWorkUnits.userId, id));
  for (const workUnitId of body.workUnitIds) {
    await db.insert(schema.userWorkUnits).values({ userId: id, workUnitId });
  }

  await recordAudit(db, {
    actorUserId: actor.id,
    actorName: actor.fullName,
    action: "UPDATE",
    entityType: "user_work_units",
    entityId: id,
    after: { workUnitIds: body.workUnitIds },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json({ ok: true });
});

userRoutes.post("/:id/reset-password", requirePermission("user.write"), async (c) => {
  const db = c.get("db");
  const actor = c.get("user")!;
  const id = c.req.param("id");
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!target) throw Errors.notFound("Pengguna");

  const tempPassword = randomTempPassword();
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, id));

  await recordAudit(db, {
    actorUserId: actor.id,
    actorName: actor.fullName,
    action: "UPDATE",
    entityType: "user_password",
    entityId: id,
    after: { reason: "admin_reset" },
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });
  return c.json({ temporaryPassword: tempPassword });
});
