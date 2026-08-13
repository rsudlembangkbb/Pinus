import Decimal from "decimal.js";
import type { EmployeeCategory } from "@pinus/shared";

export interface DomainEmployee {
  id: string;
  employeeNumber: string;
  fullName: string;
  category: EmployeeCategory;
  profession: string;
  workUnitId: string;
  workUnitName: string;
  jobGradeCode: string | null;
}

export interface DomainTransaction {
  workUnitId: string;
  payerType: "JKN" | "NON_JKN";
  roleInService: string;
  performerEmployeeId: string;
  tariffAmount: number;
  quantity: number;
}

export interface DomainScheme {
  workUnitId: string | null;
  employeeCategory: EmployeeCategory;
  payerType: "JKN" | "NON_JKN" | null;
  roleInService: string | null;
  percentage: number;
  fixedSharePercentage: number;
  subsidySharePercentage: number;
}

export interface DomainJobGrade {
  code: string;
  distributionWeight: number;
  experienceWeight: number;
  skillWeight: number;
  riskWeight: number;
  emergencyWeight: number;
  performanceWeight: number;
}

export interface DomainAttendance {
  employeeId: string;
  attendanceRate: number;
  qualityScore: number;
  workloadFactor: number;
  deductionPercentage: number;
}

export interface DomainMinimums {
  specialist: number;
  generalPractitioner: number;
  seniorNurse: number;
}

export interface DomainBudgets {
  medical: number;
  health: number;
  admin: number;
}

export interface DomainResult {
  employeeId: string;
  grossAmount: number;
  deductionAmount: number;
  adjustmentAmount: number;
  finalAmount: number;
  breakdown: Record<string, unknown>;
}

const D = (value: Decimal.Value) => new Decimal(value);
const roundMoney = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

function moneySum(values: Decimal[]): Decimal {
  return values.reduce((sum, value) => sum.plus(value), new Decimal(0));
}

function getScheme(
  schemes: DomainScheme[],
  employeeCategory: EmployeeCategory,
  workUnitId: string,
  payerType: "JKN" | "NON_JKN" | null,
  roleInService: string | null,
): DomainScheme | undefined {
  return schemes.find((scheme) => {
    if (scheme.employeeCategory !== employeeCategory) {
      return false;
    }

    if (scheme.workUnitId && scheme.workUnitId !== workUnitId) {
      return false;
    }

    if (scheme.payerType && payerType && scheme.payerType !== payerType) {
      return false;
    }

    if (scheme.roleInService && roleInService && scheme.roleInService !== roleInService) {
      return false;
    }

    return true;
  });
}

function getMinimum(employee: DomainEmployee, minimums: DomainMinimums): Decimal {
  const profession = employee.profession.toLowerCase();
  if (profession.includes("sub-spesialis") || profession.includes("spesialis")) {
    return D(minimums.specialist);
  }
  if (profession.includes("dokter")) {
    return D(minimums.generalPractitioner);
  }
  if (profession.includes("perawat mahir")) {
    return D(minimums.seniorNurse);
  }
  return D(0);
}

function getAttendanceScore(attendance?: DomainAttendance): Decimal {
  if (!attendance) {
    return D(1);
  }
  return D(attendance.attendanceRate).times(0.4).plus(D(attendance.qualityScore).times(0.6));
}

function applyDeductions(amount: Decimal, attendance?: DomainAttendance) {
  const deductionRate = D(attendance?.deductionPercentage ?? 0).div(100);
  const deductionAmount = roundMoney(amount.times(deductionRate));
  return {
    deductionRate,
    deductionAmount,
    netBeforeAdjustment: roundMoney(amount.minus(deductionAmount)),
  };
}

function capResults(results: DomainResult[], budget: number, bucket: string) {
  const currentTotal = moneySum(results.map((result) => D(result.finalAmount)));
  const budgetDecimal = D(budget);

  if (currentTotal.lte(budgetDecimal) || currentTotal.eq(0)) {
    return results;
  }

  const factor = budgetDecimal.div(currentTotal);
  return results.map((result) => {
    const adjusted = roundMoney(D(result.finalAmount).times(factor));
    return {
      ...result,
      adjustmentAmount: Number(roundMoney(adjusted.minus(result.finalAmount)).toString()),
      finalAmount: Number(adjusted.toString()),
      breakdown: {
        ...result.breakdown,
        [`${bucket}CapFactor`]: Number(factor.toDecimalPlaces(6).toString()),
      },
    };
  });
}

