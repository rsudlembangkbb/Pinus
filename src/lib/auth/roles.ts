export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN_JASPEL: 'admin_jaspel',
  VERIFIKATOR_UNIT: 'verifikator_unit',
  KEUANGAN: 'keuangan',
  DIREKTUR: 'direktur',
  PEGAWAI: 'pegawai',
  AUDITOR: 'auditor'
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<RoleCode, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin / IT Administrator',
  [ROLES.ADMIN_JASPEL]: 'Admin Jaspel / Tim Remunerasi',
  [ROLES.VERIFIKATOR_UNIT]: 'Verifikator Unit / Kepala Instalasi',
  [ROLES.KEUANGAN]: 'Bagian Keuangan / Pejabat Keuangan BLUD',
  [ROLES.DIREKTUR]: 'Direktur / Pejabat Pengelola BLUD',
  [ROLES.PEGAWAI]: 'Pegawai',
  [ROLES.AUDITOR]: 'Auditor / Inspektorat'
};

/** Roles allowed to manage master data & system configuration. */
export const MASTER_DATA_ROLES: RoleCode[] = [ROLES.SUPER_ADMIN];
/** Roles allowed to run imports & trigger calculations. */
export const OPERATOR_ROLES: RoleCode[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN_JASPEL];
/** Roles allowed to read all-employee financial data (not just their own). */
export const FINANCE_VISIBILITY_ROLES: RoleCode[] = [
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN_JASPEL,
  ROLES.KEUANGAN,
  ROLES.DIREKTUR,
  ROLES.AUDITOR
];
export const READ_ONLY_AUDIT_ROLES: RoleCode[] = [ROLES.AUDITOR, ROLES.SUPER_ADMIN, ROLES.DIREKTUR];

export function hasAnyRole(role: string, allowed: RoleCode[]): boolean {
  return allowed.includes(role as RoleCode);
}
