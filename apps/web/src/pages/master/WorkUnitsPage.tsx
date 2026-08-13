import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SERVICE_CATEGORIES, SERVICE_CATEGORY_LABELS, type WorkUnit, type WorkUnitInput } from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, ErrorBanner, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

export function WorkUnitsPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkUnit | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["work-units", search],
    queryFn: () => api.get<{ items: WorkUnit[] }>(`/master/work-units?search=${encodeURIComponent(search)}&pageSize=100`),
  });

  const columns: Column<WorkUnit>[] = [
    { key: "code", header: "Kode", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Nama Unit Kerja", render: (r) => <span className="font-medium text-slate-800">{r.name}</span> },
    { key: "category", header: "Kategori Layanan", render: (r) => SERVICE_CATEGORY_LABELS[r.serviceCategory] },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) =>
        hasPermission("master.work_unit.write") && (
          <button className="text-xs font-medium text-lembang-700 hover:underline" onClick={() => { setEditing(r); setModalOpen(true); }}>
            Ubah
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Master Unit Kerja / Instalasi"
        description="Unit kerja beserta kategori layanan yang menjadi acuan skema proporsi."
        action={
          hasPermission("master.work_unit.write") && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Unit Kerja</Button>
          )
        }
      />
      <DataTable columns={columns} rows={data?.items ?? []} keyFor={(r) => r.id} loading={isLoading} search={search} onSearchChange={setSearch} searchPlaceholder="Cari nama/kode unit…" />
      {modalOpen && (
        <WorkUnitFormModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["work-units"] });
          }}
        />
      )}
    </div>
  );
}

function WorkUnitFormModal({ initial, onClose, onSaved }: { initial: WorkUnit | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<WorkUnitInput>({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    serviceCategory: initial?.serviceCategory ?? "RAWAT_JALAN",
    isActive: initial?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => (initial ? api.put(`/master/work-units/${initial.id}`, form) : api.post("/master/work-units", form)),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={initial ? "Ubah Unit Kerja" : "Tambah Unit Kerja"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {error && <ErrorBanner message={error} />}
        <Field label="Kode Unit">
          <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="mis. RI-01" />
        </Field>
        <Field label="Nama Unit Kerja">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Kategori Layanan">
          <Select value={form.serviceCategory} onChange={(e) => setForm({ ...form, serviceCategory: e.target.value as WorkUnitInput["serviceCategory"] })}>
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {SERVICE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
          Aktif
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
