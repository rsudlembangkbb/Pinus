'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { formatRupiah } from '@/lib/money';

interface CalculationRun {
  id: string;
  runNumber: number;
  isSimulation: boolean;
  status: string;
  totalGrossAmount: number | null;
  totalNetAmount: number | null;
  adjustmentFactorBps: number | null;
  startedAt: number;
}

interface CalcResult {
  runId: string;
  isSimulation: boolean;
  totalGrossAmount: number;
  totalNetAmount: number;
  adjustmentFactorBps: number;
  budgetCapApplied: boolean;
  employeeCount: number;
}

export default function CalculationPanel({
  periodId,
  periodStatus,
  runs,
  canRun,
  onChanged
}: {
  periodId: string;
  periodStatus: string;
  runs: CalculationRun[];
  canRun: boolean;
  onChanged: () => void;
}) {
  const [running, setRunning] = useState<'simulate' | 'official' | null>(null);
  const [lastResult, setLastResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function run(simulate: boolean) {
    setRunning(simulate ? 'simulate' : 'official');
    setError(null);
    try {
      const res = await api.post<CalcResult>(`/api/periods/${periodId}/calculate`, { simulate });
      setLastResult(res);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menjalankan kalkulasi.');
    } finally {
      setRunning(null);
    }
  }

  async function submitForVerification() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/periods/${periodId}/submit-verification`);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengajukan verifikasi.');
    } finally {
      setSubmitting(false);
    }
  }

  const officialRuns = runs.filter((r) => !r.isSimulation).sort((a, b) => b.runNumber - a.runNumber);
  const latestOfficial = officialRuns[0];

  return (
    <div className="space-y-4">
      {canRun && (
        <div className="card flex flex-wrap items-center gap-3">
          <button className="btn-outline" disabled={running !== null} onClick={() => run(true)}>
            {running === 'simulate' ? 'Menjalankan...' : 'Jalankan Simulasi (What-If)'}
          </button>
          <button className="btn-primary" disabled={running !== null} onClick={() => run(false)}>
            {running === 'official' ? 'Menjalankan...' : 'Jalankan Kalkulasi Resmi'}
          </button>
          {periodStatus === 'calculated' && (
            <button className="btn-secondary" disabled={submitting} onClick={submitForVerification}>
              {submitting ? 'Mengajukan...' : 'Ajukan untuk Verifikasi'}
            </button>
          )}
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {lastResult && (
        <div className="card border-lembang-200 bg-lembang-50">
          <p className="text-sm font-medium text-lembang-900">
            {lastResult.isSimulation ? 'Hasil simulasi' : 'Hasil kalkulasi resmi'}: {lastResult.employeeCount} pegawai,
            total bruto {formatRupiah(lastResult.totalGrossAmount)}, total bersih {formatRupiah(lastResult.totalNetAmount)}.
            {lastResult.budgetCapApplied && ' Penyesuaian pagu diterapkan.'}
          </p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <h3 className="mb-2 font-semibold text-slate-800">Log Kalkulasi</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada proses kalkulasi.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>#</th>
                <th>Jenis</th>
                <th>Total Bruto</th>
                <th>Total Bersih</th>
                <th>Faktor Penyesuaian</th>
              </tr>
            </thead>
            <tbody>
              {runs
                .slice()
                .sort((a, b) => b.runNumber - a.runNumber)
                .map((r) => (
                  <tr key={r.id}>
                    <td>{r.runNumber}</td>
                    <td>{r.isSimulation ? 'Simulasi' : 'Resmi'}</td>
                    <td>{r.totalGrossAmount !== null ? formatRupiah(r.totalGrossAmount) : '-'}</td>
                    <td>{r.totalNetAmount !== null ? formatRupiah(r.totalNetAmount) : '-'}</td>
                    <td>{r.adjustmentFactorBps !== null ? `${(r.adjustmentFactorBps / 100).toFixed(2)}%` : '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
      {latestOfficial && <p className="text-xs text-slate-400">Hasil resmi terakhir: run #{latestOfficial.runNumber}</p>}
    </div>
  );
}
