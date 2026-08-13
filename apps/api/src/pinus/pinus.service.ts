import {
  ApprovalLevel,
  ApprovalStatus,
  EmployeeCategory,
  PeriodStatus,
  Prisma,
  Role,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { AuditService } from '../common/audit.service';
import { AuthenticatedUser } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { ReportsService } from '../reports/reports.service';

type CreateWorkUnitInput = {
  code: string;
  name: string;
  serviceType: string;
};

type CreateJobGradeInput = {
  code: string;
  name: string;
  weight: number;
};

type CreateEmployeeInput = {
  employeeNumber: string;
  nationalId?: string;
  fullName: string;
  category: EmployeeCategory;
  profession?: string;
  specialization?: string;
  position?: string;
  employmentStatus: 'PNS' | 'PPPK' | 'NON_ASN';
  startDate: string;
  minimumGuarantee?: number;
  workUnitId: string;
  jobGradeId?: string;
};

type CreatePeriodInput = {
  month: number;
  year: number;
  budgetCap: number;
  healthcarePool: number;
  administrativePool: number;
};

type CreateSchemeInput = {
  workUnitId: string;
  name: string;
  serviceType: string;
  roleInService: string;
  payerType: 'JKN' | 'NON_JKN';
  percentage: number;
  effectiveFrom: string;
  effectiveTo?: string;
};

type CreateDeductionRuleInput = {
  code: string;
  name: string;
  description: string;
  percentage: number;
  effectiveFrom: string;
  effectiveTo?: string;
};

type UpsertAttendanceInput = {
  employeeId: string;
  attendanceScore: number;
  leaveDays: number;
  disciplinaryAction: boolean;
  trainingMonths: number;
  studyDaysPerWeek: number;
};

type UpsertPerformanceInput = {
  employeeId: string;
  attendanceWeight: number;
  qualityWeight: number;
};

@Injectable()
export class PinusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly reportsService: ReportsService,
  ) {}

  private toDecimal(value: Decimal.Value) {
    return new Prisma.Decimal(new Decimal(value).toFixed(2));
  }

  private decimal(value: Decimal.Value) {
    return new Decimal(value ?? 0);
  }

  private serialize<T>(value: T): T {
    return JSON.parse(
      JSON.stringify(value, (_key, currentValue) => {
        if (Prisma.Decimal.isDecimal(currentValue)) {
          return currentValue.toString();
        }
        return currentValue;
      }),
    ) as T;
  }

  private ensureRole(user: AuthenticatedUser, roles: Role[]) {
    if (!roles.includes(user.role)) {
      throw new ForbiddenException(
        'Peran Anda tidak diizinkan untuk aksi ini.',
      );
    }
  }

  async getBootstrap(user: AuthenticatedUser) {
    const [units, grades, periods, summary] = await Promise.all([
      this.prisma.workUnit.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.jobGrade.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.calculationPeriod.findMany({
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
      }),
      this.getDashboardSummary(user),
    ]);

    return this.serialize({ units, grades, periods, summary });
  }

  async getDashboardSummary(user: AuthenticatedUser) {
    const latestPeriod = await this.prisma.calculationPeriod.findFirst({
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      include: {
        results: {
          include: {
            employee: true,
            workUnit: true,
          },
        },
      },
    });

    const totals = latestPeriod?.results.reduce(
      (accumulator, result) => {
        accumulator.total += Number(result.finalAmount);
        const key = result.employee.category;
        accumulator.byCategory[key] =
          (accumulator.byCategory[key] ?? 0) + Number(result.finalAmount);
        return accumulator;
      },
      {
        total: 0,
        byCategory: {} as Record<EmployeeCategory, number>,
      },
    ) ?? { total: 0, byCategory: {} as Record<EmployeeCategory, number> };

    const myLatest = user.employeeId
      ? await this.prisma.calculationResult.findFirst({
          where: {
            employeeId: user.employeeId,
            period: {
              status: { in: [PeriodStatus.FINALIZED, PeriodStatus.PUBLISHED] },
            },
          },
          include: { period: true },
          orderBy: [
            { period: { year: 'desc' } },
            { period: { month: 'desc' } },
          ],
        })
      : null;

    return this.serialize({
      latestPeriod,
      totals,
      myLatest,
    });
  }

  async listWorkUnits() {
    return this.serialize(
      await this.prisma.workUnit.findMany({
        orderBy: { name: 'asc' },
      }),
    );
  }

  async createWorkUnit(user: AuthenticatedUser, input: CreateWorkUnitInput) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const created = await this.prisma.workUnit.create({
      data: input,
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CREATE_WORK_UNIT',
      entityType: 'WorkUnit',
      entityId: created.id,
      after: created,
    });

    return this.serialize(created);
  }

  async listJobGrades() {
    return this.serialize(
      await this.prisma.jobGrade.findMany({ orderBy: { weight: 'desc' } }),
    );
  }

  async createJobGrade(user: AuthenticatedUser, input: CreateJobGradeInput) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const created = await this.prisma.jobGrade.create({
      data: {
        ...input,
        weight: this.toDecimal(input.weight),
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CREATE_JOB_GRADE',
      entityType: 'JobGrade',
      entityId: created.id,
      after: created,
    });

    return this.serialize(created);
  }

  async listEmployees() {
    return this.serialize(
      await this.prisma.employee.findMany({
        include: {
          workUnit: true,
          jobGrade: true,
          user: true,
        },
        orderBy: { fullName: 'asc' },
      }),
    );
  }

  async createEmployee(user: AuthenticatedUser, input: CreateEmployeeInput) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const created = await this.prisma.employee.create({
      data: {
        ...input,
        startDate: new Date(input.startDate),
        minimumGuarantee:
          input.minimumGuarantee !== undefined
            ? this.toDecimal(input.minimumGuarantee)
            : undefined,
      },
      include: {
        workUnit: true,
        jobGrade: true,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CREATE_EMPLOYEE',
      entityType: 'Employee',
      entityId: created.id,
      after: created,
    });

    return this.serialize(created);
  }

  async listSchemes() {
    return this.serialize(
      await this.prisma.proportionScheme.findMany({
        include: { workUnit: true },
        orderBy: [{ effectiveFrom: 'desc' }, { name: 'asc' }],
      }),
    );
  }

  async createScheme(user: AuthenticatedUser, input: CreateSchemeInput) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const created = await this.prisma.proportionScheme.create({
      data: {
        ...input,
        percentage: this.toDecimal(input.percentage),
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo
          ? new Date(input.effectiveTo)
          : undefined,
      },
      include: { workUnit: true },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CREATE_SCHEME',
      entityType: 'ProportionScheme',
      entityId: created.id,
      after: created,
    });

    return this.serialize(created);
  }

  async listDeductionRules() {
    return this.serialize(
      await this.prisma.deductionRule.findMany({ orderBy: { code: 'asc' } }),
    );
  }

  async createDeductionRule(
    user: AuthenticatedUser,
    input: CreateDeductionRuleInput,
  ) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const created = await this.prisma.deductionRule.create({
      data: {
        ...input,
        percentage: this.toDecimal(input.percentage),
        effectiveFrom: new Date(input.effectiveFrom),
        effectiveTo: input.effectiveTo
          ? new Date(input.effectiveTo)
          : undefined,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CREATE_DEDUCTION_RULE',
      entityType: 'DeductionRule',
      entityId: created.id,
      after: created,
    });

    return this.serialize(created);
  }

  async listPeriods() {
    return this.serialize(
      await this.prisma.calculationPeriod.findMany({
        include: {
          approvals: true,
          _count: {
            select: {
              results: true,
              transactions: true,
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
    );
  }

  async createPeriod(user: AuthenticatedUser, input: CreatePeriodInput) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const label = `${String(input.month).padStart(2, '0')}/${input.year}`;

    const created = await this.prisma.calculationPeriod.create({
      data: {
        month: input.month,
        year: input.year,
        label,
        budgetCap: this.toDecimal(input.budgetCap),
        healthcarePool: this.toDecimal(input.healthcarePool),
        administrativePool: this.toDecimal(input.administrativePool),
        createdById: user.id,
        approvals: {
          create: [
            { level: ApprovalLevel.UNIT },
            { level: ApprovalLevel.FINANCE },
            { level: ApprovalLevel.DIRECTOR },
          ],
        },
      },
      include: { approvals: true },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CREATE_PERIOD',
      entityType: 'CalculationPeriod',
      entityId: created.id,
      after: created,
    });

    return this.serialize(created);
  }

  async getPeriodResults(periodId: string, user: AuthenticatedUser) {
    const period = await this.prisma.calculationPeriod.findUnique({
      where: { id: periodId },
      include: {
        results: {
          include: {
            employee: { include: { workUnit: true, jobGrade: true } },
            workUnit: true,
          },
          orderBy: { finalAmount: 'desc' },
        },
        approvals: true,
      },
    });

    if (!period) {
      throw new NotFoundException('Periode tidak ditemukan.');
    }

    if (user.role === Role.EMPLOYEE && user.employeeId) {
      period.results = period.results.filter(
        (result) => result.employeeId === user.employeeId,
      );
    }

    if (user.role === Role.VERIFIER_UNIT && user.workUnitId) {
      period.results = period.results.filter(
        (result) => result.workUnitId === user.workUnitId,
      );
    }

    return this.serialize(period);
  }

  async upsertAttendance(
    user: AuthenticatedUser,
    periodId: string,
    rows: UpsertAttendanceInput[],
  ) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            periodId_employeeId: {
              periodId,
              employeeId: row.employeeId,
            },
          },
          create: {
            periodId,
            employeeId: row.employeeId,
            attendanceScore: this.toDecimal(row.attendanceScore),
            leaveDays: row.leaveDays,
            disciplinaryAction: row.disciplinaryAction,
            trainingMonths: row.trainingMonths,
            studyDaysPerWeek: row.studyDaysPerWeek,
          },
          update: {
            attendanceScore: this.toDecimal(row.attendanceScore),
            leaveDays: row.leaveDays,
            disciplinaryAction: row.disciplinaryAction,
            trainingMonths: row.trainingMonths,
            studyDaysPerWeek: row.studyDaysPerWeek,
          },
        }),
      ),
    );

    await this.auditService.log({
      actorId: user.id,
      action: 'UPSERT_ATTENDANCE',
      entityType: 'CalculationPeriod',
      entityId: periodId,
      after: { rowCount: rows.length },
    });

    return { message: 'Data kehadiran berhasil disimpan.' };
  }

  async upsertPerformance(
    user: AuthenticatedUser,
    periodId: string,
    rows: UpsertPerformanceInput[],
  ) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    await this.prisma.$transaction(
      rows.map((row) =>
        this.prisma.performanceScore.upsert({
          where: {
            periodId_employeeId: {
              periodId,
              employeeId: row.employeeId,
            },
          },
          create: {
            periodId,
            employeeId: row.employeeId,
            attendanceWeight: this.toDecimal(row.attendanceWeight),
            qualityWeight: this.toDecimal(row.qualityWeight),
            finalScore: this.toDecimal(
              this.decimal(row.attendanceWeight)
                .mul(0.4)
                .plus(this.decimal(row.qualityWeight).mul(0.6)),
            ),
          },
          update: {
            attendanceWeight: this.toDecimal(row.attendanceWeight),
            qualityWeight: this.toDecimal(row.qualityWeight),
            finalScore: this.toDecimal(
              this.decimal(row.attendanceWeight)
                .mul(0.4)
                .plus(this.decimal(row.qualityWeight).mul(0.6)),
            ),
          },
        }),
      ),
    );

    await this.auditService.log({
      actorId: user.id,
      action: 'UPSERT_PERFORMANCE',
      entityType: 'CalculationPeriod',
      entityId: periodId,
      after: { rowCount: rows.length },
    });

    return { message: 'Skor kinerja berhasil disimpan.' };
  }

  async importServiceTransactions(
    user: AuthenticatedUser,
    periodId: string,
    file: Express.Multer.File,
  ) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    if (!file) {
      throw new BadRequestException('File impor wajib diunggah.');
    }

    const period = await this.prisma.calculationPeriod.findUnique({
      where: { id: periodId },
    });
    if (!period) {
      throw new NotFoundException('Periode tidak ditemukan.');
    }

    const rows = this.readImportRows(file);

    const batch = await this.prisma.importBatch.create({
      data: {
        periodId,
        sourceType: 'SERVICE',
        fileName: file.originalname,
        uploadedById: user.id,
        totalRows: rows.length,
      },
    });

    const unitMap = new Map(
      (
        await this.prisma.workUnit.findMany({
          select: { id: true, code: true },
        })
      ).map((item) => [item.code, item.id]),
    );

    const employeeMap = new Map(
      (
        await this.prisma.employee.findMany({
          select: { id: true, employeeNumber: true },
        })
      ).map((item) => [item.employeeNumber, item.id]),
    );

    const errors: Array<{ row: number; message: string }> = [];
    const preparedRows: Prisma.ServiceTransactionCreateManyInput[] =
      rows.flatMap((row, index) => {
        const workUnitId = unitMap.get(
          this.readCell(row, 'Kode Unit Kerja').trim(),
        );
        const employeeId = employeeMap.get(
          this.readCell(row, 'Kode Pegawai Pelaksana').trim(),
        );

        if (!workUnitId || !employeeId) {
          errors.push({
            row: index + 1,
            message:
              'Kode unit kerja atau kode pegawai tidak ditemukan di master data.',
          });
          return [];
        }

        const payerValue = this.readCell(row, 'Status Penjaminan')
          .trim()
          .toUpperCase();
        if (payerValue !== 'JKN' && payerValue !== 'NON_JKN') {
          errors.push({
            row: index + 1,
            message: 'Status penjaminan harus JKN atau NON_JKN.',
          });
          return [];
        }

        return [
          {
            periodId,
            importBatchId: batch.id,
            workUnitId,
            employeeId,
            serviceDate: new Date(String(row['Tanggal Layanan'])),
            patientReference: this.readCell(
              row,
              'Kode/No. RM Pasien',
              `AUTO-${index + 1}`,
            ),
            serviceType: this.readCell(row, 'Jenis Layanan/Tindakan').trim(),
            roleInService: this.readCell(row, 'Peran dalam Tindakan').trim(),
            payerType: payerValue,
            tariff: this.toDecimal(Number(row['Nilai Tarif/Klaim'] ?? 0)),
            quantity: Number(row['Jumlah Pasien/Tindakan'] ?? 1),
          },
        ];
      });

    if (preparedRows.length) {
      await this.prisma.serviceTransaction.createMany({
        data: preparedRows,
      });
    }

    await this.prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        successRows: preparedRows.length,
        failedRows: errors.length,
        status: errors.length ? 'FAILED' : 'PROCESSED',
        errorSummary: errors,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'IMPORT_SERVICE_TRANSACTIONS',
      entityType: 'ImportBatch',
      entityId: batch.id,
      after: {
        fileName: file.originalname,
        totalRows: rows.length,
        successRows: preparedRows.length,
        errors,
      },
    });

    return {
      batchId: batch.id,
      totalRows: rows.length,
      importedRows: preparedRows.length,
      errors,
    };
  }

  private readImportRows(file: Express.Multer.File): Record<string, unknown>[] {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (extension === 'csv') {
      return parse(file.buffer.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  }

  private readCell(
    row: Record<string, unknown>,
    key: string,
    fallback = '',
  ): string {
    const value = row[key];

    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return fallback;
  }

  private async getApplicableDeductionPercentage(
    periodId: string,
    employeeId: string,
  ) {
    const [attendance, rules] = await Promise.all([
      this.prisma.attendanceRecord.findUnique({
        where: { periodId_employeeId: { periodId, employeeId } },
      }),
      this.prisma.deductionRule.findMany({
        where: {
          effectiveFrom: { lte: new Date() },
        },
      }),
    ]);

    if (!attendance) {
      return new Decimal(0);
    }

    const percentages: Decimal[] = [];
    const getRule = (code: string) => {
      const rule = rules.find((item) => item.code === code);
      return rule ? new Decimal(rule.percentage.toString()) : new Decimal(0);
    };

    if (attendance.leaveDays >= 30) {
      percentages.push(getRule('LONG_LEAVE'));
    }

    if (attendance.disciplinaryAction) {
      percentages.push(getRule('DISCIPLINE'));
    }

    if (attendance.trainingMonths > 1) {
      percentages.push(getRule('TRAINING_LONG'));
    }

    if (attendance.studyDaysPerWeek >= 3) {
      percentages.push(getRule('STUDY_ASSIGNMENT'));
    }

    return percentages.reduce(
      (highest, current) => (current.greaterThan(highest) ? current : highest),
      new Decimal(0),
    );
  }

  async calculatePeriod(periodId: string, user: AuthenticatedUser) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL]);

    const period = await this.prisma.calculationPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException('Periode tidak ditemukan.');
    }

    const [employees, transactions, schemes, performanceScores] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: { isActive: true },
          include: { jobGrade: true, workUnit: true },
        }),
        this.prisma.serviceTransaction.findMany({
          where: { periodId },
          include: { workUnit: true, employee: true },
        }),
        this.prisma.proportionScheme.findMany({
          where: {
            effectiveFrom: { lte: new Date(period.year, period.month - 1, 31) },
            OR: [
              { effectiveTo: null },
              {
                effectiveTo: {
                  gte: new Date(period.year, period.month - 1, 1),
                },
              },
            ],
          },
        }),
        this.prisma.performanceScore.findMany({
          where: { periodId },
        }),
      ]);

    if (!employees.length) {
      throw new BadRequestException('Master pegawai belum tersedia.');
    }

    const schemeKey = (
      workUnitId: string,
      serviceType: string,
      roleInService: string,
      payerType: string,
    ) =>
      `${workUnitId}::${serviceType.toLowerCase()}::${roleInService.toLowerCase()}::${payerType}`;

    const schemeMap = new Map(
      schemes.map((scheme) => [
        schemeKey(
          scheme.workUnitId,
          scheme.serviceType,
          scheme.roleInService,
          scheme.payerType,
        ),
        new Decimal(scheme.percentage.toString()).div(100),
      ]),
    );

    const performanceMap = new Map(
      performanceScores.map((score) => [
        score.employeeId,
        new Decimal(score.finalScore.toString()),
      ]),
    );

    const healthcareEmployees = employees.filter(
      (item) => item.category === EmployeeCategory.HEALTHCARE,
    );
    const adminEmployees = employees.filter(
      (item) =>
        item.category === EmployeeCategory.ADMINISTRATIVE ||
        item.category === EmployeeCategory.STRUCTURAL,
    );

    const healthcareWeightTotal = healthcareEmployees.reduce(
      (total, employee) =>
        total.plus(employee.jobGrade?.weight.toString() ?? '1'),
      new Decimal(0),
    );
    const adminWeightTotal = adminEmployees.reduce(
      (total, employee) => total.plus(performanceMap.get(employee.id) ?? 1),
      new Decimal(0),
    );

    const interimResults = await Promise.all(
      employees.map(async (employee) => {
        let gross = new Decimal(0);
        const employeeTransactions = transactions.filter(
          (transaction) => transaction.employeeId === employee.id,
        );

        if (employee.category === EmployeeCategory.MEDICAL) {
          gross = employeeTransactions.reduce((sum, transaction) => {
            const percentage =
              schemeMap.get(
                schemeKey(
                  transaction.workUnitId,
                  transaction.serviceType,
                  transaction.roleInService,
                  transaction.payerType,
                ),
              ) ?? new Decimal(0);

            return sum.plus(
              new Decimal(transaction.tariff.toString())
                .mul(transaction.quantity)
                .mul(percentage),
            );
          }, new Decimal(0));
        } else if (employee.category === EmployeeCategory.HEALTHCARE) {
          const weight = new Decimal(
            employee.jobGrade?.weight.toString() ?? '1',
          );
          gross = healthcareWeightTotal.greaterThan(0)
            ? new Decimal(period.healthcarePool.toString()).mul(
                weight.div(healthcareWeightTotal),
              )
            : new Decimal(0);
        } else {
          const score = performanceMap.get(employee.id) ?? new Decimal(1);
          gross = adminWeightTotal.greaterThan(0)
            ? new Decimal(period.administrativePool.toString()).mul(
                score.div(adminWeightTotal),
              )
            : new Decimal(0);
        }

        const minimumGuarantee = employee.minimumGuarantee
          ? new Decimal(employee.minimumGuarantee.toString())
          : new Decimal(0);
        if (minimumGuarantee.greaterThan(gross)) {
          gross = minimumGuarantee;
        }

        const deductionPercentage = await this.getApplicableDeductionPercentage(
          periodId,
          employee.id,
        );
        const deductionAmount = gross.mul(deductionPercentage.div(100));
        const netBeforeAdjustment = gross.minus(deductionAmount);

        return {
          employee,
          gross,
          deductionAmount,
          netBeforeAdjustment,
          details: {
            transactionCount: employeeTransactions.length,
            category: employee.category,
            appliedDeductionPercentage: deductionPercentage.toString(),
            healthcarePool: period.healthcarePool.toString(),
            administrativePool: period.administrativePool.toString(),
          },
        };
      }),
    );

    const grandTotal = interimResults.reduce(
      (sum, item) => sum.plus(item.netBeforeAdjustment),
      new Decimal(0),
    );
    const budgetCap = new Decimal(period.budgetCap.toString());
    const adjustmentFactor =
      grandTotal.greaterThan(budgetCap) && grandTotal.greaterThan(0)
        ? budgetCap.div(grandTotal)
        : new Decimal(1);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.calculationResult.deleteMany({ where: { periodId } });

      for (const result of interimResults) {
        const adjustedFinal = result.netBeforeAdjustment.mul(adjustmentFactor);
        const adjustmentAmount =
          result.netBeforeAdjustment.minus(adjustedFinal);

        await transaction.calculationResult.create({
          data: {
            periodId,
            employeeId: result.employee.id,
            workUnitId: result.employee.workUnitId,
            grossAmount: this.toDecimal(result.gross),
            deductionAmount: this.toDecimal(result.deductionAmount),
            adjustmentAmount: this.toDecimal(adjustmentAmount),
            finalAmount: this.toDecimal(adjustedFinal),
            details: result.details,
            formulaSnapshot: {
              adjustmentFactor: adjustmentFactor.toFixed(6),
              budgetCap: budgetCap.toFixed(2),
            },
          },
        });
      }

      await transaction.calculationPeriod.update({
        where: { id: periodId },
        data: { status: PeriodStatus.READY_FOR_UNIT_VERIFICATION },
      });
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'CALCULATE_PERIOD',
      entityType: 'CalculationPeriod',
      entityId: periodId,
      after: {
        adjustmentFactor: adjustmentFactor.toString(),
        resultCount: interimResults.length,
      },
    });

    return this.getPeriodResults(periodId, user);
  }

  async submitApproval(
    periodId: string,
    level: ApprovalLevel,
    status: ApprovalStatus,
    note: string | undefined,
    user: AuthenticatedUser,
  ) {
    const roleMap: Record<ApprovalLevel, Role[]> = {
      [ApprovalLevel.UNIT]: [Role.VERIFIER_UNIT, Role.SUPER_ADMIN],
      [ApprovalLevel.FINANCE]: [Role.FINANCE, Role.SUPER_ADMIN],
      [ApprovalLevel.DIRECTOR]: [Role.DIRECTOR, Role.SUPER_ADMIN],
    };

    this.ensureRole(user, roleMap[level]);

    const period = await this.prisma.calculationPeriod.findUnique({
      where: { id: periodId },
      include: { approvals: true },
    });

    if (!period) {
      throw new NotFoundException('Periode tidak ditemukan.');
    }

    const approval = period.approvals.find((item) => item.level === level);
    if (!approval) {
      throw new NotFoundException('Tahap approval tidak ditemukan.');
    }

    const updatedApproval = await this.prisma.approvalStep.update({
      where: { id: approval.id },
      data: {
        status,
        note,
        actedById: user.id,
        actedAt: new Date(),
      },
    });

    let nextStatus = period.status;
    if (level === ApprovalLevel.UNIT && status === ApprovalStatus.APPROVED) {
      nextStatus = PeriodStatus.READY_FOR_FINANCE_VERIFICATION;
    } else if (
      level === ApprovalLevel.FINANCE &&
      status === ApprovalStatus.APPROVED
    ) {
      nextStatus = PeriodStatus.READY_FOR_DIRECTOR_APPROVAL;
    } else if (
      level === ApprovalLevel.DIRECTOR &&
      status === ApprovalStatus.APPROVED
    ) {
      nextStatus = PeriodStatus.PUBLISHED;
    } else if (status === ApprovalStatus.REJECTED) {
      nextStatus = PeriodStatus.DRAFT;
    }

    await this.prisma.calculationPeriod.update({
      where: { id: periodId },
      data: {
        status: nextStatus,
        finalizedAt:
          nextStatus === PeriodStatus.PUBLISHED ? new Date() : undefined,
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: `APPROVAL_${level}_${status}`,
      entityType: 'ApprovalStep',
      entityId: updatedApproval.id,
      after: updatedApproval,
    });

    return this.getPeriodResults(periodId, user);
  }

  async getMySlips(user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException(
        'Akun Anda belum terhubung ke data pegawai.',
      );
    }

    const slips = await this.prisma.calculationResult.findMany({
      where: {
        employeeId: user.employeeId,
        period: {
          status: { in: [PeriodStatus.FINALIZED, PeriodStatus.PUBLISHED] },
        },
      },
      include: {
        period: true,
        workUnit: true,
        employee: true,
      },
      orderBy: [{ period: { year: 'desc' } }, { period: { month: 'desc' } }],
    });

    return this.serialize(slips);
  }

  async downloadSlip(periodId: string, user: AuthenticatedUser) {
    if (!user.employeeId) {
      throw new ForbiddenException(
        'Akun Anda belum terhubung ke data pegawai.',
      );
    }

    const result = await this.prisma.calculationResult.findUnique({
      where: {
        periodId_employeeId: {
          periodId,
          employeeId: user.employeeId,
        },
      },
      include: {
        period: true,
        employee: true,
        workUnit: true,
      },
    });

    if (!result) {
      throw new NotFoundException('Slip tidak ditemukan.');
    }

    return this.reportsService.generateSlipPdf({
      periodLabel: result.period.label,
      result,
    });
  }

  async exportPeriodWorkbook(periodId: string, user: AuthenticatedUser) {
    this.ensureRole(user, [
      Role.SUPER_ADMIN,
      Role.ADMIN_JASPEL,
      Role.VERIFIER_UNIT,
      Role.FINANCE,
      Role.DIRECTOR,
      Role.AUDITOR,
    ]);

    const period = await this.prisma.calculationPeriod.findUnique({
      where: { id: periodId },
      include: {
        results: {
          include: {
            employee: true,
            workUnit: true,
          },
        },
      },
    });

    if (!period) {
      throw new NotFoundException('Periode tidak ditemukan.');
    }

    return this.reportsService.generatePeriodWorkbook({
      periodLabel: period.label,
      rows: period.results
        .filter((row) =>
          user.role === Role.VERIFIER_UNIT && user.workUnitId
            ? row.workUnitId === user.workUnitId
            : true,
        )
        .map((row) => ({
          employeeNumber: row.employee.employeeNumber,
          employeeName: row.employee.fullName,
          unitName: row.workUnit.name,
          grossAmount: row.grossAmount.toString(),
          deductionAmount: row.deductionAmount.toString(),
          adjustmentAmount: row.adjustmentAmount.toString(),
          finalAmount: row.finalAmount.toString(),
        })),
    });
  }

  async getAuditLogs(user: AuthenticatedUser) {
    this.ensureRole(user, [Role.SUPER_ADMIN, Role.ADMIN_JASPEL, Role.AUDITOR]);
    return this.serialize(
      await this.prisma.auditLog.findMany({
        include: {
          actor: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );
  }
}
