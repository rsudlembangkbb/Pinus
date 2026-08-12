import * as ExcelJS from "exceljs";
import { parse } from "csv-parse/sync";
import { BadRequestException } from "@nestjs/common";
import { TemplateColumn } from "./import-templates";

export interface ParsedRow {
  rowNumber: number; // 1-indexed, matching the source file's data rows (header excluded)
  raw: Record<string, string>;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Maps arbitrary source headers back to template column keys via a normalized-header lookup. */
function buildHeaderIndex(columns: TemplateColumn[], headers: string[]): Map<number, string> {
  const byHeader = new Map(columns.map((c) => [normalizeHeader(c.header), c.key]));
  const index = new Map<number, string>();
  headers.forEach((h, i) => {
    const key = byHeader.get(normalizeHeader(h));
    if (key) index.set(i, key);
  });
  return index;
}

export async function parseImportFile(
  buffer: Buffer,
  originalName: string,
  columns: TemplateColumn[],
): Promise<ParsedRow[]> {
  const isCsv = originalName.toLowerCase().endsWith(".csv");

  if (isCsv) {
    const records: string[][] = parse(buffer, { skip_empty_lines: true });
    if (records.length === 0) throw new BadRequestException("Berkas kosong");
    const headerIndex = buildHeaderIndex(columns, records[0]);
    return records.slice(1).map((row, i) => ({
      rowNumber: i + 1,
      raw: rowToObject(row, headerIndex),
    }));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new BadRequestException("Berkas Excel tidak memiliki sheet");

  const headerRow = worksheet.getRow(1).values as unknown[];
  const headers = headerRow.slice(1).map((v) => String(v ?? ""));
  const headerIndex = buildHeaderIndex(columns, headers);

  const rows: ParsedRow[] = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as unknown[]).slice(1);
    const isEmpty = values.every((v) => v === null || v === undefined || v === "");
    if (isEmpty) return;
    const stringValues = values.map((v) => cellToString(v));
    rows.push({ rowNumber: rowNumber - 1, raw: rowToObject(stringValues, headerIndex) });
  });

  return rows;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as { text: unknown }).text ?? "");
  }
  if (typeof value === "object" && "result" in (value as Record<string, unknown>)) {
    return String((value as { result: unknown }).result ?? "");
  }
  return String(value);
}

function rowToObject(row: string[], headerIndex: Map<number, string>): Record<string, string> {
  const obj: Record<string, string> = {};
  headerIndex.forEach((key, colIndex) => {
    obj[key] = (row[colIndex] ?? "").toString().trim();
  });
  return obj;
}
