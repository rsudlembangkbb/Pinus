"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { ServiceGuaranteeStatus, ServiceRole, UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { ProportionScheme, WorkUnit } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { Modal } from "@/components/Modal";
import { formatDate, formatPercent } from "@/lib/format";

function ProportionSchemesPageContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    workUnitId: "",
    guaranteeStatus: ServiceGuaranteeStatus.JKN as string,
    serviceRole: ServiceRole.DPJP as string,
    percentage: "10",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const { data: workUnits } = useQuery({
    queryKey: ["work-units"],
    queryFn: async () => (await apiClient.get<WorkUnit[]>("/work-units")).data,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["proportion-schemes"],
    queryFn: async () => (await apiClient.get<ProportionScheme[]>("/proportion-schemes")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => apiClient.post("/proportion-schemes", { ...form, percentage: Number(form.percentage) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proportion-schemes"] });
      setShowForm(false);
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
          <h1 className="text-xl font-bold text-gray-900">Skema Proporsi Jaspel</h1>
          <p className="text-sm text-gray-500">
            Persentase proporsi per unit kerja, status JKN/Non-JKN, dan peran dalam tindakan.
            &ldquo;PELAKSANA&rdquo; juga dipakai sebagai persentase pool tim unit untuk tenaga kesehatan.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Versi Skema
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Unit Kerja</th>
              <th>Status</th>
              <th>Peran</th>
              <th>Persentase</th>
              <th>Berlaku Sejak</th>
              <th>Berlaku Sampai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            )}
            {data?.map((s) => (
              <tr key={s.id}>
                <td>{s.workUnit.name}</td>
                <td>{s.guaranteeStatus}</td>
                <td>{s.serviceRole}</td>
                <td>{formatPercent(s.percentage)}</td>
                <td>{formatDate(s.effectiveFrom)}</td>
                <td>{s.effectiveTo ? formatDate(s.effectiveTo) : "Aktif"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Tambah Versi Skema Proporsi" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Unit Kerja</label>
              <select className="input" required value={form.workUnitId} onChange={(e) => setForm({ ...form, workUnitId: e.target.value })}>
                <option value="">Pilih unit…</option>
                {workUnits?.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Status Penjaminan</label>
                <select className="input" value={form.guaranteeStatus} onChange={(e) => setForm({ ...form, guaranteeStatus: e.target.value })}>
                  {Object.values(ServiceGuaranteeStatus).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Peran</label>
                <select className="input" value={form.serviceRole} onChange={(e) => setForm({ ...form, serviceRole: e.target.value })}>
                  {Object.values(ServiceRole).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Persentase (%)</label>
              <input type="number" step="0.01" min="0" max="100" className="input" required value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
            </div>
            <div>
              <label className="label">Berlaku Sejak</label>
              <input type="date" className="input" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
            </div>
            <div>
              <label className="label">Catatan (opsional)</label>
              <input className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

export default function ProportionSchemesPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL]}>
      <ProportionSchemesPageContent />
    </RoleGuard>
  );
}
