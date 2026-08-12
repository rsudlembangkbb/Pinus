import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import { ImportBatchType, ImportBatchStatus, ImportRowStatus } from "@pinus/shared";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../storage/storage.service";
import {
  ATTENDANCE_COLUMNS,
  INDEXING_SCORE_COLUMNS,
  PERFORMANCE_SCORE_COLUMNS,
  SERVICE_TRANSACTION_COLUMNS,
  TemplateColumn,
} from "./import-templates";
import { parseImportFile } from "./import-parser";
import {
  MasterDataLookups,
  validateAttendanceRow,
  validateIndexingScoreRow,
  validatePerformanceScoreRow,
  validateServiceTransactionRow,
} from "./import-validators";

const COLUMNS_BY_TYPE: Record<ImportBatchType, TemplateColumn[]> = {
  [ImportBatchType.SERVICE_TRANSACTION]: SERVICE_TRANSACTION_COLUMNS,
  [ImportBatchType.ATTENDANCE]: ATTENDANCE_COLUMNS,
  [ImportBatchType.PERFORMANCE_SCORE]: PERFORMANCE_SCORE_COLUMNS,
  [ImportBatchType.INDEXING_SCORE]: INDEXING_SCORE_COLUMNS,
};

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
  ) {}

  async generateTemplate(type: ImportBatchType): Promise<Buffer> {
    const columns = COLUMNS_BY_TYPE[type];
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: Math.max(20, c.header.length) }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRow(Object.fromEntries(columns.map((c) => [c.key, c.example])));
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async buildLookups(): Promise<MasterDataLookups> {
    const [workUnits, employees] = await Promise.all([
      this.prisma.workUnit.findMany({ select: { id: true, code: true, isActive: true } }),
      this.prisma.employee.findMany({ select: { id: true, nip: true, isActive: true, staffCategory: true } }),
    ]);
    return {
      workUnitByCode: new Map(workUnits.map((w) => [w.code.toUpperCase(), w])),
      employeeByNip: new Map(employees.map((e) => [e.nip, e])),
    };
  }

  async upload(
    type: ImportBatchType,
    periodId: string,
    file: { originalname: string; buffer: Buffer },
    uploaderId: string,
  ) {
    const period = await this.prisma.calculationPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Periode tidak ditemukan");
    if (period.lockedAt) throw new BadRequestException("Periode sudah terkunci, impor tidak diizinkan");

    const columns = COLUMNS_BY_TYPE[type];
    const rows = await parseImportFile(file.buffer, file.originalname, columns);
    if (rows.length === 0) throw new BadRequestException("Tidak ada baris data ditemukan pada berkas");

    const lookups = await this.buildLookups();
    const storagePath = await this.storageService.save(`imports/${periodId}`, file.originalname, file.buffer);

    const seenKeys = new Set<string>();
    const rowsToInsert: { rowNumber: number; rawData: Prisma.InputJsonValue; status: ImportRowStatus; errors: Prisma.InputJsonValue | undefined; data?: unknown }[] = [];

    for (const row of rows) {
      let result: { valid: boolean; errors: string[]; data?: unknown };
      switch (type) {
        case ImportBatchType.SERVICE_TRANSACTION:
          result = validateServiceTransactionRow(row.raw, lookups, period.year, period.month);
          break;
        case ImportBatchType.ATTENDANCE:
          result = validateAttendanceRow(row.raw, lookups);
          break;
        case ImportBatchType.PERFORMANCE_SCORE:
          result = validatePerformanceScoreRow(row.raw, lookups);
          break;
        case ImportBatchType.INDEXING_SCORE:
          result = validateIndexingScoreRow(row.raw, lookups);
          break;
        default:
          result = { valid: false, errors: ["Tipe impor tidak dikenal"] };
      }

      const errors = [...result.errors];

      if (result.valid && type === ImportBatchType.SERVICE_TRANSACTION) {
        const d = result.data as { serviceDate: Date; workUnitId: string; patientRmCode: string; employeeId: string; serviceRole: string };
        const dedupeKey = `${d.serviceDate.toISOString()}|${d.workUnitId}|${d.patientRmCode}|${d.employeeId}|${d.serviceRole}`;
        if (seenKeys.has(dedupeKey)) {
          errors.push("Baris duplikat terdeteksi dalam berkas ini (tanggal+unit+RM+pegawai+peran sama)");
        } else {
          seenKeys.add(dedupeKey);
        }
      }

      rowsToInsert.push({
        rowNumber: row.rowNumber,
        rawData: row.raw as Prisma.InputJsonValue,
        status: errors.length === 0 ? ImportRowStatus.VALID : ImportRowStatus.INVALID,
        errors: errors.length > 0 ? (errors as unknown as Prisma.InputJsonValue) : undefined,
        data: result.data,
      });
    }

    const validCount = rowsToInsert.filter((r) => r.status === ImportRowStatus.VALID).length;
    const invalidCount = rowsToInsert.length - validCount;

    const batch = await this.prisma.importBatch.create({
      data: {
        type,
        periodId,
        fileName: file.originalname,
        fileStoragePath: storagePath,
        uploadedById: uploaderId,
        status: validCount > 0 ? ImportBatchStatus.VALIDATED : ImportBatchStatus.VALIDATION_FAILED,
        totalRows: rowsToInsert.length,
        validRows: validCount,
        invalidRows: invalidCount,
        rows: {
          create: rowsToInsert.map((r) => ({
            rowNumber: r.rowNumber,
            rawData: r.rawData,
            status: r.status,
            errors: r.errors,
          })),
        },
      },
      include: { rows: { where: { status: ImportRowStatus.INVALID }, take: 200 } },
    });

    await this.auditService.record({
      actorId: uploaderId,
      action: "UPLOAD",
      entityType: "ImportBatch",
      entityId: batch.id,
      after: { type, periodId, fileName: file.originalname, totalRows: batch.totalRows, validRows: validCount, invalidRows: invalidCount },
    });

    return batch;
  }

  async listBatches(periodId: string) {
    return this.prisma.importBatch.findMany({
      where: { periodId },
      include: { uploadedBy: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async getBatch(id: string) {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id },
      include: { uploadedBy: { select: { id: true, username: true } } },
    });
    if (!batch) throw new NotFoundException("Sesi impor tidak ditemukan");
    return batch;
  }

  async getBatchRows(id: string, status?: ImportRowStatus, skip = 0, take = 100) {
    return this.prisma.importRow.findMany({
      where: { batchId: id, status },
      orderBy: { rowNumber: "asc" },
      skip,
      take,
    });
  }

  async commit(batchId: string, actorId: string) {
    const batch = await this.getBatch(batchId);
    if (batch.status === ImportBatchStatus.COMMITTED) {
      throw new BadRequestException("Sesi impor ini sudah dikomit sebelumnya");
    }
    if (batch.validRows === 0) throw new BadRequestException("Tidak ada baris valid untuk dikomit");

    const validRows = await this.prisma.importRow.findMany({
      where: { batchId, status: ImportRowStatus.VALID },
    });

    const lookups = await this.buildLookups();

    await this.prisma.$transaction(async (tx) => {
      for (const row of validRows) {
        const raw = row.rawData as Record<string, string>;

        if (batch.type === ImportBatchType.SERVICE_TRANSACTION) {
          const period = await tx.calculationPeriod.findUniqueOrThrow({ where: { id: batch.periodId } });
          const parsed = validateServiceTransactionRow(raw, lookups, period.year, period.month);
          if (!parsed.valid || !parsed.data) continue;
          await tx.serviceTransaction.create({
            data: {
              periodId: batch.periodId,
              workUnitId: parsed.data.workUnitId,
              serviceDate: parsed.data.serviceDate,
              patientRmCode: parsed.data.patientRmCode,
              serviceName: parsed.data.serviceName,
              guaranteeStatus: parsed.data.guaranteeStatus,
              tariffAmount: parsed.data.tariffAmount,
              employeeId: parsed.data.employeeId,
              serviceRole: parsed.data.serviceRole,
              importBatchId: batch.id,
            },
          });
        } else if (batch.type === ImportBatchType.ATTENDANCE) {
          const parsed = validateAttendanceRow(raw, lookups);
          if (!parsed.valid || !parsed.data) continue;
          await tx.attendanceRecord.upsert({
            where: { employeeId_periodId: { employeeId: parsed.data.employeeId, periodId: batch.periodId } },
            create: {
              employeeId: parsed.data.employeeId,
              periodId: batch.periodId,
              leaveDays: parsed.data.leaveDays,
              leaveType: parsed.data.leaveType,
              disciplinaryAction: parsed.data.disciplinaryAction,
              disciplinaryNotes: parsed.data.disciplinaryNotes,
              fightDuringCoaching: parsed.data.fightDuringCoaching,
              trainingDays: parsed.data.trainingDays,
              studyAssignmentAbsenceDaysPerWeek: parsed.data.studyAssignmentAbsenceDaysPerWeek,
              attendancePercent: parsed.data.attendancePercent,
              importBatchId: batch.id,
            },
            update: {
              leaveDays: parsed.data.leaveDays,
              leaveType: parsed.data.leaveType,
              disciplinaryAction: parsed.data.disciplinaryAction,
              disciplinaryNotes: parsed.data.disciplinaryNotes,
              fightDuringCoaching: parsed.data.fightDuringCoaching,
              trainingDays: parsed.data.trainingDays,
              studyAssignmentAbsenceDaysPerWeek: parsed.data.studyAssignmentAbsenceDaysPerWeek,
              attendancePercent: parsed.data.attendancePercent,
              importBatchId: batch.id,
            },
          });
        } else if (batch.type === ImportBatchType.PERFORMANCE_SCORE) {
          const parsed = validatePerformanceScoreRow(raw, lookups);
          if (!parsed.valid || !parsed.data) continue;
          await tx.performanceScore.upsert({
            where: { employeeId_periodId: { employeeId: parsed.data.employeeId, periodId: batch.periodId } },
            create: {
              employeeId: parsed.data.employeeId,
              periodId: batch.periodId,
              qualityScore: parsed.data.qualityScore,
              notes: parsed.data.notes,
              importBatchId: batch.id,
            },
            update: { qualityScore: parsed.data.qualityScore, notes: parsed.data.notes, importBatchId: batch.id },
          });
        } else if (batch.type === ImportBatchType.INDEXING_SCORE) {
          const parsed = validateIndexingScoreRow(raw, lookups);
          if (!parsed.valid || !parsed.data) continue;
          await tx.indexingScore.upsert({
            where: {
              employeeId_periodId_variableCode: {
                employeeId: parsed.data.employeeId,
                periodId: batch.periodId,
                variableCode: parsed.data.variableCode,
              },
            },
            create: {
              employeeId: parsed.data.employeeId,
              periodId: batch.periodId,
              variableCode: parsed.data.variableCode,
              score: parsed.data.score,
              importBatchId: batch.id,
            },
            update: { score: parsed.data.score, importBatchId: batch.id },
          });
        }
      }

      await tx.importRow.updateMany({
        where: { batchId, status: ImportRowStatus.VALID },
        data: { status: ImportRowStatus.COMMITTED },
      });
      await tx.importBatch.update({
        where: { id: batchId },
        data: { status: ImportBatchStatus.COMMITTED, committedAt: new Date() },
      });
    });

    await this.auditService.record({
      actorId,
      action: "COMMIT",
      entityType: "ImportBatch",
      entityId: batchId,
      after: { committedRows: validRows.length },
    });

    return this.getBatch(batchId);
  }
}
