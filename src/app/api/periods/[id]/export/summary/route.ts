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
  const { run, rows } = await getOfficialRunResults(db, resolvedParams.id);
  if (!run || rows.length === 0) return jsonError('Belum ada hasil kalkulasi resmi untuk periode ini.', 404);

  const byCategory = new Map<string, { category: string; count: number; net: number }>();
  for (const r of rows) {
    const entry = byCategory.get(r.category) ?? { category: r.category, count: 0, net: 0 };
    entry.count += 1;
    entry.net += r.netAmount;
    byCategory.set(r.category, entry);
  }

  const summaryRows = [
    { Uraian: 'Periode', Nilai: period.label },
    { Uraian: 'Total Pegawai Penerima', Nilai: rows.length },
    { Uraian: 'Total Bruto (Rp)', Nilai: run.totalGrossAmount },
    { Uraian: 'Total Bersih Dibayarkan (Rp)', Nilai: run.totalNetAmount },
    { Uraian: 'Pagu Insentif Kinerja (Rp)', Nilai: period.jaspelBudgetCap ?? '-' },
    { Uraian: 'Faktor Penyesuaian Pagu', Nilai: `${((run.adjustmentFactorBps ?? 10_000) / 100).toFixed(2)}%` },
    { Uraian: 'Kebijakan Klaim BPJS Pending', Nilai: period.bpjsPendingPolicy },
    { Uraian: 'Status Periode', Nilai: period.status },
    { Uraian: 'Tanggal Publikasi', Nilai: period.publishedAt ? new Date(period.publishedAt * 1000).toLocaleString('id-ID') : '-' }
  ];

  const byCategoryRows = Array.from(byCategory.values()).map((c) => ({
    Kategori: c.category,
    'Jumlah Pegawai': c.count,
    'Total Bersih (Rp)': c.net
  }));

  const bytes = buildMultiSheetWorkbook([
    { name: 'Ringkasan Penatausahaan', rows: summaryRows },
    { name: 'Per Kategori Tenaga', rows: byCategoryRows }
  ]);

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'export', entityType: 'period_summary', entityId: resolvedParams.id });

  return new NextResponse(bytes as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="rekap-total-jaspel-${period.code}.xlsx"`
    }
  });
});
