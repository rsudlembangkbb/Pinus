import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  EMPLOYEE_CATEGORIES,
  EMPLOYMENT_STATUSES,
  type Employee,
  type EmployeeInput,
  type JobGrade,
  type WorkUnit,
} from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, ErrorBanner, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_LABELS: Record<string, string> = {
  MEDIS: "Tenaga Medis",
  KEPERAWATAN: "Keperawatan",
  NAKES_LAIN: "Nakes Non-Keperawatan",
  ADMINISTRASI: "Administrasi",
  STRUKTURAL: "Struktural",
};

export function EmployeesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["employees", search, page],
    queryFn: () => api.get<{ items: Employee[]; total: number; page: number; pageSize: number }>(`/master/employees?search=${encodeURIComponent(search)}&page=${page}`),
  });
  const { data: workUnits } = useQuery({
    queryKey: ["work-units", "all"],
    queryFn: () => api.get<{ items: WorkUnit[] }>("/master/work-units?pageSize=200"),
  });
  const workUnitName = (id: string) => workUnits?.items.find((w) => w.id === id)?.name ?? "-";

  const columns: Column<Employee>[] = [
    { key: "nip", header: "NIP/NIK", render: (r) => <span className="font-mono text-xs">{r.nip}</span> },
    { key: "name", header: "Nama Pegawai", render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
    { key: "category", header: "Kategori", render: (r) => CATEGORY_LABELS[r.category] },
    { key: "unit", header: "Unit Kerja", render: (r) => workUnitName(r.workUnitId) },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge> },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) =>
        hasPermission("master.employee.write") && (
          <button className="text-xs font-medium text-lembang-700 hover:underline" onClick={() => { setEditing(r); setModalOpen(true); }}>
            Ubah
          </button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Master Pegawai"
        description="Data induk pegawai: identitas, kategori tenaga, unit kerja, jabatan, dan job grade."
        action={
          hasPermission("master.employee.write") && (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Pegawai</Button>
          )
        }
      />
      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        keyFor={(r) => r.id}
        loading={isLoading}
        search={search}
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        searchPlaceholder="Cari nama/NIP…"
        total={data?.total}
        page={page}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
      />
      {modalOpen && (
        <EmployeeFormModal
          initial={editing}
          workUnits={workUnits?.items ?? []}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["employees"] });
          }}
        />
      )}
    </div>
  );
}

function EmployeeFormModal({
  initial,
  workUnits,
  onClose,
  onSaved,
}: {
  initial: Employee | null;
  workUnits: WorkUnit[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: jobGrades } = useQuery({
    queryKey: ["job-grades", "all"],
    queryFn: () => api.get<{ items: JobGrade[] }>("/master/job-grades"),
  });

  const [form, setForm] = useState<EmployeeInput>({
    nip: initial?.nip ?? "",
    fullName: initial?.fullName ?? "",
    category: initial?.category ?? "MEDIS",
    profession: initial?.profession ?? "",
    workUnitId: initial?.workUnitId ?? workUnits[0]?.id ?? "",
    positionTitle: initial?.positionTitle ?? "",
    jobGradeId: initial?.jobGradeId ?? null,
    employmentStatus: initial?.employmentStatus ?? "PNS",
    isActive: initial?.isActive ?? true,
    startDate: initial?.startDate ?? new Date().toISOString().slice(0, 10),
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => (initial ? api.put(`/master/employees/${initial.id}`, form) : api.post("/master/employees", form)),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={initial ? "Ubah Pegawai" : "Tambah Pegawai"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        {error && <ErrorBanner message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <Field label="NIP/NIK">
            <Input required value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
          </Field>
          <Field label="Status Kepegawaian">
            <Select value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value as EmployeeInput["employmentStatus"] })}>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Nama Lengkap">
          <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori Tenaga">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as EmployeeInput["category"] })}>
              {EMPLOYEE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Profesi/Spesialisasi" hint="Untuk pencocokan minimum requirement, mis. 'Dokter Spesialis'">
            <Input value={form.profession ?? ""} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit Kerja">
            <Select required value={form.workUnitId} onChange={(e) => setForm({ ...form, workUnitId: e.target.value })}>
              {workUnits.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Job Grade">
            <Select value={form.jobGradeId ?? ""} onChange={(e) => setForm({ ...form, jobGradeId: e.target.value || null })}>
              <option value="">-</option>
              {jobGrades?.items.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jabatan">
            <Input value={form.positionTitle ?? ""} onChange={(e) => setForm({ ...form, positionTitle: e.target.value })} />
          </Field>
          <Field label="Tanggal Mulai Kerja">
            <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </Field>
        </div>
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
