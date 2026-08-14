'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { formatRupiah } from '@/lib/money';

interface ResultRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNip: string | null;
  workUnitName: string | null;
  category: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
  isEstimate: boolean;
}

export default function ResultsPanel({ periodId, canExport }: { periodId: string; canExport: boolean }) {
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ runId: string | null; results: ResultRow[] }>(`/api/periods/${periodId}/results`).then((data) => {
      setRows(data.results);
      setLoading(false);
    });
  }, [periodId]);

  const total = rows.reduce((acc, r) => acc + r.netAmount, 0);

  return (
    <div className="space-y-3">
      {canExport && (
        <div className="flex flex-wrap gap-2">
          <a className="btn-outline" href={`/api/periods/${periodId}/export/unit-recap`}>
            Ekspor Rekap per Unit (Excel)
          </a>
          <a className="btn-outline" href={`/api/periods/${periodId}/export/summary`}>
            Ekspor Rekap Total (Excel)
          </a>
          <a className="btn-outline" href={`/api/periods/${periodId}/export/raw-data`}>
            Ekspor Data Mentah (Excel)
          </a>
          <a className="btn-outline" href={`/api/periods/${periodId}/export/slips`}>
            Unduh Slip Massal (ZIP)
          </a>
          <a className="btn-outline" href={`/api/periods/${periodId}/export/bpjs-pending`}>
            Laporan Klaim BPJS Pending
          </a>
        </div>
      )}
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada hasil kalkulasi.</p>
        ) : (
          <>
            <table className="table-base">
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Unit</th>
                  <th>Kategori</th>
                  <th>Bruto</th>
                  <th>Potongan</th>
                  <th>Bersih</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.employeeNip ?? '-'}</td>
                    <td>{r.employeeName}</td>
                    <td>{r.workUnitName ?? '-'}</td>
                    <td>{r.category}</td>
                    <td>{formatRupiah(r.grossAmount)}</td>
                    <td>{formatRupiah(r.deductionAmount)}</td>
                    <td className="font-medium">
                      {formatRupiah(r.netAmount)}
                      {r.isEstimate && <span className="ml-1 text-xs text-amber-600">(estimasi)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t border-slate-200 px-3 py-2 text-right text-sm font-semibold text-slate-800">
              Total: {formatRupiah(total)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