function calculateMedicalResults(input: {
  employees: DomainEmployee[];
  transactions: DomainTransaction[];
  schemes: DomainScheme[];
  attendanceMap: Map<string, DomainAttendance>;
  minimums: DomainMinimums;
  budgets: DomainBudgets;
}): DomainResult[] {
  const results = input.employees
    .filter((employee) => employee.category === "MEDIS")
    .map((employee) => {
      const employeeTransactions = input.transactions.filter(
        (transaction) => transaction.performerEmployeeId === employee.id,
      );

      const gross = employeeTransactions.reduce((sum, transaction) => {
        const scheme = getScheme(
          input.schemes,
          "MEDIS",
          transaction.workUnitId,
          transaction.payerType,
          transaction.roleInService,
        );
        const percentage = D(scheme?.percentage ?? 0).div(100);
        return sum.plus(D(transaction.tariffAmount).times(transaction.quantity).times(percentage));
      }, new Decimal(0));

      const minimum = getMinimum(employee, input.minimums);
      const grossWithMinimum = Decimal.max(roundMoney(gross), minimum);
      const deduction = applyDeductions(grossWithMinimum, input.attendanceMap.get(employee.id));
      return {
        employeeId: employee.id,
        grossAmount: Number(grossWithMinimum.toString()),
        deductionAmount: Number(deduction.deductionAmount.toString()),
        adjustmentAmount: 0,
        finalAmount: Number(deduction.netBeforeAdjustment.toString()),
        breakdown: {
          formula: "SUM(tariff * qty * proporsi) dengan minimum requirement",
          transactionCount: employeeTransactions.length,
          minimumApplied: Number(minimum.toString()),
          deductionRate: Number(deduction.deductionRate.toString()),
        },
      } satisfies DomainResult;
    });

  return capResults(results, input.budgets.medical, "medical");
}

function calculateHealthResults(input: {
  employees: DomainEmployee[];
  transactions: DomainTransaction[];
  schemes: DomainScheme[];
  attendanceMap: Map<string, DomainAttendance>;
  jobGradeMap: Map<string, DomainJobGrade>;
  budgets: DomainBudgets;
}): DomainResult[] {
  const unitFunds = new Map<string, Decimal>();

  input.transactions.forEach((transaction) => {
    const scheme = getScheme(
      input.schemes,
      "KESEHATAN",
      transaction.workUnitId,
      transaction.payerType,
      transaction.roleInService,
    );
    const percentage = D(scheme?.percentage ?? 0).div(100);
    const amount = D(transaction.tariffAmount).times(transaction.quantity).times(percentage);
    unitFunds.set(transaction.workUnitId, (unitFunds.get(transaction.workUnitId) ?? D(0)).plus(amount));
  });

  const healthEmployees = input.employees.filter((employee) => employee.category === "KESEHATAN");
  const groupedByUnit = new Map<string, DomainEmployee[]>();
  healthEmployees.forEach((employee) => {
    const bucket = groupedByUnit.get(employee.workUnitId) ?? [];
    bucket.push(employee);
    groupedByUnit.set(employee.workUnitId, bucket);
  });

  const results: DomainResult[] = [];

  groupedByUnit.forEach((employees, workUnitId) => {
    const unitFund = roundMoney(unitFunds.get(workUnitId) ?? D(0));
    if (unitFund.eq(0)) {
      employees.forEach((employee) => {
        results.push({
          employeeId: employee.id,
          grossAmount: 0,
          deductionAmount: 0,
          adjustmentAmount: 0,
          finalAmount: 0,
          breakdown: {
            formula: "Dana unit tidak tersedia",
            unitFund: 0,
          },
        });
      });
      return;
    }

    const weighted = employees.map((employee) => {
      const attendance = input.attendanceMap.get(employee.id);
      const jobGrade = employee.jobGradeCode ? input.jobGradeMap.get(employee.jobGradeCode) : undefined;
      const distributionWeight = D(jobGrade?.distributionWeight ?? 1);
      const workload = D(attendance?.workloadFactor ?? 1);
      const score = getAttendanceScore(attendance);
      const totalWeight = distributionWeight.times(workload).times(score);

      return {
        employee,
        attendance,
        totalWeight,
      };
    });

    const denominator = moneySum(weighted.map((entry) => entry.totalWeight));
    weighted.forEach((entry) => {
      const gross = denominator.eq(0) ? D(0) : unitFund.times(entry.totalWeight).div(denominator);
      const deduction = applyDeductions(roundMoney(gross), entry.attendance);
      results.push({
        employeeId: entry.employee.id,
        grossAmount: Number(roundMoney(gross).toString()),
        deductionAmount: Number(deduction.deductionAmount.toString()),
        adjustmentAmount: 0,
        finalAmount: Number(deduction.netBeforeAdjustment.toString()),
        breakdown: {
          formula: "Dana unit * bobot distribusi / total bobot unit",
          unitFund: Number(unitFund.toString()),
          weight: Number(entry.totalWeight.toDecimalPlaces(4).toString()),
          denominator: Number(denominator.toDecimalPlaces(4).toString()),
          deductionRate: Number(deduction.deductionRate.toString()),
        },
      });
    });
  });

  return capResults(results, input.budgets.health, "health");
}

