"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { DeductionTrigger, UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { DeductionRule } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { Modal } from "@/components/Modal";
import { formatDate, formatPercent } from "@/lib/format";

const TRIGGER_LABELS: Record<string, string> = {
  DISCIPLINARY_ACTION: "Pembinaan/Hukuman Disiplin",
  LEAVE_GE_1_MONTH: "Cuti ≥ 1 Bulan",
  FIGHT_DURING_COACHING: "Perkelahian Selama Pembinaan",
  TRAINING_GT_1_MONTH: "Diklat > 1 Bulan",
  STUDY_ASSIGNMENT_ABSENCE: "Tugas Belajar (Absensi ≥3 hari/minggu)",
};

function DeductionRulesPageContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    trigger: DeductionTrigger.LEAVE_GE_1_MONTH as string,
    description: "",
    percentage: "50",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["deduction-rules", true],
    queryFn: async () => (await apiClient.get<DeductionRule[]>("/deduction-rules?includeHistory=true")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => apiClient.post("/deduction-rules", { ...form, percentage: Number(form.percentage) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deduction-rules"] });
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
          <h1 className="text-xl font-bold text-gray-900">Aturan Pengurangan</h1>
          <p className="text-sm text-gray-500">
            Versi baru menutup versi aktif sebelumnya secara otomatis — riwayat kebijakan lama tetap tersimpan.
          </p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Versi Aturan
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Kondisi</th>
              <th>Deskripsi</th>
              <th>Persentase</th>
              <th>Berlaku Sejak</th>
              <th>Berlaku Sampai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            )}
            {data?.map((r) => (
              <tr key={r.id} className={r.effectiveTo ? "text-gray-400" : ""}>
                <td>{TRIGGER_LABELS[r.trigger] ?? r.trigger}</td>
                <td>{r.description}</td>
                <td>{formatPercent(r.percentage)}</td>
                <td>{formatDate(r.effectiveFrom)}</td>
                <td>{r.effectiveTo ? formatDate(r.effectiveTo) : "Aktif"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Tambah Versi Aturan Pengurangan" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Kondisi</label>
              <select className="input" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })}>
                {Object.values(DeductionTrigger).map((t) => (
                  <option key={t} value={t}>{TRIGGER_LABELS[t] ?? t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Deskripsi</label>
              <input className="input" required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Persentase Pengurangan (%)</label>
              <input type="number" step="0.1" min="0" max="100" className="input" required value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
            </div>
            <div>
              <label className="label">Berlaku Sejak</label>
              <input type="date" className="input" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
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

export default function DeductionRulesPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL]}>
      <DeductionRulesPageContent />
    </RoleGuard>
  );
}
