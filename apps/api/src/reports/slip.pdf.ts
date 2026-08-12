import PDFDocument from "pdfkit";

export interface SlipData {
  employeeName: string;
  employeeNip: string;
  workUnitName: string;
  staffCategory: string;
  periodName: string;
  periodStatus: string;
  grossAmount: string;
  deductionAmount: string;
  deductionTrigger: string | null;
  minimumRequirementApplied: boolean;
  paguAdjustmentFactor: string;
  netAmount: string;
  components: unknown;
  generatedAt: Date;
}

function formatRupiah(value: string): string {
  const n = Math.round(Number(value));
  return `Rp ${n.toLocaleString("id-ID")}`;
}

/**
 * Renders a single employee's Jaspel slip as a PDF (PRD §5.5/§8.3). Pure
 * function over already-fetched data — the caller (ReportsService) owns all
 * DB access, keeping this testable without a database.
 */
export function renderSlipPdf(data: SlipData): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 50 });

  doc.fontSize(16).fillColor("#1b4332").text("PINUS — Slip Jasa Pelayanan", { align: "center" });
  doc.fontSize(10).fillColor("#333").text("RSUD Lembang — Kabupaten Bandung Barat", { align: "center" });
  doc.moveDown(1.5);

  doc.fontSize(11).fillColor("#000");
  const infoRows: [string, string][] = [
    ["Nama Pegawai", data.employeeName],
    ["NIP", data.employeeNip],
    ["Unit Kerja", data.workUnitName],
    ["Kategori Tenaga", data.staffCategory],
    ["Periode", data.periodName],
    ["Status", data.periodStatus],
  ];
  for (const [label, value] of infoRows) {
    doc.text(`${label}`, 50, doc.y, { continued: true, width: 150 });
    doc.text(`: ${value}`);
  }

  doc.moveDown(1);
  doc.strokeColor("#2d6a4f").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(12).fillColor("#1b4332").text("Rincian Perhitungan");
  doc.fontSize(11).fillColor("#000");
  doc.moveDown(0.3);

  const rows: [string, string][] = [
    ["Jumlah Kotor (Gross)", formatRupiah(data.grossAmount)],
    [
      "Potongan" + (data.deductionTrigger ? ` (${data.deductionTrigger})` : ""),
      `- ${formatRupiah(data.deductionAmount)}`,
    ],
    ["Ketentuan Minimum Diterapkan", data.minimumRequirementApplied ? "Ya" : "Tidak"],
    ["Faktor Penyesuaian Pagu", data.paguAdjustmentFactor],
  ];
  for (const [label, value] of rows) {
    doc.text(label, 50, doc.y, { continued: true, width: 300 });
    doc.text(value, { align: "right" });
  }

  doc.moveDown(0.5);
  doc.strokeColor("#2d6a4f").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(13).fillColor("#1b4332").text("Total Diterima", 50, doc.y, { continued: true, width: 300 });
  doc.fontSize(13).fillColor("#1b4332").text(formatRupiah(data.netAmount), { align: "right" });

  doc.moveDown(2);
  doc.fontSize(8).fillColor("#666").text(
    `Dokumen ini dihasilkan otomatis oleh sistem PINUS pada ${data.generatedAt.toLocaleString("id-ID")}. ` +
      "Rincian formula dan sumber data lengkap dapat ditelusuri pada dashboard transparansi Anda.",
    { align: "left" },
  );

  doc.end();
  return doc;
}
