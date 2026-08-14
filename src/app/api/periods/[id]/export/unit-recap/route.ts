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

  const byUnit = new Map<string, { unit: string; count: number; gross: number; deduction: number; net: number }>();
  for (const r of rows) {
    const key = r.workUnitName ?? 'Tanpa Unit';
    const entry = byUnit.get(key) ?? { unit: key, count: 0, gross: 0, deduction: 0, net: 0 };
    entry.count += 1;
    entry.gross += r.grossAmount;
    entry.deduction += r.deductionAmount;
    entry.net += r.netAmount;
    byUnit.set(key, entry);
  }

  const recapRows = Array.from(byUnit.values()).map((u) => ({
    'Unit Kerja': u.unit,
    'Jumlah Pegawai': u.count,
    'Total Bruto (Rp)': u.gross,
    'Total Potongan (Rp)': u.deduction,
    'Total Bersih (Rp)': u.net
  }));

  const detailRows = rows.map((r) => ({
    NIP: r.employeeNip ?? '-',
    Nama: r.employeeName,
    'Unit Kerja': r.workUnitName ?? '-',
    Kategori: r.category,
    'Bruto (Rp)': r.grossAmount,
    'Potongan (Rp)': r.deductionAmount,
    'Bersih (Rp)': r.netAmount,
    Estimasi: r.isEstimate ? 'Ya' : 'Tidak'
  }));

  const bytes = buildMultiSheetWorkbook([
    { name: `Rekap Unit ${period.code}`, rows: recapRows },
    { name: 'Rincian per Pegawai', rows: detailRows }
  ]);

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'export', entityType: 'unit_recap', entityId: resolvedParams.id });

  return new NextResponse(bytes as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rekap-unit-jaspel-${period.code}.xlsx"`
    }
  });
});
