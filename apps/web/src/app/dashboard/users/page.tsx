"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ROLE_LABELS, UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { RoleGuard } from "@/components/RoleGuard";
import { Modal } from "@/components/Modal";

interface UserRow {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  employee?: { id: string; fullName: string; nip: string } | null;
}

function UsersPageContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", username: "", password: "", role: UserRole.PEGAWAI as string });

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get<UserRow[]>("/users")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => apiClient.post("/users", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowForm(false);
      setForm({ email: "", username: "", password: "", role: UserRole.PEGAWAI });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async (u: UserRow) => apiClient.patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manajemen Pengguna</h1>
          <p className="text-sm text-gray-500">Akun pengguna dan penetapan peran (RBAC).</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Pengguna
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Username</th>
              <th>Email</th>
              <th>Peran</th>
              <th>Pegawai Terhubung</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            )}
            {data?.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.username}</td>
                <td>{u.email}</td>
                <td>{ROLE_LABELS[u.role]}</td>
                <td>{u.employee ? `${u.employee.fullName} (${u.employee.nip})` : "-"}</td>
                <td>
                  <span className={`badge ${u.isActive ? "bg-pinus-100 text-pinus-700" : "bg-gray-100 text-gray-500"}`}>
                    {u.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td>
                  <button className="text-sm text-pinus-700 hover:underline" onClick={() => toggleMutation.mutate(u)}>
                    {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Tambah Pengguna" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="label">Password Awal</label>
              <input type="password" className="input" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div>
              <label className="label">Peran</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {Object.values(UserRole).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN]}>
      <UsersPageContent />
    </RoleGuard>
  );
}
