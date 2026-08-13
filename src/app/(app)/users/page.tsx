'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import FieldForm from '@/components/master/field-form';
import { ROLE_LABELS, RoleCode } from '@/lib/auth/roles';

interface WorkUnit {
  id: string;
  name: string;
}
interface AppUser {
  id: string;
  username: string;
  email: string;
  isActive: boolean;
  roleCode: string;
  roleName: string;
  workUnitId: string | null;
}

const ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

export default function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [units, setUnits] = useState<WorkUnit[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tempCredential, setTempCredential] = useState<{ username: string; password: string } | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [u, w] = await Promise.all([api.get<AppUser[]>('/api/admin/users'), api.get<WorkUnit[]>('/api/master/work-units')]);
    setUsers(u);
    setUnits(w);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleActive(user: AppUser) {
    await api.patch(`/api/admin/users/${user.id}`, { isActive: !user.isActive });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Pengguna & Peran</h1>
          <p className="text-sm text-slate-500">Manajemen akun, penetapan peran (RBAC), dan pembatasan akses berbasis unit kerja.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Tutup Formulir' : '+ Tambah Pengguna'}
        </button>
      </div>

      {tempCredential && (
        <div className="card border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-900">
            Akun <span className="font-mono">{tempCredential.username}</span> berhasil dibuat. Kata sandi sementara
            (sampaikan secara aman, hanya ditampilkan sekali):
          </p>
          <p className="mt-1 font-mono text-lg text-amber-900">{tempCredential.password}</p>
        </div>
      )}

      {showForm && (
        <div className="card">
          <FieldForm
            fields={[
              { name: 'username', label: 'Username', type: 'text', required: true },
              { name: 'email', label: 'Email', type: 'text', required: true },
              { name: 'roleCode', label: 'Peran', type: 'select', required: true, options: ROLE_OPTIONS },
              {
                name: 'workUnitId',
                label: 'Unit Kerja (untuk Verifikator Unit)',
                type: 'select',
                options: units.map((u) => ({ value: u.id, label: u.name }))
              }
            ]}
            onSubmit={async (values) => {
              const result = await api.post<{ id: string; temporaryPassword: string }>('/api/admin/users', values);
              setTempCredential({ username: String(values.username), password: result.temporaryPassword });
              setShowForm(false);
              await load();
            }}
          />
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Peran</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email}</td>
                  <td>{ROLE_LABELS[u.roleCode as RoleCode] ?? u.roleName}</td>
                  <td>
                    <span className={`badge ${u.isActive ? 'bg-pinus-100 text-pinus-800' : 'bg-slate-100 text-slate-600'}`}>
                      {u.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <button className="text-lembang-700 hover:underline" onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
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
