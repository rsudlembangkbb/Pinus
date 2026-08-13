'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import FieldForm from '@/components/master/field-form';
import { BPJS_PENDING_POLICIES, PERIOD_STATUS_LABELS } from '@/lib/constants';

interface Period {
  id: string;
  code: string;
  label: string;
  status: keyof typeof PERIOD_STATUS_LABELS;
  startDate: string;
  endDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  importing: 'bg-amber-100 text-amber-800',
  ready_to_calculate: 'bg-amber-100 text-amber-800',
  calculated: 'bg-lembang-100 text-lembang-800',
  verifying_unit: 'bg-amber-100 text-amber-800',
  verifying_keuangan: 'bg-amber-100 text-amber-800',
  verifying_direktur: 'bg-amber-100 text-amber-800',
  approved: 'bg-pinus-100 text-pinus-800',
  published: 'bg-pinus-100 text-pinus-800',
  locked: 'bg-slate-200 text-slate-700'
};

export default function PeriodsPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await api.get<Period[]>('/api/periods');
    setPeriods(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Periode & Kalkulasi Jaspel</h1>
          <p className="text-sm text-slate-500">Siklus bulanan: impor data, kalkulasi, verifikasi berjenjang, hingga publikasi.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Tutup Formulir' : '+ Buka Periode Baru'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <FieldForm
            fields={[
              { name: 'code', label: 'Kode Periode (YYYY-MM)', type: 'text', required: true, placeholder: '2026-08' },
              { name: 'label', label: 'Label', type: 'text', required: true, placeholder: 'Agustus 2026' },
              { name: 'startDate', label: 'Tanggal Mulai', type: 'date', required: true },
              { name: 'endDate', label: 'Tanggal Selesai', type: 'date', required: true },
              {
                name: 'bpjsPendingPolicy',
                label: 'Kebijakan Klaim BPJS Pending',
                type: 'select',
                required: true,
                options: BPJS_PENDING_POLICIES.map((p) => ({ value: p.value, label: p.label }))
              },
              { name: 'jaspelBudgetCap', label: 'Pagu Insentif Kinerja (Rp, opsional)', type: 'number' },
              { name: 'administrationAllocation', label: 'Alokasi Insentif Administrasi (Rp)', type: 'number' },
              { name: 'teamUnitProportionPercent', label: 'Proporsi Pool Tim Kesehatan (%)', type: 'number', placeholder: '30' },
              { name: 'teamUnitFixedPortionPercent', label: 'Porsi Tetap dalam Unit (%)', type: 'number', placeholder: '20' },
              { name: 'hybridDiscountPercent', label: 'Diskon Estimasi Hibrida BPJS (%)', type: 'number', placeholder: '80' }
            ]}
            onSubmit={async (values) => {
              await api.post('/api/periods', values);
              setShowForm(false);
              await load();
            }}
          />
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : periods.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada periode.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Periode</th>
                <th>Rentang Tanggal</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.label}</td>
                  <td>
                    {p.startDate} s.d. {p.endDate}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {PERIOD_STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td>
                    <Link href={`/periods/${p.id}`} className="text-lembang-700 hover:underline">
                      Buka
                    </Link>
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
