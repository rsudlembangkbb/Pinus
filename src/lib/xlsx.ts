import * as XLSX from 'xlsx';

export interface ColumnSpec {
  header: string;
  key: string;
  example: string | number;
  required?: boolean;
}

/** Parses an uploaded .xlsx/.xls/.csv file into an array of row objects keyed by column header. */
export function parseWorkbookRows(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, unknown>[] } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: true });
  const headers = rows.length > 0 ? Object.keys(rows[0]!) : [];
  return { headers, rows };
}

/** Builds a downloadable .xlsx template with a header row and one illustrative example row. */
export function buildTemplateWorkbook(columns: ColumnSpec[]): Uint8Array {
  const headerRow = columns.map((c) => c.header);
  const exampleRow = columns.map((c) => c.example);
  const worksheet = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
  worksheet['!cols'] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 18) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}

/** Builds an .xlsx workbook from an array of plain row objects (used for report exports). */
export function buildDataWorkbook(sheetName: string, rows: Record<string, unknown>[]): Uint8Array {
  return buildMultiSheetWorkbook([{ name: sheetName, rows }]);
}

/** Builds a multi-sheet .xlsx workbook from named arrays of plain row objects. */
export function buildMultiSheetWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[]): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
}
