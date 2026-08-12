import { UserRole } from "./enums";

/**
 * Central RBAC permission matrix. Both API guards and the frontend nav/UI
 * gating read from this single source of truth so role capabilities never
 * drift between server enforcement and client display.
 */
export enum Permission {
  MASTER_DATA_MANAGE = "MASTER_DATA_MANAGE",
  MASTER_DATA_READ = "MASTER_DATA_READ",
  IMPORT_MANAGE = "IMPORT_MANAGE",
  CALCULATION_RUN = "CALCULATION_RUN",
  CALCULATION_READ_ALL = "CALCULATION_READ_ALL",
  CALCULATION_READ_UNIT = "CALCULATION_READ_UNIT",
  CALCULATION_READ_OWN = "CALCULATION_READ_OWN",
  APPROVAL_UNIT = "APPROVAL_UNIT",
  APPROVAL_FINANCE = "APPROVAL_FINANCE",
  APPROVAL_DIRECTOR = "APPROVAL_DIRECTOR",
  REPORTS_READ = "REPORTS_READ",
  USER_MANAGE = "USER_MANAGE",
  AUDIT_READ = "AUDIT_READ",
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permission),
  [UserRole.ADMIN_JASPEL]: [
    Permission.MASTER_DATA_MANAGE,
    Permission.MASTER_DATA_READ,
    Permission.IMPORT_MANAGE,
    Permission.CALCULATION_RUN,
    Permission.CALCULATION_READ_ALL,
    Permission.REPORTS_READ,
    Permission.AUDIT_READ,
  ],
  [UserRole.VERIFIKATOR_UNIT]: [
    Permission.MASTER_DATA_READ,
    Permission.CALCULATION_READ_UNIT,
    Permission.APPROVAL_UNIT,
    Permission.REPORTS_READ,
  ],
  [UserRole.KEUANGAN]: [
    Permission.MASTER_DATA_READ,
    Permission.CALCULATION_READ_ALL,
    Permission.APPROVAL_FINANCE,
    Permission.REPORTS_READ,
  ],
  [UserRole.DIREKTUR]: [
    Permission.MASTER_DATA_READ,
    Permission.CALCULATION_READ_ALL,
    Permission.APPROVAL_DIRECTOR,
    Permission.REPORTS_READ,
  ],
  [UserRole.PEGAWAI]: [Permission.CALCULATION_READ_OWN],
  [UserRole.AUDITOR]: [
    Permission.MASTER_DATA_READ,
    Permission.CALCULATION_READ_ALL,
    Permission.REPORTS_READ,
    Permission.AUDIT_READ,
  ],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
