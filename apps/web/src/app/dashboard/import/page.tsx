"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { ImportBatchType, UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { ImportBatch, ImportRow, Period } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { formatDateTime } from "@/lib/format";

const TYPE_LABELS: Record<string, string> = {
  SERVICE_TRANSACTION: "Transaksi Layanan (SIMRS)",
  ATTENDANCE: "Kehadiran/Cuti/Diklat",
  PERFORMANCE_SCORE: "Skor Kinerja Bulanan",
  INDEXING_SCORE: "Skor Indeksing Administrasi",
};

function ImportPageContent() {
  const queryClient = useQueryClient();
  const [periodId, setPeriodId] = useState("");
  const [type, setType] = useState<string>(ImportBatchType.SERVICE_TRANSACTION);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  const { data: periods } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => (await apiClient.get<Period[]>("/periods")).data,
  });

  const { data: batches } = useQuery({
    queryKey: ["import-batches", periodId],
    queryFn: async () => (await apiClient.get<ImportBatch[]>(`/import/periods/${periodId}/batches`)).data,
    enabled: !!periodId,
  });

  const { data: invalidRows } = useQuery({
    queryKey: ["import-batch-rows", activeBatchId],
    queryFn: async () =>
      (await apiClient.get<ImportRow[]>(`/import/batches/${activeBatchId}/rows`, { params: { status: "INVALID" } })).data,
    enabled: !!activeBatchId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("file", file!);
      const { data } = await apiClient.post<ImportBatch>(
        `/import/${type}/periods/${periodId}/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return data;
    },
    onSuccess: (batch) => {
      setActiveBatchId(batch.id);
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ["import-batches", periodId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const commitMutation = useMutation({
    mutationFn: async (batchId: string) => apiClient.post(`/import/batches/${batchId}/commit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-batches", periodId] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  async function downloadTemplate() {
    const response = await apiClient.get(`/import/template/${type}`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `template-${type.toLowerCase()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const activeBatch = batches?.find((b) => b.id === activeBatchId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Impor Data SIMRS</h1>
        <p className="text-sm text-gray-500">
          Unggah → validasi → pratinjau → komit. Baris bermasalah tidak menggagalkan seluruh proses.
        </p>
      </div>

      <div className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-3">
        <div>
          <label className="label">Periode</label>
          <select className="input" value={periodId} onChange={(e) => { setPeriodId(e.target.value); setActiveBatchId(null); }}>
            <option value="">Pilih periode…</option>
            {periods?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jenis Data</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.values(ImportBatchType).map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" className="btn-secondary w-full" onClick={downloadTemplate}>
            <Download size={16} /> Unduh Template
          </button>
        </div>
      </div>

      <div className="card p-5">
        <label className="label">Unggah Berkas (.xlsx / .csv)</label>
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input"
          />
          <button
            className="btn-primary shrink-0"
            disabled={!file || !periodId || uploadMutation.isPending}
            onClick={() => {
              setError(null);
              uploadMutation.mutate();
            }}
          >
            <Upload size={16} /> {uploadMutation.isPending ? "Memproses…" : "Unggah & Validasi"}
          </button>
        </div>
        {!periodId && <p className="mt-2 text-xs text-amber-600">Pilih periode terlebih dahulu.</p>}
        {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      </div>

      {activeBatch && (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-gray-800">{activeBatch.fileName}</div>
              <div className="text-sm text-gray-500">
                Total {activeBatch.totalRows} baris • {activeBatch.validRows} valid • {activeBatch.invalidRows} bermasalah
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-gray-100 text-gray-700">{activeBatch.status}</span>
              {activeBatch.status === "VALIDATED" && (
                <button
                  className="btn-primary"
                  disabled={commitMutation.isPending}
                  onClick={() => commitMutation.mutate(activeBatch.id)}
                >
                  {commitMutation.isPending ? "Mengomit…" : "Komit ke Sistem"}
                </button>
              )}
            </div>
          </div>

          {invalidRows && invalidRows.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-red-100">
              <table className="table-base">
                <thead className="bg-red-50">
                  <tr>
                    <th>Baris</th>
                    <th>Data</th>
                    <th>Kesalahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-50">
                  {invalidRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rowNumber}</td>
                      <td className="max-w-md truncate text-xs text-gray-500">{JSON.stringify(row.rawData)}</td>
                      <td className="text-xs text-red-600">{(row.errors ?? []).join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {periodId && (
        <div className="card overflow-x-auto">
          <div className="border-b border-gray-100 px-5 py-3 font-medium text-gray-800">Riwayat Impor Periode Ini</div>
          <table className="table-base">
            <thead className="bg-gray-50">
              <tr>
                <th>Berkas</th>
                <th>Jenis</th>
                <th>Diunggah Oleh</th>
                <th>Waktu</th>
                <th>Status</th>
                <th>Baris</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {batches?.map((b) => (
                <tr
                  key={b.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => setActiveBatchId(b.id)}
                >
                  <td>{b.fileName}</td>
                  <td>{TYPE_LABELS[b.type]}</td>
                  <td>{b.uploadedBy?.username}</td>
                  <td>{formatDateTime(b.createdAt)}</td>
                  <td>
                    <span className="badge bg-gray-100 text-gray-700">{b.status}</span>
                  </td>
                  <td>
                    {b.validRows}/{b.totalRows}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ImportPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL]}>
      <ImportPageContent />
    </RoleGuard>
  );
}
