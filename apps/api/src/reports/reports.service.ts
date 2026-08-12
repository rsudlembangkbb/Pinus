import { Injectable, NotFoundException } from "@nestjs/common";
import * as ExcelJS from "exceljs";
import archiver from "archiver";
import { PassThrough } from "stream";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { renderSlipPdf, SlipData } from "./slip.pdf";
import { PERIOD_STATUS_LABELS, PeriodStatus } from "@pinus/shared";

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(chunk as Buffer));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async fetchSlipData(periodId: string, employeeId: string): Promise<SlipData> {
    const [period, result] = await Promise.all([
      this.prisma.calculationPeriod.findUnique({ where: { id: periodId } }),
      this.prisma.calculationResult.findUnique({
        where: { periodId_employeeId: { periodId, employeeId } },
        include: { employee: { include: { workUnit: true } } },
      }),
    ]);
    if (!period || !result) throw new NotFoundException("Hasil kalkulasi tidak ditemukan untuk slip ini");

    const components = result.components as Record<string, unknown>;
    return {
      employeeName: result.employee.fullName,
      employeeNip: result.employee.nip,
      workUnitName: result.employee.workUnit.name,
      staffCategory: result.staffCategory,
      periodName: period.name,
      periodStatus: PERIOD_STATUS_LABELS[period.status as PeriodStatus] ?? period.status,
      grossAmount: result.grossAmount.toString(),
      deductionAmount: result.deductionAmount.toString(),
      deductionTrigger: (components.deduction as { trigger: string | null } | undefined)?.trigger ?? null,
      minimumRequirementApplied: result.minimumRequirementApplied,
      paguAdjustmentFactor: result.paguAdjustmentFactor.toString(),
      netAmount: result.netAmount.toString(),
      components,
      generatedAt: new Date(),
    };
  }

  async generateSlipPdf(periodId: string, employeeId: string, actorId: string): Promise<Buffer> {
    const data = await this.fetchSlipData(periodId, employeeId);
    const doc = renderSlipPdf(data);
    const buffer = await streamToBuffer(doc);
    await this.auditService.record({
      actorId,
      action: "EXPORT_SLIP",
      entityType: "CalculationResult",
      entityId: `${periodId}:${employeeId}`,
    });
    return buffer;
  }

  async generateBatchSlipsZip(periodId: string, actorId: string): Promise<Buffer> {
    const results = await this.prisma.calculationResult.findMany({
      where: { periodId },
      include: { employee: true },
    });
    if (results.length === 0) throw new NotFoundException("Belum ada hasil kalkulasi untuk periode ini");

    const archive = archiver("zip", { zlib: { level: 9 } });
    const output = new PassThrough();
    archive.pipe(output);
    const bufferPromise = streamToBuffer(output);

    for (const r of results) {
      const data = await this.fetchSlipData(periodId, r.employeeId);
      const doc = renderSlipPdf(data);
      const pdfBuffer = await streamToBuffer(doc);
      archive.append(pdfBuffer, { name: `${r.employee.nip}-${r.employee.fullName.replace(/[^a-zA-Z0-9]/g, "_")}.pdf` });
    }

    await archive.finalize();
    const buffer = await bufferPromise;

    await this.auditService.record({
      actorId,
      action: "EXPORT_SLIP_BATCH",
      entityType: "CalculationPeriod",
      entityId: periodId,
      after: { count: results.length },
    });

    return buffer;
  }

  async generateUnitRecapExcel(periodId: string, actorId: string, workUnitId?: string): Promise<Buffer> {
    const period = await this.prisma.calculationPeriod.findUnique({ where: { id: periodId } });
    if (!period) throw new NotFoundException("Periode tidak ditemukan");

    const results = await this.prisma.calculationResult.findMany({
      where: { periodId, employee: workUnitId ? { workUnitId } : undefined },
      include: { employee: { include: { workUnit: true } } },
      orderBy: [{ employee: { workUnit: { name: "asc" } } }, { employee: { fullName: "asc" } }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Rekap ${period.name}`);
    sheet.columns = [
      { header: "Unit Kerja", key: "unit", width: 25 },
      { header: "NIP", key: "nip", width: 22 },
      { header: "Nama Pegawai", key: "name", width: 28 },
      { header: "Kategori Tenaga", key: "category", width: 18 },
      { header: "Jumlah Kotor", key: "gross", width: 18 },
      { header: "Potongan", key: "deduction", width: 15 },
      { header: "Min. Requirement", key: "minReq", width: 16 },
      { header: "Faktor Pagu", key: "factor", width: 14 },
      { header: "Jumlah Bersih", key: "net", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const r of results) {
      sheet.addRow({
        unit: r.employee.workUnit.name,
        nip: r.employee.nip,
        name: r.employee.fullName,
        category: r.staffCategory,
        gross: Number(r.grossAmount),
        deduction: Number(r.deductionAmount),
        minReq: r.minimumRequirementApplied ? "Ya" : "Tidak",
        factor: Number(r.paguAdjustmentFactor),
        net: Number(r.netAmount),
      });
    }

    const totalRow = sheet.addRow({
      unit: "TOTAL",
      gross: results.reduce((a, r) => a + Number(r.grossAmount), 0),
      deduction: results.reduce((a, r) => a + Number(r.deductionAmount), 0),
      net: results.reduce((a, r) => a + Number(r.netAmount), 0),
    });
    totalRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();

    await this.auditService.record({
      actorId,
      action: "EXPORT_UNIT_RECAP",
      entityType: "CalculationPeriod",
      entityId: periodId,
      after: { workUnitId, rowCount: results.length },
    });

    return Buffer.from(buffer);
  }

  async generateRawDataExport(periodId: string, actorId: string): Promise<Buffer> {
    const [period, transactions, results] = await Promise.all([
      this.prisma.calculationPeriod.findUnique({ where: { id: periodId } }),
      this.prisma.serviceTransaction.findMany({
        where: { periodId },
        include: { employee: true, workUnit: true },
      }),
      this.prisma.calculationResult.findMany({
        where: { periodId },
        include: { employee: true },
      }),
    ]);
    if (!period) throw new NotFoundException("Periode tidak ditemukan");

    const workbook = new ExcelJS.Workbook();

    const txSheet = workbook.addWorksheet("Transaksi Layanan");
    txSheet.columns = [
      { header: "Tanggal", key: "date", width: 14 },
      { header: "Unit Kerja", key: "unit", width: 20 },
      { header: "No. RM", key: "rm", width: 16 },
      { header: "Layanan/Tindakan", key: "service", width: 30 },
      { header: "Status Penjaminan", key: "guarantee", width: 16 },
      { header: "Tarif", key: "tariff", width: 16 },
      { header: "NIP Pelaksana", key: "nip", width: 20 },
      { header: "Nama Pelaksana", key: "name", width: 26 },
      { header: "Peran", key: "role", width: 14 },
    ];
    txSheet.getRow(1).font = { bold: true };
    for (const t of transactions) {
      txSheet.addRow({
        date: t.serviceDate.toISOString().slice(0, 10),
        unit: t.workUnit.name,
        rm: t.patientRmCode,
        service: t.serviceName,
        guarantee: t.guaranteeStatus,
        tariff: Number(t.tariffAmount),
        nip: t.employee.nip,
        name: t.employee.fullName,
        role: t.serviceRole,
      });
    }

    const resultSheet = workbook.addWorksheet("Hasil Kalkulasi");
    resultSheet.columns = [
      { header: "NIP", key: "nip", width: 20 },
      { header: "Nama", key: "name", width: 26 },
      { header: "Kategori", key: "category", width: 16 },
      { header: "Gross", key: "gross", width: 16 },
      { header: "Potongan", key: "deduction", width: 16 },
      { header: "Net", key: "net", width: 16 },
      { header: "Formula Version", key: "formula", width: 18 },
    ];
    resultSheet.getRow(1).font = { bold: true };
    for (const r of results) {
      resultSheet.addRow({
        nip: r.employee.nip,
        name: r.employee.fullName,
        category: r.staffCategory,
        gross: Number(r.grossAmount),
        deduction: Number(r.deductionAmount),
        net: Number(r.netAmount),
        formula: r.formulaVersion,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    await this.auditService.record({
      actorId,
      action: "EXPORT_RAW_DATA",
      entityType: "CalculationPeriod",
      entityId: periodId,
    });

    return Buffer.from(buffer);
  }
}
