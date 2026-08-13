'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { PERIOD_STATUS_LABELS } from '@/lib/constants';

interface Period {
  id: string;
  code: string;
  label: string;
  status: string;
}

export default function ReportsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Period[]>('/api/periods').then((data) => {
      setPeriods(data.filter((p) => ['calculated', 'verifying_unit', 'verifying_keuangan', 'verifying_direktur', 'approved', 'published', 'locked'].includes(p.status)));
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Laporan & Ekspor</h1>
        <p className="text-sm text-slate-500">Ekspor rekap, data mentah, slip massal, dan laporan rekonsiliasi klaim BPJS per periode.</p>
      </div>
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : periods.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada periode dengan hasil kalkulasi.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Status</th>
                <th>Ekspor</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.label}</td>
                  <td>{PERIOD_STATUS_LABELS[p.status as keyof typeof PERIOD_STATUS_LABELS] ?? p.status}</td>
                  <td className="space-x-3">
                    <a className="text-lembang-700 hover:underline" href={`/api/periods/${p.id}/export/unit-recap`}>
                      Rekap Unit
                    </a>
                    <a className="text-lembang-700 hover:underline" href={`/api/periods/${p.id}/export/summary`}>
                      Rekap Total
                    </a>
                    <a className="text-lembang-700 hover:underline" href={`/api/periods/${p.id}/export/raw-data`}>
                      Data Mentah
                    </a>
                    <a className="text-lembang-700 hover:underline" href={`/api/periods/${p.id}/export/slips`}>
                      Slip Massal
                    </a>
                    <a className="text-lembang-700 hover:underline" href={`/api/periods/${p.id}/export/bpjs-pending`}>
                      BPJS Pending
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
