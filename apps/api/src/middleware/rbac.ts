import type { MiddlewareHandler } from "hono";
import type { Permission } from "@pinus/shared";
import type { AppEnv } from "../lib/app-context.js";
import { Errors } from "../lib/errors.js";

/** Requires the caller to be authenticated (via requireAuth) AND hold every listed permission. */
export function requirePermission(...permissions: Permission[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw Errors.unauthorized();
    const missing = permissions.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw Errors.forbidden(`Peran ${user.roleCode} tidak memiliki hak akses: ${missing.join(", ")}`);
    }
    await next();
  };
}

/**
 * Verifikator Unit accounts are scoped to the work units assigned in
 * user_work_units (PRD: "Verifikator Unit hanya melihat data unitnya").
 * SUPER_ADMIN, ADMIN_JASPEL, KEUANGAN, DIREKTUR, and AUDITOR see every unit.
 */
const UNIT_SCOPED_ROLES = new Set(["VERIFIKATOR_UNIT"]);

export function isScopedToWorkUnits(roleCode: string): boolean {
  return UNIT_SCOPED_ROLES.has(roleCode);
}

export function assertWorkUnitAccess(
  user: { roleCode: string; workUnitIds: string[] },
  workUnitId: string,
): void {
  if (!isScopedToWorkUnits(user.roleCode)) return;
  if (!user.workUnitIds.includes(workUnitId)) {
    throw Errors.forbidden("Unit kerja ini di luar cakupan akses Anda");
  }
}
