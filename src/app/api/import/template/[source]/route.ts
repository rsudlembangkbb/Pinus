import { NextRequest, NextResponse } from 'next/server';
import { requireSession, withApi, jsonError } from '@/lib/http';
import { buildTemplateWorkbook } from '@/lib/xlsx';
import {
  BARAYA_ATTENDANCE_TEMPLATE_COLUMNS,
  BARAYA_BIODATA_TEMPLATE_COLUMNS,
  BPJS_TEMPLATE_COLUMNS,
  PERFORMANCE_TEMPLATE_COLUMNS,
  SIMRS_TEMPLATE_COLUMNS
} from '@/domain/import/templates';

const TEMPLATES: Record<string, { columns: typeof SIMRS_TEMPLATE_COLUMNS; fileName: string }> = {
  simrs: { columns: SIMRS_TEMPLATE_COLUMNS, fileName: 'template_import_simrs.xlsx' },
  bpjs: { columns: BPJS_TEMPLATE_COLUMNS, fileName: 'template_import_klaim_bpjs.xlsx' },
  baraya_attendance: { columns: BARAYA_ATTENDANCE_TEMPLATE_COLUMNS, fileName: 'template_import_absensi_baraya.xlsx' },
  baraya_biodata: { columns: BARAYA_BIODATA_TEMPLATE_COLUMNS, fileName: 'template_sinkronisasi_biodata_baraya.xlsx' },
  kinerja: { columns: PERFORMANCE_TEMPLATE_COLUMNS, fileName: 'template_import_indeks_kinerja.xlsx' }
};

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ source: string }> }) => {
  const resolvedParams = await params;
  await requireSession();
  const template = TEMPLATES[resolvedParams.source];
  if (!template) return jsonError('Sumber impor tidak dikenali.', 404);

  const bytes = buildTemplateWorkbook(template.columns);
  return new NextResponse(bytes as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${template.fileName}"`
    }
  });
});
