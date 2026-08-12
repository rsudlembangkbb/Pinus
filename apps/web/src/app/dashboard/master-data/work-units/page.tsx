"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { WorkUnit } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { Modal } from "@/components/Modal";

const SERVICE_CATEGORIES = [
  "rawat_inap",
  "rawat_jalan",
  "igd",
  "ibs",
  "radiologi",
  "laboratorium",
  "rehab_medik",
  "administrasi",
];

function WorkUnitsPageContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ code: "", name: "", serviceCategory: SERVICE_CATEGORIES[0] });

  const { data, isLoading } = useQuery({
    queryKey: ["work-units", true],
    queryFn: async () => (await apiClient.get<WorkUnit[]>("/work-units?includeInactive=true")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => apiClient.post("/work-units", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-units"] });
      setShowForm(false);
      setForm({ code: "", name: "", serviceCategory: SERVICE_CATEGORIES[0] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const toggleMutation = useMutation({
    mutationFn: async (unit: WorkUnit) =>
      apiClient.patch(`/work-units/${unit.id}`, { isActive: !unit.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work-units"] }),
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
          <h1 className="text-xl font-bold text-gray-900">Master Unit Kerja</h1>
          <p className="text-sm text-gray-500">Unit kerja/instalasi beserta kategori layanan.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Unit
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th>Kategori Layanan</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">
                  Memuat…
                </td>
              </tr>
            )}
            {data?.map((unit) => (
              <tr key={unit.id}>
                <td className="font-mono">{unit.code}</td>
                <td>{unit.name}</td>
                <td>{unit.serviceCategory}</td>
                <td>
                  <span className={`badge ${unit.isActive ? "bg-pinus-100 text-pinus-700" : "bg-gray-100 text-gray-500"}`}>
                    {unit.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
                <td>
                  <button
                    className="text-sm text-pinus-700 hover:underline"
                    onClick={() => toggleMutation.mutate(unit)}
                  >
                    {unit.isActive ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Tambah Unit Kerja" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Kode Unit</label>
              <input
                className="input"
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="label">Nama Unit</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Kategori Layanan</label>
              <select
                className="input"
                value={form.serviceCategory}
                onChange={(e) => setForm({ ...form, serviceCategory: e.target.value })}
              >
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
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

export default function WorkUnitsPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL]}>
      <WorkUnitsPageContent />
    </RoleGuard>
  );
}
