import type { CalculationPeriod, DashboardSummary, Employee, ProportionScheme, WorkUnit } from "@pinus/shared";
import type { AuthUser } from "@pinus/shared";
import { makeId, nowIso } from "./utils";

export interface Env {
  DB: D1Database;
  APP_NAME: string;
  API_ORIGIN: string;
  WEB_ORIGIN: string;
  COOKIE_NAME: string;
  COOKIE_SECURE: string;
}

type SqlValue = string | number | null;

export async function all<T>(db: D1Database, sql: string, ...bindings: SqlValue[]) {
  const result = await db.prepare(sql).bind(...bindings).all<T>();
  return result.results ?? [];
}

export async function first<T>(db: D1Database, sql: string, ...bindings: SqlValue[]) {
  const result = await db.prepare(sql).bind(...bindings).first<T>();
  return result ?? null;
}

export async function exec(db: D1Database, sql: string, ...bindings: SqlValue[]) {
  return db.prepare(sql).bind(...bindings).run();
}

export async function audit(
  db: D1Database,
  actor: AuthUser,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await exec(
    db,
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, entity_type, entity_id, metadata_json, occurred_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    makeId("audit"),
    actor.id,
    actor.fullName,
    actor.role,
    action,
    entityType,
    entityId,
    JSON.stringify(metadata),
    nowIso(),
  );
}

export async function getDashboardSummary(db: D1Database, workUnitId?: string | null): Promise<DashboardSummary> {
  const activePeriod = await first<DashboardSummary["activePeriod"]>(
    db,
    `SELECT id, label, status
     FROM calculation_periods
     ORDER BY year DESC, month DESC
     LIMIT 1`,
  );

  const employeeFilter = workUnitId ? "WHERE work_unit_id = ?" : "";
  const transactionJoin = workUnitId
    ? "JOIN employees e ON e.id = st.performer_employee_id WHERE e.work_unit_id = ?"
    : "";
  const resultJoin = workUnitId
    ? "JOIN employees e ON e.id = cr.employee_id WHERE e.work_unit_id = ?"
    : "";

  const totalsRow = await first<{
    employees: number;
    transactions: number;
    importBatches: number;
    pendingApprovals: number;
    totalDistributed: number;
  }>(
    db,
    `SELECT
       (SELECT COUNT(*) FROM employees ${employeeFilter}) AS employees,
       (SELECT COUNT(*) FROM service_transactions st ${transactionJoin}) AS transactions,
       (SELECT COUNT(*) FROM import_batches) AS importBatches,
       (SELECT COUNT(*) FROM approval_steps WHERE status = 'PENDING') AS pendingApprovals,
       COALESCE((SELECT ROUND(SUM(final_amount), 2) FROM calculation_results cr ${resultJoin}), 0) AS totalDistributed`,
    ...(workUnitId ? [workUnitId, workUnitId, workUnitId] : []),
  );

  const byCategory = await all<DashboardSummary["byCategory"][number]>(
    db,
    `SELECT e.category AS category, ROUND(COALESCE(SUM(cr.final_amount), 0), 2) AS total, COUNT(cr.id) AS recipients
     FROM calculation_results cr
     JOIN employees e ON e.id = cr.employee_id
     ${workUnitId ? "WHERE e.work_unit_id = ?" : ""}
     GROUP BY e.category
     ORDER BY total DESC`,
    ...(workUnitId ? [workUnitId] : []),
  );

  const byUnit = await all<DashboardSummary["byUnit"][number]>(
    db,
    `SELECT wu.name AS workUnitName, ROUND(COALESCE(SUM(cr.final_amount), 0), 2) AS total
     FROM calculation_results cr
     JOIN employees e ON e.id = cr.employee_id
     JOIN work_units wu ON wu.id = e.work_unit_id
     ${workUnitId ? "WHERE e.work_unit_id = ?" : ""}
     GROUP BY wu.id, wu.name
     ORDER BY total DESC
     LIMIT 10`,
    ...(workUnitId ? [workUnitId] : []),
  );

  return {
    activePeriod,
    totals: totalsRow ?? {
      employees: 0,
      transactions: 0,
      importBatches: 0,
      pendingApprovals: 0,
      totalDistributed: 0,
    },
    byCategory,
    byUnit,
  };
}

export async function getWorkUnits(db: D1Database): Promise<WorkUnit[]> {
  return all<WorkUnit>(
    db,
    `SELECT id, code, name, service_type AS serviceType, created_at AS createdAt
     FROM work_units
     ORDER BY name ASC`,
  );
}

export async function getEmployees(db: D1Database): Promise<Employee[]> {
  return all<Employee>(
    db,
    `SELECT e.id,
            e.employee_number AS employeeNumber,
            e.full_name AS fullName,
            e.category,
            e.profession,
            e.work_unit_id AS workUnitId,
            wu.name AS workUnitName,
            e.position_title AS positionTitle,
            e.job_grade_code AS jobGradeCode,
            e.employment_status AS employmentStatus,
            e.is_active AS isActive,
            e.created_at AS createdAt
     FROM employees e
     JOIN work_units wu ON wu.id = e.work_unit_id
     ORDER BY e.full_name ASC`,
  );
}

export async function getSchemes(db: D1Database): Promise<ProportionScheme[]> {
  return all<ProportionScheme>(
    db,
    `SELECT ps.id,
            ps.work_unit_id AS workUnitId,
            wu.name AS workUnitName,
            ps.employee_category AS employeeCategory,
            ps.payer_type AS payerType,
            ps.role_in_service AS roleInService,
            ps.percentage,
            ps.fixed_share_percentage AS fixedSharePercentage,
            ps.subsidy_share_percentage AS subsidySharePercentage,
            ps.effective_start_date AS effectiveStartDate
     FROM proportion_schemes ps
     LEFT JOIN work_units wu ON wu.id = ps.work_unit_id
     ORDER BY ps.effective_start_date DESC, wu.name ASC`,
  );
}

export async function getPeriods(db: D1Database): Promise<CalculationPeriod[]> {
  return all<CalculationPeriod>(
    db,
    `SELECT id,
            label,
            month,
            year,
            budget_medical AS budgetMedical,
            budget_health AS budgetHealth,
            budget_admin AS budgetAdmin,
            minimum_specialist AS minimumSpecialist,
            minimum_general_practitioner AS minimumGeneralPractitioner,
            minimum_senior_nurse AS minimumSeniorNurse,
            status,
            published_at AS publishedAt,
            created_at AS createdAt
     FROM calculation_periods
     ORDER BY year DESC, month DESC`,
  );
}
