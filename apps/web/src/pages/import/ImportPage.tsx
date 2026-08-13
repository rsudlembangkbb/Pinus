import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CalculationPeriod, ImportBatch, ImportBatchKind, ImportRow } from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, Card, CardHeader, ErrorBanner, Field, PageHeader, Select } from "@/components/ui";
import { api, ApiError, downloadFile } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

const KIND_LABELS: Record<ImportBatchKind, string> = {
  SERVICE_TRANSACTIONS: "Transaksi Layanan (SIMRS)",
  ATTENDANCE: "Kehadiran / Cuti / Diklat",
  PERFORMANCE_SCORES: "Skor Kinerja / KPI",
};

export function ImportPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [periodId, setPeriodId] = useState("");
  const [kind, setKind] = useState<ImportBatchKind>("SERVICE_TRANSACTIONS");
  const [error, setError] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);

  const { data: periods } = useQuery({
    queryKey: ["periods", "all"],
    queryFn: () => api.get<{ items: CalculationPeriod[] }>("/workflow/periods?pageSize=100"),
  });
  const activePeriod = periods?.items.find((p) => p.id === periodId) ?? periods?.items[0];
  const effectivePeriodId = periodId || activePeriod?.id || "";

  const { data: batches } = useQuery({
    queryKey: ["import-batches", effectivePeriodId],
    queryFn: () => api.get<{ items: ImportBatch[] }>(`/import/batches?periodId=${effectivePeriodId}`),
    enabled: !!effectivePeriodId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("kind", kind);
      form.append("periodId", effectivePeriodId);
      form.append("file", file);
      return api.postForm<ImportBatch>("/import/batches", form);
    },
    onSuccess: (batch) => {
      setError(null);
      setSelectedBatch(batch);
      queryClient.invalidateQueries({ queryKey: ["import-batches", effectivePeriodId] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal mengunggah berkas"),
  });

  const commitMutation = useMutation({
    mutationFn: (batchId: string) => api.post<{ batch: ImportBatch; committedCount: number }>(`/import/batches/${batchId}/commit`),
    onSuccess: ({ batch }) => {
      setSelectedBatch(batch);
      queryClient.invalidateQueries({ queryKey: ["import-batches", effectivePeriodId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal mengomit data"),
  });

  const batchColumns: Column<ImportBatch>[] = [
    { key: "file", header: "Berkas", render: (r) => r.fileName },
    { key: "kind", header: "Jenis", render: (r) => KIND_LABELS[r.kind] },
    { key: "rows", header: "Baris", render: (r) => `${r.successRows}/${r.totalRows} valid` },
    {
      key: "status",
      header: "Status",
      render: (r) => <Badge tone={r.status === "COMMITTED" ? "green" : r.errorRows > 0 ? "amber" : "blue"}>{r.status}</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <button className="text-xs font-medium text-lembang-700 hover:underline" onClick={() => setSelectedBatch(r)}>
            Lihat
          </button>
          {r.status !== "COMMITTED" && hasPermission("import.commit") && (
            <button
              className="text-xs font-medium text-pinus-700 hover:underline disabled:opacity-40"
              disabled={commitMutation.isPending}
              onClick={() => commitMutation.mutate(r.id)}
            >
              Komit
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Impor Data SIMRS" description="Unggah berkas ekspor SIMRS bulanan (transaksi layanan, kehadiran, skor kinerja) sesuai template." />

      <Card>
        <CardHeader title="Wizard Unggah Berkas" subtitle="Unduh template → isi sesuai format → unggah → tinjau → komit ke sistem." />
        <div className="space-y-4 p-5">
          {error && <ErrorBanner message={error} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Periode">
              <Select value={effectivePeriodId} onChange={(e) => setPeriodId(e.target.value)}>
                {periods?.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} ({p.status})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Jenis Data">
              <Select value={kind} onChange={(e) => setKind(e.target.value as ImportBatchKind)}>
                {Object.entries(KIND_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => downloadFile(`/import/template/${kind}`, `template-${kind.toLowerCase()}.xlsx`)}>
              ⬇ Unduh Template
            </Button>
            {hasPermission("import.upload") && (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-pinus-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-pinus-700">
                {uploadMutation.isPending ? "Mengunggah…" : "Unggah Berkas (.xlsx/.csv)"}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  disabled={!effectivePeriodId || uploadMutation.isPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadMutation.mutate(file);
                  }}
                />
              </label>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Riwayat Impor" subtitle="Setiap sesi impor tercatat lengkap dengan jumlah baris berhasil/gagal." />
        <div className="p-4">
          <DataTable columns={batchColumns} rows={batches?.items ?? []} keyFor={(r) => r.id} emptyTitle="Belum ada riwayat impor untuk periode ini" />
        </div>
      </Card>

      {selectedBatch && <BatchRowsPanel batch={selectedBatch} onClose={() => setSelectedBatch(null)} />}
    </div>
  );
}

function BatchRowsPanel({ batch, onClose }: { batch: ImportBatch; onClose: () => void }) {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data, isLoading } = useQuery({
    queryKey: ["import-rows", batch.id, statusFilter],
    queryFn: () => api.get<{ items: (ImportRow & { raw: Record<string, unknown> })[] }>(`/import/batches/${batch.id}/rows${statusFilter ? `?status=${statusFilter}` : ""}&pageSize=100`),
  });

  const columns: Column<ImportRow & { raw: Record<string, unknown> }>[] = [
    { key: "row", header: "Baris", render: (r) => r.rowNumber },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.status === "OK" ? "green" : r.status === "WARNING" ? "amber" : "red"}>{r.status}</Badge> },
    { key: "raw", header: "Data", render: (r) => <span className="line-clamp-1 max-w-md text-xs text-slate-500">{JSON.stringify(r.raw)}</span> },
    { key: "errors", header: "Catatan", render: (r) => <span className="text-xs text-red-600">{r.errors.join("; ")}</span> },
  ];

  return (
    <Card>
      <CardHeader
        title={`Detail Baris — ${batch.fileName}`}
        subtitle={`${batch.successRows} valid / ${batch.errorRows} bermasalah dari ${batch.totalRows} baris`}
        action={
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
              <option value="">Semua status</option>
              <option value="OK">OK</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </Select>
            <Button variant="ghost" onClick={onClose}>Tutup</Button>
          </div>
        }
      />
      <div className="p-4">
        <DataTable columns={columns} rows={data?.items ?? []} keyFor={(r) => r.id} loading={isLoading} emptyTitle="Tidak ada baris" />
      </div>
    </Card>
  );
}
