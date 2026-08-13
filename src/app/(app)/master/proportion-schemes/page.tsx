'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import FieldForm from '@/components/master/field-form';
import { PAYMENT_TYPES, SERVICE_ROLES } from '@/lib/constants';

interface WorkUnit {
  id: string;
  name: string;
  code: string;
}

interface ProportionScheme {
  id: string;
  workUnitId: string;
  paymentType: string;
  role: string;
  proportionBps: number;
  effectiveFrom: string;
  effectiveTo: string | null;
}

const ROLE_OPTIONS = [
  ...SERVICE_ROLES,
  { value: 'unit_tim', label: 'Tim Unit (Tenaga Kesehatan)' },
  { value: 'umum', label: 'Umum' }
];

export default function ProportionSchemesPage() {
  const [units, setUnits] = useState<WorkUnit[]>([]);
  const [schemes, setSchemes] = useState<ProportionScheme[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [u, s] = await Promise.all([
      api.get<WorkUnit[]>('/api/master/work-units'),
      api.get<ProportionScheme[]>('/api/master/proportion-schemes')
    ]);
    setUnits(u);
    setSchemes(s);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const unitName = (id: string) => units.find((u) => u.id === id)?.name ?? id;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Skema Proporsi Jaspel</h1>
          <p className="text-sm text-slate-500">
            Persentase proporsi per unit kerja, kategori JKN/Non-JKN, dan peran dalam tindakan. Setiap perubahan
            membuat versi baru (efektif sejak tanggal tertentu) - versi lama tetap tersimpan untuk data historis.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Tutup Formulir' : '+ Tambah Versi'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <FieldForm
            fields={[
              {
                name: 'workUnitId',
                label: 'Unit Kerja',
                type: 'select',
                required: true,
                options: units.map((u) => ({ value: u.id, label: `${u.code} - ${u.name}` }))
              },
              {
                name: 'paymentType',
                label: 'Jenis Penjaminan',
                type: 'select',
                required: true,
                options: PAYMENT_TYPES.map((p) => ({ value: p.value, label: p.label }))
              },
              { name: 'role', label: 'Peran', type: 'select', required: true, options: ROLE_OPTIONS },
              { name: 'proportionPercent', label: 'Proporsi (%)', type: 'number', required: true, placeholder: '12.5' },
              { name: 'effectiveFrom', label: 'Berlaku Sejak', type: 'date', required: true }
            ]}
            onSubmit={async (values) => {
              await api.post('/api/master/proportion-schemes', values);
              setShowForm(false);
              await load();
            }}
          />
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : schemes.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada skema proporsi.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Unit Kerja</th>
                <th>Jenis</th>
                <th>Peran</th>
                <th>Proporsi</th>
                <th>Berlaku Sejak</th>
                <th>Berlaku Sampai</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map((s) => (
                <tr key={s.id}>
                  <td>{unitName(s.workUnitId)}</td>
                  <td>{PAYMENT_TYPES.find((p) => p.value === s.paymentType)?.label ?? s.paymentType}</td>
                  <td>{ROLE_OPTIONS.find((r) => r.value === s.role)?.label ?? s.role}</td>
                  <td>{(s.proportionBps / 100).toFixed(2)}%</td>
                  <td>{s.effectiveFrom}</td>
                  <td>{s.effectiveTo ?? <span className="text-pinus-700">berlaku</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
