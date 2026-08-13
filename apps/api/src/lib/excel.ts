import * as XLSX from "xlsx";

/**
 * Parses the first sheet of an uploaded .xlsx/.csv file into row objects
 * keyed by header text. SheetJS auto-detects CSV vs. XLSX from the byte
 * content itself, so this works for either extension mentioned in the PRD
 * (8.1: "format .xlsx dan .csv").
 */
export function parseWorkbookFirstSheet(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName]!;
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
}

export function buildTemplateWorkbook(headers: readonly string[], exampleRows: Record<string, unknown>[] = []): ArrayBuffer {
  const rows = [headers as unknown as string[], ...exampleRows.map((row) => headers.map((h) => row[h] ?? ""))];
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function buildDataWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
