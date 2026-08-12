"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlayCircle, Send, CheckCircle2, XCircle, Rocket } from "lucide-react";
import { UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CalculationResult, Period } from "@/types/api";
import { PeriodStatusBadge, DecisionBadge } from "@/components/StatusBadge";
import { formatDateTime, formatRupiah } from "@/lib/format";

const STAGE_LABELS: Record<string, string> = {
  UNIT_VERIFICATION: "Verifikasi Unit",
  FINANCE_VERIFICATION: "Verifikasi Keuangan",
  DIRECTOR_APPROVAL: "Persetujuan Direktur",
};

export default function PeriodDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const { data: period, isLoading } = useQuery({
    queryKey: ["period", id],
    queryFn: async () => (await apiClient.get<Period>(`/periods/${id}`)).data,
  });

  const { data: results } = useQuery({
    queryKey: ["period-results", id],
    queryFn: async () => (await apiClient.get<CalculationResult[]>(`/periods/${id}/results`)).data,
    enabled: !!period && period.status !== "DRAFT",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["period", id] });
    queryClient.invalidateQueries({ queryKey: ["period-results", id] });
    queryClient.invalidateQueries({ queryKey: ["periods"] });
  };
  const onMutationError = (err: unknown) => setError(apiErrorMessage(err));

  const calculateMutation = useMutation({
    mutationFn: async () => apiClient.post(`/periods/${id}/calculate`),
    onSuccess: invalidate,
    onError: onMutationError,
  });
  const submitMutation = useMutation({
    mutationFn: async () => apiClient.post(`/periods/${id}/submit-for-verification`),
    onSuccess: invalidate,
    onError: onMutationError,
  });
  const publishMutation = useMutation({
    mutationFn: async () => apiClient.post(`/periods/${id}/publish`),
    onSuccess: invalidate,
    onError: onMutationError,
  });

  const decideMutation = useMutation({
    mutationFn: async ({ stepId, decision }: { stepId: string; decision: "APPROVED" | "REJECTED" }) =>
      apiClient.post(`/periods/${id}/approvals/${stepId}/decide`, {
        decision,
        notes: notesById[stepId] || undefined,
      }),
    onSuccess: invalidate,
    onError: (err) => setError(apiErrorMessage(err)),
  });

  if (isLoading || !period) return <div className="text-gray-400">Memuat…</div>;

  const isAdmin = user && [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL].includes(user.role);

  const totalNet = results?.reduce((acc, r) => acc + Number(r.netAmount), 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{period.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <PeriodStatusBadge status={period.status} />
            {period.lockedAt && <span className="text-xs text-gray-400">Terkunci sejak {formatDateTime(period.lockedAt)}</span>}
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {["DRAFT", "PROCESSING", "CALCULATED"].includes(period.status) && (
              <button className="btn-primary" disabled={calculateMutation.isPending} onClick={() => calculateMutation.mutate()}>
                <PlayCircle size={16} /> {calculateMutation.isPending ? "Mengkalkulasi…" : "Jalankan Kalkulasi"}
              </button>
            )}
            {period.status === "CALCULATED" && (
              <button className="btn-secondary" disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
                <Send size={16} /> Ajukan Verifikasi
              </button>
            )}
            {period.status === "FINAL" && (
              <button className="btn-primary" disabled={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
                <Rocket size={16} /> Publikasikan
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard label="Pagu Insentif Kinerja" value={period.performanceBudgetCap ? formatRupiah(period.performanceBudgetCap) : "Tidak dibatasi"} />
        <InfoCard label="Alokasi Insentif Administrasi" value={formatRupiah(period.administrativeBudget)} />
        <InfoCard label="Total Jaspel Terhitung" value={formatRupiah(totalNet)} />
      </div>

      {period.approvalSteps && period.approvalSteps.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-100 px-5 py-3 font-medium text-gray-800">Alur Verifikasi & Persetujuan</div>
          <table className="table-base">
            <thead className="bg-gray-50">
              <tr>
                <th>Tahap</th>
                <th>Unit</th>
                <th>Status</th>
                <th>Diputuskan Oleh</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {period.approvalSteps.map((step) => {
                const canDecide = canUserDecide(user, step, period.status);
                return (
                  <tr key={step.id}>
                    <td>{STAGE_LABELS[step.stage] ?? step.stage}</td>
                    <td>{step.workUnit?.name ?? "-"}</td>
                    <td><DecisionBadge decision={step.decision} /></td>
                    <td>{step.actor?.username ?? "-"}</td>
                    <td className="max-w-xs truncate">{step.notes ?? "-"}</td>
                    <td>
                      {canDecide && (
                        <div className="flex items-center gap-2">
                          <input
                            className="input h-8 w-32 text-xs"
                            placeholder="Catatan…"
                            value={notesById[step.id] ?? ""}
                            onChange={(e) => setNotesById({ ...notesById, [step.id]: e.target.value })}
                          />
                          <button
                            className="text-pinus-600 hover:text-pinus-800"
                            title="Setujui"
                            disabled={decideMutation.isPending}
                            onClick={() => decideMutation.mutate({ stepId: step.id, decision: "APPROVED" })}
                          >
                            <CheckCircle2 size={20} />
                          </button>
                          <button
                            className="text-red-500 hover:text-red-700"
                            title="Tolak"
                            disabled={decideMutation.isPending}
                            onClick={() => decideMutation.mutate({ stepId: step.id, decision: "REJECTED" })}
                          >
                            <XCircle size={20} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {results && results.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-100 px-5 py-3 font-medium text-gray-800">
            Hasil Kalkulasi ({results.length} pegawai)
          </div>
          <table className="table-base">
            <thead className="bg-gray-50">
              <tr>
                <th>NIP</th>
                <th>Nama</th>
                <th>Unit</th>
                <th>Kategori</th>
                <th>Gross</th>
                <th>Potongan</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.employee.nip}</td>
                  <td>{r.employee.fullName}</td>
                  <td>{r.employee.workUnit.name}</td>
                  <td>{r.staffCategory}</td>
                  <td>{formatRupiah(r.grossAmount)}</td>
                  <td>{formatRupiah(r.deductionAmount)}</td>
                  <td className="font-semibold">{formatRupiah(r.netAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function canUserDecide(
  user: { role: UserRole; employeeId: string | null } | null,
  step: { stage: string; decision: string; workUnitId: string | null },
  periodStatus: string,
): boolean {
  if (!user || step.decision !== "PENDING") return false;
  if (user.role === UserRole.SUPER_ADMIN) return true;
  const stageStatusMap: Record<string, string> = {
    UNIT_VERIFICATION: "UNIT_VERIFICATION",
    FINANCE_VERIFICATION: "FINANCE_VERIFICATION",
    DIRECTOR_APPROVAL: "DIRECTOR_APPROVAL",
  };
  if (stageStatusMap[step.stage] !== periodStatus) return false;
  if (step.stage === "UNIT_VERIFICATION") return user.role === UserRole.VERIFIKATOR_UNIT;
  if (step.stage === "FINANCE_VERIFICATION") return user.role === UserRole.KEUANGAN;
  if (step.stage === "DIRECTOR_APPROVAL") return user.role === UserRole.DIREKTUR;
  return false;
}
