import { Injectable } from '@nestjs/common';
import { CalculationResult, Employee, WorkUnit } from '@prisma/client';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

type ResultWithRelations = CalculationResult & {
  employee: Employee;
  workUnit: WorkUnit;
};

@Injectable()
export class ReportsService {
  async generateSlipPdf(params: {
    periodLabel: string;
    result: ResultWithRelations;
  }) {
    const chunks: Buffer[] = [];
    const document = new PDFDocument({ margin: 40 });

    return await new Promise<Buffer>((resolve, reject) => {
      document.on('data', (chunk) => chunks.push(chunk as Buffer));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      document.fontSize(18).text('Slip Jaspel PINUS', { align: 'center' });
      document.moveDown();
      document.fontSize(11);
      document.text(`Periode: ${params.periodLabel}`);
      document.text(`Pegawai: ${params.result.employee.fullName}`);
      document.text(`NIP/NIK: ${params.result.employee.employeeNumber}`);
      document.text(`Unit Kerja: ${params.result.workUnit.name}`);
      document.moveDown();
      document.text(`Gross: Rp ${params.result.grossAmount}`);
      document.text(`Potongan: Rp ${params.result.deductionAmount}`);
      document.text(`Penyesuaian: Rp ${params.result.adjustmentAmount}`);
      document.text(`Final: Rp ${params.result.finalAmount}`);
      document.moveDown();
      document.text('Rincian Perhitungan', { underline: true });
      document.text(JSON.stringify(params.result.details, null, 2));
      document.end();
    });
  }

  async generatePeriodWorkbook(params: {
    periodLabel: string;
    rows: Array<{
      employeeNumber: string;
      employeeName: string;
      unitName: string;
      grossAmount: string;
      deductionAmount: string;
      adjustmentAmount: string;
      finalAmount: string;
    }>;
  }) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Jaspel');

    sheet.columns = [
      { header: 'Periode', key: 'periodLabel', width: 20 },
      { header: 'Nomor Pegawai', key: 'employeeNumber', width: 20 },
      { header: 'Nama Pegawai', key: 'employeeName', width: 30 },
      { header: 'Unit', key: 'unitName', width: 24 },
      { header: 'Gross', key: 'grossAmount', width: 16 },
      { header: 'Potongan', key: 'deductionAmount', width: 16 },
      { header: 'Penyesuaian', key: 'adjustmentAmount', width: 16 },
      { header: 'Final', key: 'finalAmount', width: 16 },
    ];

    params.rows.forEach((row) => {
      sheet.addRow({
        periodLabel: params.periodLabel,
        ...row,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
