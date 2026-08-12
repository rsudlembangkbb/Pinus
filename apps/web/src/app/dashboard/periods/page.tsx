"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Period } from "@/types/api";
import { PeriodStatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { formatDate } from "@/lib/format";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function PeriodsListPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [form, setForm] = useState({
    name: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`,
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    performanceBudgetCap: "",
    administrativeBudget: "",
  });

  const { data: periods, isLoading } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => (await apiClient.get<Period[]>("/periods")).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/periods", {
        name: form.name,
        year: Number(form.year),
        month: Number(form.month),
        performanceBudgetCap: form.performanceBudgetCap ? Number(form.performanceBudgetCap) : undefined,
        administrativeBudget: form.administrativeBudget ? Number(form.administrativeBudget) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["periods"] });
      setShowForm(false);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  const canCreate = user && [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL].includes(user.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Periode & Kalkulasi</h1>
          <p className="text-sm text-gray-500">Siklus bulanan pembagian Jaspel.</p>
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Buka Periode Baru
          </button>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Periode</th>
              <th>Status</th>
              <th>Dibuka</th>
              <th>Terkunci</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            )}
            {periods?.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td><PeriodStatusBadge status={p.status} /></td>
                <td>{formatDate(p.createdAt)}</td>
                <td>{p.lockedAt ? formatDate(p.lockedAt) : "-"}</td>
                <td>
                  <Link href={`/dashboard/periods/${p.id}`} className="text-pinus-700 hover:underline">
                    Lihat Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Buka Periode Baru" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nama Periode</label>
              <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tahun</label>
                <input type="number" className="input" required value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
              </div>
              <div>
                <label className="label">Bulan</label>
                <select className="input" value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                  {MONTH_NAMES.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Pagu Insentif Kinerja (opsional)</label>
              <input type="number" className="input" value={form.performanceBudgetCap} onChange={(e) => setForm({ ...form, performanceBudgetCap: e.target.value })} placeholder="mis. 500000000" />
            </div>
            <div>
              <label className="label">Alokasi Insentif Tenaga Administrasi (opsional)</label>
              <input type="number" className="input" value={form.administrativeBudget} onChange={(e) => setForm({ ...form, administrativeBudget: e.target.value })} placeholder="mis. 50000000" />
            </div>
            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Menyimpan…" : "Buka Periode"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
