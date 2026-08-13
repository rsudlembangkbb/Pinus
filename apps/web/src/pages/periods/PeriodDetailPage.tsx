import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import {
  APPROVAL_STAGES,
  formatRupiah,
  PERIOD_STATUS_LABELS,
  type ApprovalStep,
  type CalculationPeriod,
  type CalculationResult,
  type WorkUnit,
} from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, Card, CardHeader, ErrorBanner, Field, Input, PageHeader, Select, StatTile, Textarea } from "@/components/ui";
import { api, ApiError, downloadFile } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

const STAGE_LABELS: Record<string, string> = {
  VERIFIKASI_UNIT: "Verifikasi Unit",
  VERIFIKASI_KEUANGAN: "Verifikasi Keuangan",
  PERSETUJUAN_DIREKTUR: "Persetujuan Direktur",
};

export function PeriodDetailPage() {
  const { id = "" } = useParams();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["period", id],
    queryFn: () => api.get<{ period: CalculationPeriod; approvalSteps: ApprovalStep[] }>(`/workflow/periods/${id}`),
  });
  const { data: workUnits } = useQuery({
    queryKey: ["work-units", "all"],
    queryFn: () => api.get<{ items: WorkUnit[] }>("/master/work-units?pageSize=200"),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["period", id] });
    queryClient.invalidateQueries({ queryKey: ["period-results", id] });
  };

  const runMutation = useMutation({
    mutationFn: () => api.post(`/calculation/periods/${id}/run`),
    onSuccess: invalidate,
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Gagal menjalankan kalkulasi"),
  });
  const submitMutation = useMutation({
    mutationFn: () => api.post(`/workflow/periods/${id}/submit-for-verification`),
    onSuccess: invalidate,
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Gagal mengajukan verifikasi"),
  });
  const decisionMutation = useMutation({
    mutationFn: (input: { path: string; status: "APPROVED" | "REJECTED"; note: string }) =>
      api.post(`${input.path}`, { status: input.status, note: input.note || null }),
    onSuccess: invalidate,
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Gagal memproses keputusan"),
  });
  const correctionMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/workflow/periods/${id}/reopen-correction`, { reason }),
    onSuccess: invalidate,
    onError: (err) => setActionError(err instanceof ApiError ? err.message : "Gagal membuka koreksi"),
  });

  if (isLoading || !data) return <p className="text-sm text-slate-400">Memuat…</p>;
  const { period, approvalSteps } = data;
  const workUnitName = (wid: string | null) => (wid ? workUnits?.items.find((w) => w.id === wid)?.name ?? wid : "-");

  return (
    <div className="space-y-6">
      <PageHeader
        title={period.label}
        description={`Status saat ini: ${PERIOD_STATUS_LABELS[period.status as keyof typeof PERIOD_STATUS_LABELS]}`}
        action={<Badge tone="blue">{period.code}</Badge>}
      />
      {actionError && <ErrorBanner message={actionError} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Pagu Insentif" value={period.paguAmount != null ? formatRupiah(period.paguAmount) : "Tidak dibatasi"} />
        <StatTile label="Faktor Penyesuaian" value={period.adjustmentFactorBp != null ? `${(period.adjustmentFactorBp / 100).toFixed(2)}%` : "-"} />
        <StatTile label="Terakhir Dikalkulasi" value={period.calculatedAt?.slice(0, 16).replace("T", " ") ?? "Belum pernah"} />
      </div>

      <Card>
        <CardHeader title="Aksi Alur Kerja" subtitle="Ikuti tahapan: kalkulasi → verifikasi unit → verifikasi keuangan → persetujuan direktur → final." />
        <div className="flex flex-wrap gap-3 p-5">
          {(period.status === "DRAFT" || period.status === "DIPROSES") && hasPermission("calculation.run") && (
            <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
              {runMutation.isPending ? "Menghitung…" : "▶ Jalankan Kalkulasi"}
            </Button>
          )}
          {period.status === "DIPROSES" && hasPermission("workflow.manage_period") && (
            <Button variant="secondary" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? "Mengajukan…" : "Ajukan untuk Verifikasi"}
            </Button>
          )}
          {period.status === "FINAL" && hasPermission("workflow.correction") && (
            <CorrectionButton onSubmit={(reason) => correctionMutation.mutate(reason)} pending={correctionMutation.isPending} />
          )}
        </div>
      </Card>

      {period.status === "MENUNGGU_VERIFIKASI_UNIT" && hasPermission("workflow.verify_unit") && (
        <Card>
          <CardHeader title="Verifikasi Unit" subtitle="Setujui atau kembalikan data untuk unit yang menjadi kewenangan Anda." />
          <div className="divide-y divide-slate-100">
            {approvalSteps
              .filter((s) => s.stage === "VERIFIKASI_UNIT")
              .map((step) => (
                <ApprovalRow
                  key={step.id}
                  label={workUnitName(step.workUnitId)}
                  step={step}
                  onDecide={(status, note) =>
                    decisionMutation.mutate({ path: `/workflow/periods/${id}/verify/unit/${step.workUnitId}`, status, note })
                  }
                />
              ))}
          </div>
        </Card>
      )}

      {period.status === "MENUNGGU_VERIFIKASI_KEUANGAN" && hasPermission("workflow.verify_keuangan") && (
        <Card>
          <CardHeader title="Verifikasi Bagian Keuangan" subtitle="Periksa kesesuaian hasil perhitungan dengan alokasi anggaran Jaspel BLUD." />
          <div className="divide-y divide-slate-100">
            {approvalSteps
              .filter((s) => s.stage === "VERIFIKASI_KEUANGAN" && s.status === "PENDING")
              .map((step) => (
                <ApprovalRow
                  key={step.id}
                  label="Verifikasi Keuangan"
                  step={step}
                  onDecide={(status, note) => decisionMutation.mutate({ path: `/workflow/periods/${id}/verify/keuangan`, status, note })}
                />
              ))}
          </div>
        </Card>
      )}

      {period.status === "MENUNGGU_PERSETUJUAN_DIREKTUR" && hasPermission("workflow.approve_direktur") && (
        <Card>
          <CardHeader title="Persetujuan Direktur" subtitle="Persetujuan akhir sebelum hasil dikunci dan dipublikasikan ke pegawai." />
          <div className="divide-y divide-slate-100">
            {approvalSteps
              .filter((s) => s.stage === "PERSETUJUAN_DIREKTUR" && s.status === "PENDING")
              .map((step) => (
                <ApprovalRow
                  key={step.id}
                  label="Persetujuan Direktur"
                  step={step}
                  onDecide={(status, note) => decisionMutation.mutate({ path: `/workflow/periods/${id}/verify/direktur`, status, note })}
                />
              ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Riwayat Tahapan" subtitle="Jejak waktu, pengguna, dan status setiap tahap verifikasi/persetujuan." />
        <div className="divide-y divide-slate-100 p-4">
          {APPROVAL_STAGES.map((stage) => {
            const steps = approvalSteps.filter((s) => s.stage === stage);
            if (steps.length === 0) return null;
            return (
              <div key={stage} className="py-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{STAGE_LABELS[stage]}</p>
                <div className="space-y-1">
                  {steps.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">{workUnitName(s.workUnitId)}{s.actedByName ? ` — ${s.actedByName}` : ""}</span>
                      <Badge tone={s.status === "APPROVED" ? "green" : s.status === "REJECTED" ? "red" : "amber"}>{s.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {approvalSteps.length === 0 && <p className="py-6 text-center text-sm text-slate-400">Belum ada tahapan verifikasi.</p>}
        </div>
      </Card>

      {hasPermission("report.export") && (
        <Card>
          <CardHeader title="Ekspor & Laporan" />
          <div className="flex flex-wrap gap-2 p-5">
            <Button variant="secondary" onClick={() => downloadFile(`/reports/periods/${id}/rekap-unit.xlsx`, `rekap-unit-${period.code}.xlsx`)}>
              📄 Rekap per Unit (Excel)
            </Button>
            <Button variant="secondary" onClick={() => downloadFile(`/reports/periods/${id}/rekap-total.xlsx`, `rekap-total-${period.code}.xlsx`)}>
              📄 Rekap Total (Excel)
            </Button>
            <Button variant="secondary" onClick={() => downloadFile(`/reports/periods/${id}/raw-data.xlsx`, `data-mentah-${period.code}.xlsx`)}>
              📄 Data Mentah (Excel)
            </Button>
            <Button variant="secondary" onClick={() => downloadFile(`/reports/periods/${id}/slips.zip`, `slip-jaspel-${period.code}.zip`)}>
              🗂 Slip Massal (ZIP)
            </Button>
          </div>
        </Card>
      )}

      {hasPermission("calculation.read") && <ResultsSection periodId={id} workUnits={workUnits?.items ?? []} />}
      {hasPermission("calculation.simulate") && <SimulationPanel periodId={id} />}
    </div>
  );
}

function CorrectionButton({ onSubmit, pending }: { onSubmit: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button variant="danger" onClick={() => setOpen(true)}>
        🔓 Buka untuk Koreksi
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Field label="Alasan Koreksi (wajib, tercatat pada audit log)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Koreksi data kehadiran pasca-finalisasi" />
        </Field>
      </div>
      <Button variant="danger" disabled={!reason || pending} onClick={() => onSubmit(reason)}>
        Konfirmasi Buka Koreksi
      </Button>
    </div>
  );
}

function ApprovalRow({ label, step, onDecide }: { label: string; step: ApprovalStep; onDecide: (status: "APPROVED" | "REJECTED", note: string) => void }) {
  const [note, setNote] = useState("");
  if (step.status !== "PENDING") {
    return (
      <div className="flex items-center justify-between px-5 py-3 text-sm">
        <span className="text-slate-600">{label}</span>
        <Badge tone={step.status === "APPROVED" ? "green" : "red"}>{step.status}</Badge>
      </div>
    );
  }
  return (
    <div className="space-y-2 px-5 py-3">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <Textarea rows={2} placeholder="Catatan (opsional untuk setuju, wajib untuk kembalikan)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button onClick={() => onDecide("APPROVED", note)}>Setujui</Button>
        <Button variant="danger" disabled={!note} onClick={() => onDecide("REJECTED", note)}>
          Kembalikan
        </Button>
      </div>
    </div>
  );
}

function ResultsSection({ periodId, workUnits }: { periodId: string; workUnits: WorkUnit[] }) {
  const [workUnitId, setWorkUnitId] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["period-results", periodId, workUnitId, page],
    queryFn: () =>
      api.get<{ items: (CalculationResult & { employeeName: string; employeeNip: string })[]; total: number; page: number; pageSize: number }>(
        `/calculation/periods/${periodId}/results?page=${page}${workUnitId ? `&workUnitId=${workUnitId}` : ""}`,
      ),
  });

  const columns: Column<CalculationResult & { employeeName: string; employeeNip: string }>[] = [
    { key: "nip", header: "NIP", render: (r) => <span className="font-mono text-xs">{r.employeeNip}</span> },
    { key: "name", header: "Nama", render: (r) => r.employeeName },
    { key: "engine", header: "Mesin", render: (r) => <Badge tone="slate">{r.engineKind}</Badge> },
    { key: "gross", header: "Kotor", render: (r) => formatRupiah(r.grossAmount) },
    { key: "deduction", header: "Potongan", render: (r) => (r.deductionAmount ? `- ${formatRupiah(r.deductionAmount)}` : "-") },
    { key: "net", header: "Diterima", render: (r) => <span className="font-semibold text-pinus-700">{formatRupiah(r.netAmount)}</span> },
  ];

  return (
    <Card>
      <CardHeader
        title="Hasil Kalkulasi per Pegawai"
        action={
          <Select value={workUnitId} onChange={(e) => { setWorkUnitId(e.target.value); setPage(1); }} className="w-48">
            <option value="">Semua Unit</option>
            {workUnits.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        }
      />
      <div className="p-4">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          keyFor={(r) => r.id}
          loading={isLoading}
          total={data?.total}
          page={page}
          pageSize={data?.pageSize ?? 25}
          onPageChange={setPage}
          emptyTitle="Belum ada hasil kalkulasi"
        />
      </div>
    </Card>
  );
}

function SimulationPanel({ periodId }: { periodId: string }) {
  const [pagu, setPagu] = useState("");
  const [adminAlloc, setAdminAlloc] = useState("");
  const [exempt, setExempt] = useState(false);
  const mutation = useMutation({
    mutationFn: () =>
      api.post<{ totalBeforeAdjustment: number; totalAfterAdjustment: number; adjustmentFactorBp: number; paguExceeded: boolean; results: unknown[] }>(
        `/calculation/periods/${periodId}/simulate`,
        {
          paguAmount: pagu ? Number(pagu) : null,
          administrasiAllocationAmount: adminAlloc ? Number(adminAlloc) : undefined,
          exemptMinimumFromAdjustment: exempt,
        },
      ),
  });

  return (
    <Card>
      <CardHeader title="Simulasi What-If" subtitle="Uji parameter tanpa memengaruhi data final — cocok untuk analisis kebijakan sebelum diberlakukan resmi." />
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Pagu (Rp) — kosongkan untuk tidak dibatasi">
            <Input type="number" value={pagu} onChange={(e) => setPagu(e.target.value)} />
          </Field>
          <Field label="Alokasi Administrasi (Rp)">
            <Input type="number" value={adminAlloc} onChange={(e) => setAdminAlloc(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={exempt} onChange={(e) => setExempt(e.target.checked)} />
          Kecualikan minimum requirement dari penyesuaian pagu
        </label>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Mensimulasikan…" : "Jalankan Simulasi"}
        </Button>
        {mutation.data && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Total Sebelum Penyesuaian" value={formatRupiah(mutation.data.totalBeforeAdjustment)} />
            <StatTile label="Total Setelah Penyesuaian" value={formatRupiah(mutation.data.totalAfterAdjustment)} tone="green" />
            <StatTile label="Faktor Penyesuaian" value={`${(mutation.data.adjustmentFactorBp / 100).toFixed(2)}%`} tone={mutation.data.paguExceeded ? "amber" : "slate"} />
          </div>
        )}
      </div>
    </Card>
  );
}
