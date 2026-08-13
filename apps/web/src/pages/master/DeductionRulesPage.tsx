import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bpToPercentLabel,
  DEDUCTION_RULE_CODES,
  percentToBp,
  type DeductionRule,
  type DeductionRuleInput,
} from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, ErrorBanner, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

const RULE_LABELS: Record<string, string> = {
  PEMBINAAN_DISIPLIN: "Pembinaan/Hukuman Disiplin",
  CUTI_GE_1_BULAN: "Cuti ≥ 1 bulan",
  PERKELAHIAN: "Terlibat Perkelahian (masa pembinaan)",
  DIKLAT_GT_1_BULAN: "Diklat > 1 bulan",
  TUGAS_BELAJAR: "Tugas Belajar (ketidakhadiran ≥3 hari/minggu)",
};

export function DeductionRulesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["deduction-rules"],
    queryFn: () => api.get<{ items: DeductionRule[] }>("/master/deduction-rules"),
  });

  const columns: Column<DeductionRule>[] = [
    { key: "name", header: "Aturan", render: (r) => <span className="font-medium text-slate-800">{RULE_LABELS[r.code] ?? r.name}</span> },
    { key: "percent", header: "Persentase Potongan", render: (r) => <span className="font-semibold text-red-600">-{bpToPercentLabel(r.percentBp)}</span> },
    { key: "effective", header: "Berlaku Sejak", render: (r) => r.effectiveFrom },
    { key: "until", header: "Berlaku Sampai", render: (r) => r.effectiveTo ?? "Sekarang" },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Master Aturan Pengurangan"
        description="Aturan potongan (disiplin, cuti, diklat, tugas belajar) sesuai Pasal 15 Raperbup Remunerasi — bertipe versioned."
        action={hasPermission("master.deduction_rule.write") && <Button onClick={() => setModalOpen(true)}>+ Versi Aturan Baru</Button>}
      />
      <DataTable columns={columns} rows={data?.items ?? []} keyFor={(r) => r.id} loading={isLoading} emptyTitle="Belum ada aturan pengurangan" />
      {modalOpen && (
        <RuleFormModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["deduction-rules"] });
          }}
        />
      )}
    </div>
  );
}

function RuleFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<DeductionRuleInput>({
    code: "CUTI_GE_1_BULAN",
    name: RULE_LABELS.CUTI_GE_1_BULAN!,
    percentBp: 5000,
    description: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
    isActive: true,
  });
  const [percentInput, setPercentInput] = useState("50");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/master/deduction-rules", { ...form, name: RULE_LABELS[form.code] ?? form.code, percentBp: percentToBp(Number(percentInput)) }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title="Tambah Versi Aturan Pengurangan">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {error && <ErrorBanner message={error} />}
        <Field label="Jenis Aturan">
          <Select value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value as DeductionRuleInput["code"] })}>
            {DEDUCTION_RULE_CODES.map((c) => (
              <option key={c} value={c}>
                {RULE_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Persentase Potongan (%)">
          <Input type="number" step="0.01" min="0" max="100" required value={percentInput} onChange={(e) => setPercentInput(e.target.value)} />
        </Field>
        {form.code === "PEMBINAAN_DISIPLIN" && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Persentase pembinaan disiplin bersifat kasuistis sesuai keputusan hukuman disiplin. Nilai di atas hanya default; petugas dapat memberi
            nilai override per pegawai saat impor data kehadiran.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Berlaku Sejak">
            <Input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </Field>
          <Field label="Berlaku Sampai (opsional)">
            <Input type="date" value={form.effectiveTo ?? ""} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value || null })} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan…" : "Simpan Versi Baru"}</Button>
        </div>
      </form>
    </Modal>
  );
}
