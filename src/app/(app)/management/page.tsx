'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '@/lib/api-client';
import { formatRupiah } from '@/lib/money';

interface Summary {
  trend: { periodCode: string; periodLabel: string; totalNetAmount: number; jaspelBudgetCap: number | null }[];
  latestPeriodLabel?: string;
  latestByUnit: { unit: string; total: number; count: number }[];
  latestByCategory: { category: string; total: number; count: number }[];
}

const CHART_COLORS = ['#146147', '#1c4f7a', '#48b385', '#4f98cb', '#7bcfa6', '#82bade'];

export default function ManagementDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Summary>('/api/management/summary')
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat data.'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!summary) return <p className="text-sm text-slate-500">Memuat...</p>;
  if (summary.trend.length === 0) {
    return <p className="card text-sm text-slate-500">Belum ada periode yang terpublikasi.</p>;
  }

  const latest = summary.trend[summary.trend.length - 1]!;
  const totalPegawai = summary.latestByUnit.reduce((acc, u) => acc + u.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Dashboard Manajemen</h1>
        <p className="text-sm text-slate-500">Realisasi Jaspel, distribusi per unit/kategori, dan tren periode.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card">
          <p className="text-xs text-slate-500">Periode Terakhir</p>
          <p className="text-lg font-semibold text-slate-800">{latest.periodLabel}</p>
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Total Realisasi Jaspel</p>
          <p className="text-lg font-semibold text-pinus-800">{formatRupiah(latest.totalNetAmount)}</p>
          {latest.jaspelBudgetCap && (
            <p className="text-xs text-slate-400">dari pagu {formatRupiah(latest.jaspelBudgetCap)}</p>
          )}
        </div>
        <div className="card">
          <p className="text-xs text-slate-500">Total Penerima</p>
          <p className="text-lg font-semibold text-slate-800">{totalPegawai} pegawai</p>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-slate-800">Tren Realisasi vs Pagu</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={summary.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodCode" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Legend />
              <Line type="monotone" dataKey="totalNetAmount" name="Realisasi" stroke="#146147" strokeWidth={2} />
              <Line type="monotone" dataKey="jaspelBudgetCap" name="Pagu" stroke="#1c4f7a" strokeDasharray="4 4" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">Distribusi per Unit ({summary.latestPeriodLabel})</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={summary.latestByUnit} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="unit" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Bar dataKey="total" fill="#146147" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold text-slate-800">Distribusi per Kategori Tenaga</h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={summary.latestByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatRupiah(v)} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                  {summary.latestByCategory.map((entry, i) => (
                    <Cell key={entry.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
