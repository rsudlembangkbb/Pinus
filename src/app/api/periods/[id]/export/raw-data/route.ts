import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { jsonError, requireRole, requireSession, withApi } from '@/lib/http';
import { FINANCE_VISIBILITY_ROLES } from '@/lib/auth/roles';
import { getOfficialRunResults, getPeriodOrThrow } from '@/lib/export-shared';
import { buildMultiSheetWorkbook } from '@/lib/xlsx';
import { writeAuditLog } from '@/lib/audit';

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, FINANCE_VISIBILITY_ROLES);

  const db = await getDb();
  const period = await getPeriodOrThrow(db, resolvedParams.id);
  const { rows } = await getOfficialRunResults(db, resolvedParams.id);
  if (rows.length === 0) return jsonError('Belum ada hasil kalkulasi resmi untuk periode ini.', 404);

  const rawRows = rows.map((r) => {
    const breakdown = JSON.parse(r.componentBreakdownJson) as { label: string; amount: number }[];
    return {
      NIP: r.employeeNip ?? '-',
      Nama: r.employeeName,
      'Unit Kerja': r.workUnitName ?? '-',
      Kategori: r.category,
      'Bruto (Rp)': r.grossAmount,
      'Potongan (Rp)': r.deductionAmount,
      'Top-up Minimum (Rp)': r.minimumTopupAmount,
      'Penyesuaian Pagu (Rp)': r.paguAdjustmentAmount,
      'Bersih (Rp)': r.netAmount,
      Estimasi: r.isEstimate ? 'Ya' : 'Tidak',
      'Rincian Komponen': breakdown.map((b) => `${b.label}: ${b.amount}`).join(' | ')
    };
  });

  const bytes = buildMultiSheetWorkbook([{ name: 'Data Mentah Hasil Kalkulasi', rows: rawRows }]);

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'export', entityType: 'raw_data', entityId: resolvedParams.id });

  return new NextResponse(bytes as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="data-mentah-jaspel-${period.code}.xlsx"`
    }
  });
});
