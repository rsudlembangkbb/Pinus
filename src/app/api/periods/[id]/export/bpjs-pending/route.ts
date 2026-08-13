import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { requireRole, requireSession, withApi } from '@/lib/http';
import { FINANCE_VISIBILITY_ROLES } from '@/lib/auth/roles';
import { getPeriodOrThrow } from '@/lib/export-shared';
import { buildDataWorkbook } from '@/lib/xlsx';
import { writeAuditLog } from '@/lib/audit';

/** Laporan rekonsiliasi klaim BPJS pending (PRD 8.3) - claims not yet final when the period was finalized. */
export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, FINANCE_VISIBILITY_ROLES);

  const db = await getDb();
  const period = await getPeriodOrThrow(db, resolvedParams.id);
  const claims = await db.select().from(schema.bpjsClaims).where(eq(schema.bpjsClaims.periodId, resolvedParams.id));
  const pending = claims.filter((c) => c.status === 'diajukan' || c.status === 'diverifikasi' || c.status === 'pending');

  const rows = pending.map((c) => ({
    'Nomor Klaim': c.claimNumber,
    'Tanggal Pengajuan': c.submissionDate ?? '-',
    'Nilai Diajukan (Rp)': c.submittedValue,
    Status: c.status,
    Catatan: 'Belum final saat periode difinalisasi - pantau &, bila status berubah, ajukan koreksi pada periode berikutnya.'
  }));

  const bytes = buildDataWorkbook('Klaim BPJS Pending', rows);

  await writeAuditLog({ actorUserId: session.sub, actorName: session.name, action: 'export', entityType: 'bpjs_pending_report', entityId: resolvedParams.id });

  return new NextResponse(bytes as any, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="klaim-bpjs-pending-${period.code}.xlsx"`
    }
  });
});
