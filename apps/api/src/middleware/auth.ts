import { eq } from "drizzle-orm";
import type { MiddlewareHandler } from "hono";
import type { Permission } from "@pinus/shared";
import { schema } from "../db/client.js";
import type { AppEnv, AuthUser } from "../lib/app-context.js";
import { Errors } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/jwt.js";

export async function loadAuthUser(db: AppEnv["Variables"]["db"], userId: string): Promise<AuthUser | null> {
  const userRow = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!userRow || !userRow.isActive) return null;

  const permissionRows = await db
    .select({ code: schema.rolePermissions.permissionCode })
    .from(schema.rolePermissions)
    .where(eq(schema.rolePermissions.roleCode, userRow.roleCode));

  const workUnitRows = await db
    .select({ workUnitId: schema.userWorkUnits.workUnitId })
    .from(schema.userWorkUnits)
    .where(eq(schema.userWorkUnits.userId, userRow.id));

  return {
    id: userRow.id,
    email: userRow.email,
    fullName: userRow.fullName,
    roleCode: userRow.roleCode as AuthUser["roleCode"],
    employeeId: userRow.employeeId,
    mustChangePassword: userRow.mustChangePassword,
    permissions: permissionRows.map((p) => p.code as Permission),
    workUnitIds: workUnitRows.map((w) => w.workUnitId),
  };
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authHeader = c.req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) throw Errors.unauthorized();

  const payload = await verifyAccessToken(token, c.env.JWT_ACCESS_SECRET);
  if (!payload) throw Errors.unauthorized("Token tidak valid atau kedaluwarsa");

  const user = await loadAuthUser(c.get("db"), payload.sub);
  if (!user) throw Errors.unauthorized("Akun tidak ditemukan atau nonaktif");

  c.set("user", user);
  await next();
};

// no-op wrapper used only by the two anonymous auth routes (login, refresh)
// so `db` is always populated even though `user` stays null.
export const optionalAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  await next();
};

/** narrows AuthUser | null to AuthUser for handlers mounted behind requireAuth */
export function currentUser(c: { get(key: "user"): AuthUser | null }): AuthUser {
  const user = c.get("user");
  if (!user) throw Errors.unauthorized();
  return user;
}
