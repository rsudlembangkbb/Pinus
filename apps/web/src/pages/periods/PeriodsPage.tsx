import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatRupiah, PERIOD_STATUS_LABELS, type CalculationPeriod, type CreatePeriodInput } from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, ErrorBanner, Field, Input, Modal, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "blue"> = {
  DRAFT: "slate",
  DIPROSES: "blue",
  MENUNGGU_VERIFIKASI_UNIT: "amber",
  MENUNGGU_VERIFIKASI_KEUANGAN: "amber",
  MENUNGGU_PERSETUJUAN_DIREKTUR: "amber",
  FINAL: "green",
  DIBATALKAN: "slate",
};

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function PeriodsPage() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["periods"],
    queryFn: () => api.get<{ items: CalculationPeriod[] }>("/workflow/periods?pageSize=100"),
  });

  const columns: Column<CalculationPeriod>[] = [
    { key: "label", header: "Periode", render: (r) => <span className="font-medium text-slate-800">{r.label}</span> },
    { key: "status", header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{PERIOD_STATUS_LABELS[r.status as keyof typeof PERIOD_STATUS_LABELS]}</Badge> },
    { key: "pagu", header: "Pagu", render: (r) => (r.paguAmount != null ? formatRupiah(r.paguAmount) : "-") },
    { key: "calculated", header: "Terakhir Dikalkulasi", render: (r) => r.calculatedAt?.slice(0, 16).replace("T", " ") ?? "-" },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <button className="text-xs font-medium text-lembang-700 hover:underline" onClick={() => navigate(`/periods/${r.id}`)}>
          Buka →
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Periode & Kalkulasi Jaspel"
        description="Siklus bulanan: buka periode → impor data → kalkulasi → verifikasi berjenjang → final & publikasi."
        action={hasPermission("workflow.manage_period") && <Button onClick={() => setModalOpen(true)}>+ Buka Periode Baru</Button>}
      />
      <DataTable columns={columns} rows={data?.items ?? []} keyFor={(r) => r.id} loading={isLoading} emptyTitle="Belum ada periode" />
      {modalOpen && (
        <CreatePeriodModal
          onClose={() => setModalOpen(false)}
          onSaved={(period) => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["periods"] });
            navigate(`/periods/${period.id}`);
          }}
        />
      )}
    </div>
  );
}

function CreatePeriodModal({ onClose, onSaved }: { onClose: () => void; onSaved: (period: CalculationPeriod) => void }) {
  const now = new Date();
  const [form, setForm] = useState<CreatePeriodInput>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    paguAmount: null,
    administrasiAllocationAmount: null,
    exemptMinimumFromAdjustment: false,
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post<CalculationPeriod>("/workflow/periods", form),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal membuka periode"),
  });

  return (
    <Modal open onClose={onClose} title="Buka Periode Perhitungan Baru">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {error && <ErrorBanner message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bulan">
            <select
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={form.month}
              onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tahun">
            <Input type="number" required value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Pagu Insentif Kinerja (Rp)" hint="Kosongkan bila belum ada batas pagu untuk periode ini">
          <Input type="number" min="0" value={form.paguAmount ?? ""} onChange={(e) => setForm({ ...form, paguAmount: e.target.value ? Number(e.target.value) : null })} />
        </Field>
        <Field label="Alokasi Insentif Tenaga Administrasi (Rp)" hint="Dasar pembagian indeksing untuk kategori Administrasi/Struktural">
          <Input
            type="number"
            min="0"
            value={form.administrasiAllocationAmount ?? ""}
            onChange={(e) => setForm({ ...form, administrasiAllocationAmount: e.target.value ? Number(e.target.value) : null })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.exemptMinimumFromAdjustment}
            onChange={(e) => setForm({ ...form, exemptMinimumFromAdjustment: e.target.checked })}
          />
          Kecualikan penerima minimum requirement dari penyesuaian proporsional atas pagu
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Membuka…" : "Buka Periode"}</Button>
        </div>
      </form>
    </Modal>
  );
}
