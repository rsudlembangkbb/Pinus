import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import { formatRupiah, PERIOD_STATUS_LABELS } from "@pinus/shared";
import type { CalculationComponent, CalculationEngineKind, DeductionRuleCode, PeriodStatus } from "@pinus/shared";

export interface SlipInput {
  employee: { fullName: string; nip: string; workUnitName: string; category: string };
  period: { label: string; code: string; status: PeriodStatus };
  result: {
    engineKind: CalculationEngineKind;
    grossAmount: number;
    deductionAmount: number;
    deductionRuleCodes: DeductionRuleCode[];
    minimumRequirementApplied: boolean;
    minimumRequirementAmount: number | null;
    adjustmentFactorBp: number;
    netAmount: number;
    components: CalculationComponent[];
  };
  generatedAt: string;
}

const PINUS_GREEN = rgb(0.227, 0.471, 0.188); // #3a9640
const LEMBANG_BLUE = rgb(0.102, 0.282, 0.412); // #1a4869
const GRAY = rgb(0.4, 0.4, 0.4);
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

export async function generateSlipPdf(input: SlipInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Slip Jaspel - ${input.employee.fullName} - ${input.period.label}`);
  doc.setProducer("PINUS RSUD Lembang");
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = PAGE_HEIGHT - MARGIN;

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 70, width: PAGE_WIDTH, height: 70, color: LEMBANG_BLUE });
  page.drawText("PINUS — RSUD Lembang", { x: MARGIN, y: PAGE_HEIGHT - 32, size: 16, font: bold, color: rgb(1, 1, 1) });
  page.drawText("Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua", {
    x: MARGIN,
    y: PAGE_HEIGHT - 50,
    size: 9,
    font,
    color: rgb(0.9, 0.95, 0.9),
  });
  y = PAGE_HEIGHT - 100;

  page.drawText("Slip Rincian Jasa Pelayanan (Jaspel)", { x: MARGIN, y, size: 13, font: bold, color: PINUS_GREEN });
  y -= 26;

  const infoLines: [string, string][] = [
    ["Nama Pegawai", input.employee.fullName],
    ["NIP/NIK", input.employee.nip],
    ["Unit Kerja", input.employee.workUnitName],
    ["Kategori Tenaga", input.employee.category],
    ["Periode", input.period.label],
    ["Status Periode", PERIOD_STATUS_LABELS[input.period.status]],
  ];
  for (const [label, value] of infoLines) {
    page.drawText(label, { x: MARGIN, y, size: 10, font, color: GRAY });
    page.drawText(value, { x: MARGIN + 140, y, size: 10, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
  }
  y -= 10;

  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  page.drawText("Rincian Komponen Perhitungan", { x: MARGIN, y, size: 11, font: bold, color: LEMBANG_BLUE });
  y -= 18;

  y = drawTableHeader(page, font, bold, y);

  for (const comp of input.result.components) {
    if (y < 90) break; // guard against overflow on very long transaction lists; full detail also available in-app
    y = drawComponentRow(page, font, comp, y);
  }

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  const totals: [string, string, boolean][] = [
    ["Jumlah Kotor (Gross)", formatRupiah(input.result.grossAmount), false],
    [
      `Potongan${input.result.deductionRuleCodes.length ? ` (${input.result.deductionRuleCodes.join(", ")})` : ""}`,
      `- ${formatRupiah(input.result.deductionAmount)}`,
      false,
    ],
  ];
  if (input.result.minimumRequirementApplied) {
    totals.push(["Penyesuaian Minimum Requirement", "Diterapkan", false]);
  }
  if (input.result.adjustmentFactorBp !== 10000) {
    totals.push(["Faktor Penyesuaian Pagu", `${(input.result.adjustmentFactorBp / 100).toFixed(2)}%`, false]);
  }
  totals.push(["Jumlah Diterima (Net)", formatRupiah(input.result.netAmount), true]);

  for (const [label, value, emphasize] of totals) {
    page.drawText(label, { x: MARGIN, y, size: emphasize ? 12 : 10, font: emphasize ? bold : font, color: emphasize ? PINUS_GREEN : rgb(0.2, 0.2, 0.2) });
    page.drawText(value, {
      x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(value, emphasize ? 12 : 10),
      y,
      size: emphasize ? 12 : 10,
      font: emphasize ? bold : font,
      color: emphasize ? PINUS_GREEN : rgb(0.2, 0.2, 0.2),
    });
    y -= emphasize ? 22 : 16;
  }

  const footerY = 60;
  page.drawLine({ start: { x: MARGIN, y: footerY + 20 }, end: { x: PAGE_WIDTH - MARGIN, y: footerY + 20 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  page.drawText(`Dicetak: ${input.generatedAt}`, { x: MARGIN, y: footerY, size: 8, font, color: GRAY });
  page.drawText("Dokumen ini dihasilkan otomatis oleh sistem PINUS dan sah tanpa tanda tangan basah.", {
    x: MARGIN,
    y: footerY - 12,
    size: 8,
    font,
    color: GRAY,
  });

  return doc.save();
}

const COL_LABEL_X = MARGIN;
const COL_BASIS_X = 300;
const COL_PERCENT_X = 400;
const COL_AMOUNT_X = PAGE_WIDTH - MARGIN;

function drawTableHeader(page: PDFPage, _font: PDFFont, bold: PDFFont, y: number): number {
  page.drawText("Komponen", { x: COL_LABEL_X, y, size: 9, font: bold, color: GRAY });
  page.drawText("Dasar", { x: COL_BASIS_X, y, size: 9, font: bold, color: GRAY });
  page.drawText("%", { x: COL_PERCENT_X, y, size: 9, font: bold, color: GRAY });
  const label = "Nominal";
  page.drawText(label, { x: COL_AMOUNT_X - bold.widthOfTextAtSize(label, 9), y, size: 9, font: bold, color: GRAY });
  return y - 14;
}

function drawComponentRow(page: PDFPage, font: PDFFont, comp: CalculationComponent, y: number): number {
  const label = comp.label.length > 42 ? `${comp.label.slice(0, 41)}…` : comp.label;
  page.drawText(label, { x: COL_LABEL_X, y, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(formatRupiah(comp.basisAmount), { x: COL_BASIS_X, y, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
  page.drawText(comp.percentBp === null ? "-" : `${(comp.percentBp / 100).toFixed(2)}%`, {
    x: COL_PERCENT_X,
    y,
    size: 8.5,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });
  const amountText = formatRupiah(comp.amount);
  page.drawText(amountText, { x: COL_AMOUNT_X - font.widthOfTextAtSize(amountText, 8.5), y, size: 8.5, font, color: rgb(0.15, 0.15, 0.15) });
  return y - 14;
}
