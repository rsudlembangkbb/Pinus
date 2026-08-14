import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { and, eq } from 'drizzle-orm';
import { getDb, schema } from '@/db';
import { jsonError, requireRole, requireSession, withApi } from '@/lib/http';
import { FINANCE_VISIBILITY_ROLES } from '@/lib/auth/roles';
import { generateSlipPdf } from '@/domain/export/slip-pdf';
import { writeAuditLog } from '@/lib/audit';

export const GET = withApi(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const resolvedParams = await params;
  const session = await requireSession();
  requireRole(session, FINANCE_VISIBILITY_ROLES);

  const db = await getDb();
  const [period] = await db.select().from(schema.calculationPeriods).where(eq(schema.calculationPeriods.id, resolvedParams.id)).limit(1);
  if (!period) return jsonError('Periode tidak ditemukan.', 404);

  const runs = await db.select().from(schema.calculationRuns).where(eq(schema.calculationRuns.periodId, resolvedParams.id));
  const officialRun = runs.filter((r) => !r.isSimulation && r.status === 'completed').sort((a, b) => b.runNumber - a.runNumber)[0];
  if (!officialRun) return jsonError('Belum ada hasil kalkulasi resmi untuk periode ini.', 404);

  const results = await db
    .select({ result: schema.calculationResults, employee: schema.employees })
    .from(schema.calculationResults)
    .innerJoin(schema.employees, eq(schema.calculationResults.employeeId, schema.employees.id))
    .where(eq(schema.calculationResults.runId, officialRun.id));

  const units = await db.select().from(schema.workUnits);
  const unitNameById = new Map(units.map((u) => [u.id, u.name]));

  const zip = new JSZip();
  const isFinal = period.status === 'published' || period.status === 'locked';

  for (const { result, employee } of results) {
    const pdfBytes = await generateSlipPdf({
      periodLabel: period.label,
      employeeName: employee.name,
      employeeNip: employee.nip,
      workUnitName: employee.workUnitId ? unitNameById.get(employee.workUnitId) ?? null : null,
      category: employee.category,
      grossAmount: result.grossAmount,
      deductionAmount: result.deductionAmount,
      minimumTopupAmount: result.minimumTopupAmount,
      paguAdjustmentAmount: result.paguAdjustmentAmount,
      netAmount: result.netAmount,
      breakdown: JSON.parse(result.componentBreakdownJson),
      isFinal,
      generatedAt: new Date()
    });
    zip.file(`slip-jaspel-${employee.nip ?? employee.id}-${employee.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, pdfBytes);
  }

  const zipBytes = await zip.generateAsync({ type: 'uint8array' });

  await writeAuditLog({
    actorUserId: session.sub,
    actorName: session.name,
    action: 'export',
    entityType: 'slip_jaspel_batch',
    entityId: resolvedParams.id,
    after: { employeeCount: results.length }
  });

  return new NextResponse(zipBytes as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="slip-jaspel-${period.code}.zip"`
    }
  });
});
