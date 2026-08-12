"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { JobGrade } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { Modal } from "@/components/Modal";

function JobGradesPageContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", weightScore: "1", description: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["job-grades", true],
    queryFn: async () => (await apiClient.get<JobGrade[]>("/job-grades?includeInactive=true")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/job-grades", { ...form, weightScore: Number(form.weightScore) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-grades"] });
      setShowForm(false);
      setForm({ code: "", name: "", weightScore: "1", description: "" });
    },
    onError: (err) => setError(apiErrorMessage(err)),
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
          <h1 className="text-xl font-bold text-gray-900">Job Grade & Bobot Indeksing</h1>
          <p className="text-sm text-gray-500">
            Job grade tenaga kesehatan tim unit — bobot menentukan porsi distribusi pool unit.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Job Grade
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th>Bobot</th>
              <th>Deskripsi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            )}
            {data?.map((g) => (
              <tr key={g.id}>
                <td className="font-mono">{g.code}</td>
                <td>{g.name}</td>
                <td>{g.weightScore}</td>
                <td className="text-gray-500">{g.description}</td>
                <td>
                  <span className={`badge ${g.isActive ? "bg-pinus-100 text-pinus-700" : "bg-gray-100 text-gray-500"}`}>
                    {g.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Tambah Job Grade" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Kode</label>
              <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <label className="label">Nama</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Bobot (angka)</label>
              <input type="number" step="0.01" className="input" required value={form.weightScore} onChange={(e) => setForm({ ...form, weightScore: e.target.value })} />
            </div>
            <div>
              <label className="label">Deskripsi (opsional)</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

export default function JobGradesPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL]}>
      <JobGradesPageContent />
    </RoleGuard>
  );
}