function calculateAdminResults(input: {
  employees: DomainEmployee[];
  attendanceMap: Map<string, DomainAttendance>;
  jobGradeMap: Map<string, DomainJobGrade>;
  budgets: DomainBudgets;
}): DomainResult[] {
  const adminEmployees = input.employees.filter(
    (employee) => employee.category === "ADMINISTRASI" || employee.category === "STRUKTURAL",
  );

  const weighted = adminEmployees.map((employee) => {
    const attendance = input.attendanceMap.get(employee.id);
    const jobGrade = employee.jobGradeCode ? input.jobGradeMap.get(employee.jobGradeCode) : undefined;
    const score = getAttendanceScore(attendance);
    const indexWeight = D(jobGrade?.experienceWeight ?? 1)
      .plus(jobGrade?.skillWeight ?? 1)
      .plus(jobGrade?.riskWeight ?? 1)
      .plus(jobGrade?.emergencyWeight ?? 1)
      .plus(jobGrade?.performanceWeight ?? 1);

    return {
      employee,
      attendance,
      totalScore: score.times(indexWeight),
    };
  });

  const denominator = moneySum(weighted.map((entry) => entry.totalScore));

  const results = weighted.map((entry) => {
    const gross = denominator.eq(0) ? D(0) : D(input.budgets.admin).times(entry.totalScore).div(denominator);
    const deduction = applyDeductions(roundMoney(gross), entry.attendance);
    return {
      employeeId: entry.employee.id,
      grossAmount: Number(roundMoney(gross).toString()),
      deductionAmount: Number(deduction.deductionAmount.toString()),
      adjustmentAmount: 0,
      finalAmount: Number(deduction.netBeforeAdjustment.toString()),
      breakdown: {
        formula: "Pool administrasi * skor individu / total skor",
        score: Number(entry.totalScore.toDecimalPlaces(4).toString()),
        denominator: Number(denominator.toDecimalPlaces(4).toString()),
        deductionRate: Number(deduction.deductionRate.toString()),
      },
    } satisfies DomainResult;
  });

  return capResults(results, input.budgets.admin, "admin");
}

export function calculateJaspel(input: {
  employees: DomainEmployee[];
  transactions: DomainTransaction[];
  schemes: DomainScheme[];
  attendances: DomainAttendance[];
  jobGrades: DomainJobGrade[];
  minimums: DomainMinimums;
  budgets: DomainBudgets;
}): DomainResult[] {
  const attendanceMap = new Map(input.attendances.map((attendance) => [attendance.employeeId, attendance]));
  const jobGradeMap = new Map(input.jobGrades.map((grade) => [grade.code, grade]));

  const medical = calculateMedicalResults({
    employees: input.employees,
    transactions: input.transactions,
    schemes: input.schemes,
    attendanceMap,
    minimums: input.minimums,
    budgets: input.budgets,
  });

  const health = calculateHealthResults({
    employees: input.employees,
    transactions: input.transactions,
    schemes: input.schemes,
    attendanceMap,
    jobGradeMap,
    budgets: input.budgets,
  });

  const admin = calculateAdminResults({
    employees: input.employees,
    attendanceMap,
    jobGradeMap,
    budgets: input.budgets,
  });

  return [...medical, ...health, ...admin];
}
