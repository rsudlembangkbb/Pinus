import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { ProportionSchemesService } from "../proportion-schemes/proportion-schemes.service";
import { DeductionRulesService } from "../deduction-rules/deduction-rules.service";
import { MinimumRequirementsService } from "../minimum-requirements/minimum-requirements.service";
import { IndexingWeightsService } from "../indexing-weights/indexing-weights.service";
import { calculatePeriod } from "./domain/engine";
import {
  AttendanceInput,
  EmployeeInput,
  IndexingScoreInput,
  IndexingWeightInput,
  PerformanceInput,
  ProportionKey,
  ServiceTransactionInput,
} from "./domain/types";

@Injectable()
export class CalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly proportionSchemes: ProportionSchemesService,
    private readonly deductionRules: DeductionRulesService,
    private readonly minimumRequirements: MinimumRequirementsService,
    private readonly indexingWeights: IndexingWeightsService,
  ) {}

  async runForPeriod(periodId: string, actorId: string) {
    const period = await this.prisma.calculationPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new BadRequestException("Periode tidak ditemukan");
    if (period.lockedAt) {
      throw new BadRequestException("Periode sudah terkunci dan tidak dapat dikalkulasi ulang");
    }

    const periodDate = new Date(period.year, period.month - 1, 15); // mid-month reference for effective-dated lookups

    const [transactions, attendanceRows, performanceRows, indexingScoreRows, deductionRuleRows, minReqRows, weightRows] =
      await Promise.all([
        this.prisma.serviceTransaction.findMany({
          where: { periodId },
          include: { employee: true },
        }),
        this.prisma.attendanceRecord.findMany({ where: { periodId } }),
        this.prisma.performanceScore.findMany({ where: { periodId } }),
        this.prisma.indexingScore.findMany({ where: { periodId } }),
        this.deductionRules.findAllEffective(periodDate),
        this.minimumRequirements.findAllEffective(periodDate),
        this.indexingWeights.findEffectiveAll(periodDate),
      ]);

    const employeeIds = new Set<string>([
      ...transactions.map((t) => t.employeeId),
      ...attendanceRows.map((a) => a.employeeId),
    ]);
    // Also pull every active ADMINISTRASI/STRUKTURAL/KEPERAWATAN/NAKES_LAIN
    // employee so indexing/unit-team distribution covers everyone eligible,
    // not just those who happen to have a transaction row this period.
    const poolEmployees = await this.prisma.employee.findMany({
      where: { isActive: true, staffCategory: { in: ["ADMINISTRASI", "STRUKTURAL", "KEPERAWATAN", "NAKES_LAIN"] } },
    });
    for (const e of poolEmployees) employeeIds.add(e.id);

    const employeeRecords = await this.prisma.employee.findMany({
      where: { id: { in: Array.from(employeeIds) } },
      include: { jobGrade: true },
    });

    const employees: EmployeeInput[] = employeeRecords.map((e) => ({
      id: e.id,
      staffCategory: e.staffCategory,
      workUnitId: e.workUnitId,
      jobGradeWeight: e.jobGrade ? e.jobGrade.weightScore.toString() : null,
      minimumRequirementLevel: e.minimumRequirementLevel,
    }));

    const txInputs: ServiceTransactionInput[] = transactions.map((t) => ({
      id: t.id,
      employeeId: t.employeeId,
      workUnitId: t.workUnitId,
      guaranteeStatus: t.guaranteeStatus,
      serviceRole: t.serviceRole,
      tariffAmount: t.tariffAmount.toString(),
    }));

    const attendance: AttendanceInput[] = attendanceRows.map((a) => ({
      employeeId: a.employeeId,
      leaveDays: a.leaveDays,
      disciplinaryAction: a.disciplinaryAction,
      fightDuringCoaching: a.fightDuringCoaching,
      trainingDays: a.trainingDays,
      studyAssignmentAbsenceDaysPerWeek: a.studyAssignmentAbsenceDaysPerWeek,
      attendancePercent: a.attendancePercent.toString(),
    }));

    const performance: PerformanceInput[] = performanceRows.map((p) => ({
      employeeId: p.employeeId,
      qualityScore: p.qualityScore.toString(),
    }));

    const indexingScores: IndexingScoreInput[] = indexingScoreRows.map((s) => ({
      employeeId: s.employeeId,
      variableCode: s.variableCode as IndexingScoreInput["variableCode"],
      score: s.score.toString(),
    }));

    const indexingWeightsInput: IndexingWeightInput[] = weightRows.map((w) => ({
      variableCode: w.variableCode as IndexingWeightInput["variableCode"],
      weightPercent: w.weightPercent.toString(),
    }));

    const deductionRulesInput = deductionRuleRows.map((r) => ({
      trigger: r.trigger,
      percentage: r.percentage.toString(),
    }));

    const minimumRequirementsInput = minReqRows.map((r) => ({
      level: r.level,
      minimumAmount: r.minimumAmount.toString(),
    }));

    // Cache proportion scheme lookups within this run — the same
    // (unit, status, role) combo repeats across thousands of transaction
    // rows, and each miss/hit is a synchronous in-memory map read after the
    // first DB round trip.
    const proportionCache = new Map<string, string | null>();
    const proportionKeys = new Set<string>();
    for (const t of txInputs) {
      proportionKeys.add(`${t.workUnitId}|${t.guaranteeStatus}|${t.serviceRole}`);
      proportionKeys.add(`${t.workUnitId}|${t.guaranteeStatus}|PELAKSANA`);
    }
    await Promise.all(
      Array.from(proportionKeys).map(async (key) => {
        const [workUnitId, guaranteeStatus, serviceRole] = key.split("|");
        const scheme = await this.proportionSchemes.findEffective(
          workUnitId,
          guaranteeStatus,
          serviceRole,
          periodDate,
        );
        proportionCache.set(key, scheme ? scheme.percentage.toString() : null);
      }),
    );

    const resolveProportion = (key: ProportionKey): string | null => {
      const cacheKey = `${key.workUnitId}|${key.guaranteeStatus}|${key.serviceRole}`;
      return proportionCache.get(cacheKey) ?? null;
    };

    const result = calculatePeriod({
      employees,
      transactions: txInputs,
      attendance,
      performance,
      indexingScores,
      indexingWeights: indexingWeightsInput,
      deductionRules: deductionRulesInput,
      minimumRequirements: minimumRequirementsInput,
      resolveProportion,
      adminBudget: period.administrativeBudget.toString(),
      performanceBudgetCap: period.performanceBudgetCap?.toString() ?? null,
      unitTeamSubsidyConfig: { fixedPortionPercent: period.unitTeamFixedPortionPercent.toString() },
    });

    await this.prisma.$transaction([
      this.prisma.calculationResult.deleteMany({ where: { periodId } }),
      this.prisma.calculationResult.createMany({
        data: result.employees.map((e) => ({
          periodId,
          employeeId: e.employeeId,
          staffCategory: e.staffCategory as never,
          grossAmount: e.grossAmount,
          deductionAmount: e.deductionAmount,
          paguAdjustmentFactor: e.paguAdjustmentFactor,
          minimumRequirementApplied: e.minimumRequirementApplied,
          netAmount: e.netAmount,
          components: e.components as Prisma.InputJsonValue,
          formulaVersion: e.formulaVersion,
        })),
      }),
      this.prisma.calculationPeriod.update({
        where: { id: periodId },
        data: { status: "CALCULATED", calculatedAt: new Date() },
      }),
    ]);

    await this.auditService.record({
      actorId,
      action: "CALCULATE",
      entityType: "CalculationPeriod",
      entityId: periodId,
      after: {
        totalGross: result.totalGross,
        totalFinal: result.totalFinal,
        paguAdjustmentFactor: result.paguAdjustmentFactor,
        employeeCount: result.employees.length,
      },
    });

    return result;
  }

  findResultsForPeriod(periodId: string, filters: { workUnitId?: string; staffCategory?: string }) {
    return this.prisma.calculationResult.findMany({
      where: {
        periodId,
        staffCategory: filters.staffCategory as never,
        employee: filters.workUnitId ? { workUnitId: filters.workUnitId } : undefined,
      },
      include: {
        employee: {
          select: { id: true, fullName: true, nip: true, staffCategory: true, workUnit: { select: { id: true, name: true } } },
        },
      },
      orderBy: { netAmount: "desc" },
    });
  }

  findResultForEmployee(periodId: string, employeeId: string) {
    return this.prisma.calculationResult.findUnique({
      where: { periodId_employeeId: { periodId, employeeId } },
      include: {
        employee: {
          select: { id: true, fullName: true, nip: true, staffCategory: true, workUnit: { select: { id: true, name: true } } },
        },
        period: { select: { id: true, name: true, year: true, month: true, status: true } },
      },
    });
  }
}
