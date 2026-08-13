import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bpToPercentLabel,
  PENJAMINAN_STATUSES,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_LABELS,
  SERVICE_ROLES,
  percentToBp,
  type ProportionScheme,
  type ProportionSchemeInput,
} from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, ErrorBanner, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

export function ProportionSchemesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["proportion-schemes"],
    queryFn: () => api.get<{ items: ProportionScheme[] }>("/master/proportion-schemes"),
  });

  const columns: Column<ProportionScheme>[] = [
    { key: "category", header: "Unit Layanan", render: (r) => SERVICE_CATEGORY_LABELS[r.serviceCategory] },
    { key: "penjaminan", header: "Penjaminan", render: (r) => <Badge tone={r.penjaminanStatus === "JKN" ? "blue" : "amber"}>{r.penjaminanStatus}</Badge> },
    { key: "role", header: "Peran", render: (r) => r.serviceRole ?? "Semua Peran" },
    { key: "percent", header: "Proporsi", render: (r) => <span className="font-semibold text-slate-800">{bpToPercentLabel(r.percentBp)}</span> },
    { key: "effective", header: "Berlaku Sejak", render: (r) => r.effectiveFrom },
    { key: "until", header: "Berlaku Sampai", render: (r) => r.effectiveTo ?? "Sekarang" },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Master Skema Proporsi"
        description="Persentase proporsi Jaspel per unit layanan, status penjaminan, dan peran — bertipe versioned agar perubahan kebijakan tidak menimpa data historis."
        action={hasPermission("master.proportion_scheme.write") && <Button onClick={() => setModalOpen(true)}>+ Versi Skema Baru</Button>}
      />
      <DataTable columns={columns} rows={data?.items ?? []} keyFor={(r) => r.id} loading={isLoading} emptyTitle="Belum ada skema proporsi" />
      {modalOpen && (
        <SchemeFormModal
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["proportion-schemes"] });
          }}
        />
      )}
    </div>
  );
}

function SchemeFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<ProportionSchemeInput>({
    serviceCategory: "RAWAT_INAP",
    penjaminanStatus: "JKN",
    serviceRole: null,
    percentBp: 1000,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
    notes: "",
  });
  const [percentInput, setPercentInput] = useState("10");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.post("/master/proportion-schemes", { ...form, percentBp: percentToBp(Number(percentInput)) }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  const isIbs = form.serviceCategory === "IBS";

  return (
    <Modal open onClose={onClose} title="Tambah Versi Skema Proporsi">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {error && <ErrorBanner message={error} />}
        <Field label="Unit Layanan">
          <Select value={form.serviceCategory} onChange={(e) => setForm({ ...form, serviceCategory: e.target.value as ProportionSchemeInput["serviceCategory"] })}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SERVICE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status Penjaminan">
            <Select value={form.penjaminanStatus} onChange={(e) => setForm({ ...form, penjaminanStatus: e.target.value as ProportionSchemeInput["penjaminanStatus"] })}>
              {PENJAMINAN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Peran" hint={isIbs ? "IBS wajib memilih peran spesifik" : "Kosongkan untuk berlaku ke semua peran"}>
            <Select value={form.serviceRole ?? ""} onChange={(e) => setForm({ ...form, serviceRole: (e.target.value || null) as ProportionSchemeInput["serviceRole"] })}>
              <option value="">Semua Peran</option>
              {SERVICE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Persentase Proporsi (%)" hint="Acuan nasional Kepdirjen Yankes No. HK.02.02/D/286/2025 -- sesuaikan dengan Keputusan Bupati/Direktur RSUD Lembang">
          <Input type="number" step="0.01" min="0" max="100" required value={percentInput} onChange={(e) => setPercentInput(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Berlaku Sejak">
            <Input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          </Field>
          <Field label="Berlaku Sampai (opsional)">
            <Input type="date" value={form.effectiveTo ?? ""} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value || null })} />
          </Field>
        </div>
        <Field label="Catatan">
          <Input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Rujukan regulasi/keputusan" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan…" : "Simpan Versi Baru"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
