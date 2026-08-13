'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import FieldForm from '@/components/master/field-form';
import { EMPLOYEE_CATEGORIES, EMPLOYMENT_STATUSES } from '@/lib/constants';

interface WorkUnit {
  id: string;
  name: string;
  code: string;
}
interface JobGrade {
  id: string;
  name: string;
}
interface Employee {
  id: string;
  nip: string | null;
  name: string;
  category: string;
  workUnitId: string | null;
  isActive: boolean;
}

export default function EmployeesPage() {
  const [units, setUnits] = useState<WorkUnit[]>([]);
  const [grades, setGrades] = useState<JobGrade[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(query?: string) {
    setLoading(true);
    const [u, g, e] = await Promise.all([
      api.get<WorkUnit[]>('/api/master/work-units'),
      api.get<JobGrade[]>('/api/master/job-grades'),
      api.get<Employee[]>(`/api/master/employees${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    ]);
    setUnits(u);
    setGrades(g);
    setEmployees(e);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const unitName = (id: string | null) => units.find((u) => u.id === id)?.name ?? '-';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Data Pegawai</h1>
          <p className="text-sm text-slate-500">
            Data induk pegawai (biodata dasar disinkronkan dari BARAYA melalui impor bulanan).
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Tutup Formulir' : '+ Tambah Pegawai'}
        </button>
      </div>

      {showForm && (
        <div className="card">
          <FieldForm
            fields={[
              { name: 'nip', label: 'NIP', type: 'text' },
              { name: 'name', label: 'Nama Lengkap', type: 'text', required: true },
              {
                name: 'category',
                label: 'Kategori Tenaga',
                type: 'select',
                required: true,
                options: EMPLOYEE_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))
              },
              { name: 'profession', label: 'Profesi/Spesialisasi', type: 'text' },
              {
                name: 'workUnitId',
                label: 'Unit Kerja',
                type: 'select',
                options: units.map((u) => ({ value: u.id, label: u.name }))
              },
              { name: 'position', label: 'Jabatan', type: 'text' },
              {
                name: 'jobGradeId',
                label: 'Job Grade',
                type: 'select',
                options: grades.map((g) => ({ value: g.id, label: g.name }))
              },
              {
                name: 'employmentStatus',
                label: 'Status Kepegawaian',
                type: 'select',
                options: EMPLOYMENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))
              },
              { name: 'startDate', label: 'Tanggal Mulai Kerja', type: 'date' },
              {
                name: 'minimumCategory',
                label: 'Kategori Pendapatan Minimum (opsional)',
                type: 'text',
                placeholder: 'dokter_spesialis'
              }
            ]}
            onSubmit={async (values) => {
              await api.post('/api/master/employees', values);
              setShowForm(false);
              await load(q);
            }}
          />
        </div>
      )}

      <div className="card">
        <input
          className="input max-w-sm"
          placeholder="Cari nama atau NIP..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load(q)}
        />
      </div>

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : employees.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada data pegawai.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>NIP</th>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Unit Kerja</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td>{e.nip ?? '-'}</td>
                  <td>{e.name}</td>
                  <td>{EMPLOYEE_CATEGORIES.find((c) => c.value === e.category)?.label ?? e.category}</td>
                  <td>{unitName(e.workUnitId)}</td>
                  <td>
                    <span className={`badge ${e.isActive ? 'bg-pinus-100 text-pinus-800' : 'bg-slate-100 text-slate-600'}`}>
                      {e.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <Link href={`/master/employees/${e.id}`} className="text-lembang-700 hover:underline">
                      Detail
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
