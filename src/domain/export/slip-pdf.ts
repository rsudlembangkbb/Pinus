import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatRupiah } from '@/lib/money';

export interface SlipData {
  periodLabel: string;
  employeeName: string;
  employeeNip: string | null;
  workUnitName: string | null;
  category: string;
  grossAmount: number;
  deductionAmount: number;
  minimumTopupAmount: number;
  paguAdjustmentAmount: number;
  netAmount: number;
  breakdown: { label: string; amount: number }[];
  isFinal: boolean;
  generatedAt: Date;
}

const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

export async function generateSlipPdf(data: SlipData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pinusGreen = rgb(0x14 / 255, 0x61 / 255, 0x47 / 255);
  const slate = rgb(0.2, 0.24, 0.32);
  const muted = rgb(0.45, 0.48, 0.55);

  let y = PAGE_HEIGHT - MARGIN;

  page.drawText('RSUD LEMBANG', { x: MARGIN, y, size: 16, font: bold, color: pinusGreen });
  y -= 18;
  page.drawText('Slip Rincian Jasa Pelayanan (Jaspel) - Aplikasi PINUS', { x: MARGIN, y, size: 10, font, color: muted });
  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 1, color: pinusGreen });
  y -= 28;

  page.drawText(`Periode: ${data.periodLabel}`, { x: MARGIN, y, size: 11, font: bold, color: slate });
  y -= 18;
  page.drawText(`Nama: ${data.employeeName}`, { x: MARGIN, y, size: 11, font, color: slate });
  y -= 16;
  page.drawText(`NIP: ${data.employeeNip ?? '-'}`, { x: MARGIN, y, size: 11, font, color: slate });
  y -= 16;
  page.drawText(`Unit Kerja: ${data.workUnitName ?? '-'}`, { x: MARGIN, y, size: 11, font, color: slate });
  y -= 16;
  page.drawText(`Kategori: ${data.category}`, { x: MARGIN, y, size: 11, font, color: slate });
  y -= 16;
  page.drawText(`Status: ${data.isFinal ? 'FINAL - Terpublikasi' : 'DRAF / SIMULASI'}`, {
    x: MARGIN,
    y,
    size: 11,
    font: bold,
    color: data.isFinal ? pinusGreen : rgb(0.75, 0.4, 0)
  });
  y -= 28;

  page.drawText('Rincian Komponen', { x: MARGIN, y, size: 12, font: bold, color: slate });
  y -= 16;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: muted });
  y -= 14;

  for (const line of data.breakdown) {
    if (y < 120) {
      // simple single-page slip; truncate with a note if extremely long
      page.drawText('... (rincian tambahan terpotong, lihat dashboard untuk detail penuh)', {
        x: MARGIN,
        y,
        size: 9,
        font,
        color: muted
      });
      y -= 14;
      break;
    }
    const amountLabel = formatRupiah(line.amount);
    page.drawText(truncate(line.label, 60), { x: MARGIN, y, size: 10, font, color: slate });
    page.drawText(amountLabel, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(amountLabel, 10), y, size: 10, font, color: slate });
    y -= 14;
  }

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: muted });
  y -= 20;

  drawSummaryRow(page, font, MARGIN, y, 'Jumlah Bruto', data.grossAmount, slate);
  y -= 16;
  drawSummaryRow(page, font, MARGIN, y, 'Potongan', -data.deductionAmount, slate);
  y -= 16;
  if (data.minimumTopupAmount !== 0) {
    drawSummaryRow(page, font, MARGIN, y, 'Penyesuaian Pendapatan Minimum', data.minimumTopupAmount, slate);
    y -= 16;
  }
  if (data.paguAdjustmentAmount !== 0) {
    drawSummaryRow(page, font, MARGIN, y, 'Penyesuaian Proporsional atas Pagu', data.paguAdjustmentAmount, slate);
    y -= 16;
  }
  y -= 6;
  drawSummaryRow(page, bold, MARGIN, y, 'TOTAL DITERIMA', data.netAmount, pinusGreen, 13);
  y -= 30;

  page.drawText(
    `Dokumen ini dihasilkan otomatis oleh Aplikasi PINUS pada ${data.generatedAt.toLocaleString('id-ID')}. Rincian ini bersifat rahasia dan hanya untuk yang bersangkutan.`,
    { x: MARGIN, y: 60, size: 8, font, color: muted, maxWidth: PAGE_WIDTH - MARGIN * 2, lineHeight: 10 }
  );

  return doc.save();
}

function drawSummaryRow(page: any, font: any, x: number, y: number, label: string, amount: number, color: any, size = 11) {
  page.drawText(label, { x, y, size, font, color });
  const amountLabel = formatRupiah(amount);
  page.drawText(amountLabel, { x: PAGE_WIDTH - MARGIN - font.widthOfTextAtSize(amountLabel, size), y, size, font, color });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
