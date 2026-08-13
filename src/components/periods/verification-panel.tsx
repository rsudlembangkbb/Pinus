'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { RoleCode, ROLES } from '@/lib/auth/roles';

interface ApprovalStep {
  id: string;
  periodId: string;
  stepType: string;
  workUnitId: string | null;
  status: string;
  notes: string | null;
  actedAt: number | null;
}

interface WorkUnit {
  id: string;
  name: string;
}

const STEP_LABELS: Record<string, string> = {
  verifikasi_unit: 'Verifikasi Unit',
  verifikasi_keuangan: 'Verifikasi Keuangan',
  persetujuan_direktur: 'Persetujuan Direktur'
};

export default function VerificationPanel({
  periodId,
  steps,
  workUnits,
  userRole,
  userWorkUnitId,
  onChanged
}: {
  periodId: string;
  steps: ApprovalStep[];
  workUnits: WorkUnit[];
  userRole: RoleCode;
  userWorkUnitId: string | null;
  onChanged: () => void;
}) {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function canDecide(step: ApprovalStep): boolean {
    if (step.status !== 'pending') return false;
    if (userRole === ROLES.SUPER_ADMIN) return true;
    if (step.stepType === 'verifikasi_unit') return userRole === ROLES.VERIFIKATOR_UNIT && step.workUnitId === userWorkUnitId;
    if (step.stepType === 'verifikasi_keuangan') return userRole === ROLES.KEUANGAN;
    if (step.stepType === 'persetujuan_direktur') return userRole === ROLES.DIREKTUR;
    return false;
  }

  async function decide(step: ApprovalStep, decision: 'approved' | 'rejected') {
    setBusyId(step.id);
    setError(null);
    try {
      await api.post(`/api/periods/${periodId}/approval-steps/${step.id}/decide`, { decision, notes: notesById[step.id] });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses keputusan.');
    } finally {
      setBusyId(null);
    }
  }

  const unitName = (id: string | null) => workUnits.find((u) => u.id === id)?.name ?? '-';

  if (steps.length === 0) {
    return <p className="text-sm text-slate-500">Verifikasi belum diajukan. Jalankan kalkulasi resmi lalu ajukan untuk verifikasi.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {steps.map((step) => (
        <div key={step.id} className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-slate-800">
                {STEP_LABELS[step.stepType] ?? step.stepType}
                {step.workUnitId ? ` - ${unitName(step.workUnitId)}` : ''}
              </p>
              <span
                className={`badge mt-1 ${
                  step.status === 'approved'
                    ? 'bg-pinus-100 text-pinus-800'
                    : step.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-800'
                }`}
              >
                {step.status === 'approved' ? 'Disetujui' : step.status === 'rejected' ? 'Dikembalikan' : 'Menunggu'}
              </span>
              {step.notes && <p className="mt-1 text-xs text-slate-500">Catatan: {step.notes}</p>}
            </div>
            {canDecide(step) && (
              <div className="flex flex-1 min-w-[240px] items-center gap-2">
                <input
                  className="input"
                  placeholder="Catatan (opsional)"
                  value={notesById[step.id] ?? ''}
                  onChange={(e) => setNotesById((s) => ({ ...s, [step.id]: e.target.value }))}
                />
                <button className="btn-primary shrink-0" disabled={busyId === step.id} onClick={() => decide(step, 'approved')}>
                  Setujui
                </button>
                <button className="btn-danger shrink-0" disabled={busyId === step.id} onClick={() => decide(step, 'rejected')}>
                  Kembalikan
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
