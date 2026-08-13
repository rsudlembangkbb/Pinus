'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '@/lib/api-client';
import { formatRupiah } from '@/lib/money';

interface PeriodResult {
  periodId: string;
  periodCode: string;
  periodLabel: string;
  grossAmount: number;
  deductionAmount: number;
  minimumTopupAmount: number;
  paguAdjustmentAmount: number;
  netAmount: number;
  isEstimate: boolean;
  breakdown: { label: string; amount: number }[];
}

export default function EmployeeDashboardPage() {
  const [history, setHistory] = useState<PeriodResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ periods: PeriodResult[] }>('/api/me/jaspel')
      .then((data) => setHistory(data.periods))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat data.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (history.length === 0) {
    return <p className="card text-sm text-slate-500">Belum ada rincian Jaspel yang dipublikasikan untuk Anda.</p>;
  }

  const latest = history[history.length - 1]!;
  const chartData = history.map((h) => ({ name: h.periodLabel.split(' ')[0], total: h.netAmount }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Jaspel Saya</h1>
        <p className="text-sm text-slate-500">Rincian jasa pelayanan dan insentif kinerja Anda per periode.</p>
      </div>

      <div className="card bg-gradient-to-br from-pinus-700 to-lembang-800 text-white">
        <p className="text-sm text-pinus-100">Periode {latest.periodLabel}</p>
        <p className="mt-1 text-3xl font-bold">{formatRupiah(latest.netAmount)}</p>
        {latest.isEstimate && (
          <p className="mt-1 text-xs text-amber-200">
            *Sebagian nilai masih berupa estimasi (klaim BPJS belum final) - dapat dikoreksi pada periode berikutnya.
          </p>
        )}
        <a href={`/api/periods/${latest.periodId}/slip/me`} className="mt-3 inline-block btn-secondary bg-white/10 text-white hover:bg-white/20">
          Unduh Slip PDF
        </a>
      </div>

      {chartData.length > 1 && (
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">Tren Beberapa Periode Terakhir</h2>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Line type="monotone" dataKey="total" stroke="#146147" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-slate-800">Riwayat per Periode</h2>
        {history
          .slice()
          .reverse()
          .map((h) => (
            <div key={h.periodId} className="card">
              <button className="flex w-full items-center justify-between text-left" onClick={() => setExpanded(expanded === h.periodId ? null : h.periodId)}>
                <div>
                  <p className="font-medium text-slate-800">{h.periodLabel}</p>
                  <p className="text-xs text-slate-500">Bruto {formatRupiah(h.grossAmount)} - Potongan {formatRupiah(h.deductionAmount)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-pinus-800">{formatRupiah(h.netAmount)}</span>
                  <span className="text-slate-400">{expanded === h.periodId ? '▲' : '▼'}</span>
                </div>
              </button>
              {expanded === h.periodId && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <table className="table-base">
                    <tbody>
                      {h.breakdown.map((b, i) => (
                        <tr key={i}>
                          <td>{b.label}</td>
                          <td className="text-right">{formatRupiah(b.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <a href={`/api/periods/${h.periodId}/slip/me`} className="mt-3 inline-block text-sm text-lembang-700 hover:underline">
                    Unduh Slip PDF periode ini
                  </a>
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
