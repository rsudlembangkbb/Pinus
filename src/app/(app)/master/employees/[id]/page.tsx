'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import FieldForm from '@/components/master/field-form';
import { IDENTITY_SOURCE_SYSTEMS } from '@/lib/constants';

interface IdentityMapping {
  id: string;
  sourceSystem: string;
  externalCode: string;
  notes: string | null;
}

interface EmployeeDetail {
  id: string;
  nip: string | null;
  name: string;
  category: string;
  isActive: boolean;
  identityMappings: IdentityMapping[];
}

export default function EmployeeDetailPage() {
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.get<EmployeeDetail>(`/api/master/employees/${params.id}`);
      setEmployee(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!employee) return <p className="text-sm text-slate-500">Memuat...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{employee.name}</h1>
        <p className="text-sm text-slate-500">NIP: {employee.nip ?? '-'}</p>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Pemetaan Identitas Lintas Sistem</h2>
          <button className="btn-secondary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Tutup' : '+ Tambah Pemetaan'}
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Menghubungkan kode/ID pegawai ini di SIMRS, BARAYA, dan data klaim BPJS ke satu ID internal PINUS - wajib
          dikonfigurasi agar data lintas sumber dapat digabungkan otomatis saat impor.
        </p>
        {showForm && (
          <div className="mb-4 border-t border-slate-100 pt-4">
            <FieldForm
              fields={[
                {
                  name: 'sourceSystem',
                  label: 'Sistem Sumber',
                  type: 'select',
                  required: true,
                  options: IDENTITY_SOURCE_SYSTEMS.map((s) => ({ value: s.value, label: s.label }))
                },
                { name: 'externalCode', label: 'Kode Eksternal', type: 'text', required: true },
                { name: 'notes', label: 'Catatan', type: 'text' }
              ]}
              onSubmit={async (values) => {
                await api.post('/api/master/identity-mappings', { ...values, employeeId: employee.id });
                setShowForm(false);
                await load();
              }}
            />
          </div>
        )}
        {employee.identityMappings.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada pemetaan identitas.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Sistem</th>
                <th>Kode Eksternal</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {employee.identityMappings.map((m) => (
                <tr key={m.id}>
                  <td>{IDENTITY_SOURCE_SYSTEMS.find((s) => s.value === m.sourceSystem)?.label ?? m.sourceSystem}</td>
                  <td className="font-mono">{m.externalCode}</td>
                  <td>{m.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
