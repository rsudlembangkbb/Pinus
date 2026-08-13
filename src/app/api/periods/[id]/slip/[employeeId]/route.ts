import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { ApiError, jsonError, requireSession, withApi } from '@/lib/http';
import { FINANCE_VISIBILITY_ROLES, ROLES } from '@/lib/auth/roles';
import { generateSlipPdf } from '@/domain/export/slip-pdf';
import { writeAuditLog } from '@/lib/audit';

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string; employeeId: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  const db = await getDb();

  // "me" is accepted as shorthand for the logged-in user's own employeeId, so
  // the employee dashboard can link to a slip without an extra lookup round-trip.
  const employeeId = resolvedParams.employeeId === 'me' ? session.employeeId : resolvedParams.employeeId;
  if (!employeeId) throw new ApiError(404, 'Akun Anda tidak terhubung ke data pegawai manapun.');

  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);

  const [employee] = await db.select().from(schema.employees).where(eq(schema.employees.id, employeeId)).limit(1);
  if (!employee) return jsonError('Pegawai tidak ditemukan.', 404);

  if (session.role === ROLES.PEGAWAI && session.employeeId !== employeeId) {
    throw new ApiError(403, 'Anda hanya dapat mengunduh slip milik Anda sendiri.');
  }
  if (session.role === ROLES.VERIFIKATOR_UNIT && employee.workUnitId !== session.workUnitId) {
    throw new ApiError(403, 'Anda hanya dapat mengakses data unit Anda.');
  }
  if (![ROLES.PEGAWAI, ROLES.VERIFIKATOR_UNIT, ...FINANCE_VISIBILITY_ROLES].includes(session.role as any)) {
    throw new ApiError(403, 'Anda tidak memiliki wewenang untuk mengunduh slip ini.');
  }
  if (session.role === ROLES.PEGAWAI && period.status !== 'published' && period.status !== 'locked') {
    throw new ApiError(403, 'Slip untuk periode ini belum dipublikasikan.');
  }

  const runs = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, resolvedParams.id));
  const officialRun = runs.filter((r) => !r.isSimulation && r.status === 'completed').sort((a, b) => b.runNumber - a.runNumber)[0];
  if (!officialRun) return jsonError('Belum ada hasil kalkulasi resmi untuk periode ini.', 404);

  const [result] = await db
    .select()
    .from(schema.calculationResults)
    .where(and(eq(schema.calculationResults.runId, officialRun.id), eq(schema.calculationResults.employeeId, employeeId)))
    .limit(1);
  if (!result) return jsonError('Tidak ditemukan hasil perhitungan untuk pegawai ini pada periode tersebut.', 404);

  let workUnitName: string | null = null;
  if (employee.workUnitId) {
    const [u] = await db.select().from(schema.workUnits).where(eq(schema.workUnits.id, employee.workUnitId)).limit(1);
    workUnitName = u?.name ?? null;
  }

  const pdfBytes = await generateSlipPdf({
    periodLabel: period.label,
    employeeName: employee.name,
    employeeNip: employee.nip,
    workUnitName,
    category: employee.category,
    grossAmount: result.grossAmount,
    deductionAmount: result.deductionAmount,
    minimumTopupAmount: result.minimumTopupAmount,
    paguAdjustmentAmount: result.paguAdjustmentAmount,
    netAmount: result.netAmount,
    breakdown: JSON.parse(result.componentBreakdownJson),
    isFinal: period.status === 'published' || period.status === 'locked',
    generatedAt: new Date()
  });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'export',
    entityType: 'slip_jaspel',
    entityId: `${resolvedParams.id}:${employeeId}`
  });

  return new NextResponse(pdfBytes as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="slip-jaspel-${period.code}-${employee.nip ?? employee.id}.pdf"`
    }
  });
});
