"use client";

import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { EmploymentStatus, MinimumRequirementLevel, StaffCategory, UserRole } from "@pinus/shared";
import { apiClient, apiErrorMessage } from "@/lib/api-client";
import { Employee, JobGrade, WorkUnit } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { Modal } from "@/components/Modal";

const STAFF_CATEGORIES = Object.values(StaffCategory);
const EMPLOYMENT_STATUSES = Object.values(EmploymentStatus);
const MIN_REQ_LEVELS = Object.values(MinimumRequirementLevel);

const emptyForm = {
  nip: "",
  fullName: "",
  staffCategory: StaffCategory.MEDIS as string,
  profession: "",
  workUnitId: "",
  jobGradeId: "",
  position: "",
  employmentStatus: EmploymentStatus.PNS as string,
  startDate: new Date().toISOString().slice(0, 10),
  minimumRequirementLevel: "",
};

function EmployeesPageContent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: workUnits } = useQuery({
    queryKey: ["work-units"],
    queryFn: async () => (await apiClient.get<WorkUnit[]>("/work-units")).data,
  });
  const { data: jobGrades } = useQuery({
    queryKey: ["job-grades"],
    queryFn: async () => (await apiClient.get<JobGrade[]>("/job-grades")).data,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["employees", search],
    queryFn: async () =>
      (await apiClient.get<{ items: Employee[]; total: number }>("/employees", { params: { search, take: 100 } })).data,
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiClient.post("/employees", {
        ...form,
        jobGradeId: form.jobGradeId || undefined,
        profession: form.profession || undefined,
        position: form.position || undefined,
        minimumRequirementLevel: form.minimumRequirementLevel || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setShowForm(false);
      setForm(emptyForm);
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Master Pegawai</h1>
          <p className="text-sm text-gray-500">Data induk pegawai: kategori tenaga, unit kerja, jabatan, job grade.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Tambah Pegawai
        </button>
      </div>

      <div className="relative w-72">
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
        <input
          className="input pl-9"
          placeholder="Cari nama atau NIP…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>NIP</th>
              <th>Nama</th>
              <th>Kategori</th>
              <th>Unit Kerja</th>
              <th>Job Grade</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-gray-400">
                  Memuat…
                </td>
              </tr>
            )}
            {data?.items.map((emp) => (
              <tr key={emp.id}>
                <td className="font-mono">{emp.nip}</td>
                <td>
                  <div className="font-medium">{emp.fullName}</div>
                  <div className="text-xs text-gray-400">{emp.profession}</div>
                </td>
                <td>{emp.staffCategory}</td>
                <td>{emp.workUnit.name}</td>
                <td>{emp.jobGrade?.code ?? "-"}</td>
                <td>
                  <span className={`badge ${emp.isActive ? "bg-pinus-100 text-pinus-700" : "bg-gray-100 text-gray-500"}`}>
                    {emp.isActive ? "Aktif" : "Nonaktif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title="Tambah Pegawai" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">NIP</label>
                <input className="input" required value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
              </div>
              <div>
                <label className="label">Nama Lengkap</label>
                <input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Kategori Tenaga</label>
                <select className="input" value={form.staffCategory} onChange={(e) => setForm({ ...form, staffCategory: e.target.value })}>
                  {STAFF_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Profesi/Spesialisasi</label>
                <input className="input" value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Unit Kerja</label>
                <select className="input" required value={form.workUnitId} onChange={(e) => setForm({ ...form, workUnitId: e.target.value })}>
                  <option value="">Pilih unit…</option>
                  {workUnits?.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Job Grade (opsional)</label>
                <select className="input" value={form.jobGradeId} onChange={(e) => setForm({ ...form, jobGradeId: e.target.value })}>
                  <option value="">-</option>
                  {jobGrades?.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Status Kepegawaian</label>
                <select className="input" value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}>
                  {EMPLOYMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tanggal Mulai Kerja</label>
                <input type="date" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Jabatan (opsional)</label>
                <input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
              </div>
              <div>
                <label className="label">Minimum Requirement (opsional)</label>
                <select className="input" value={form.minimumRequirementLevel} onChange={(e) => setForm({ ...form, minimumRequirementLevel: e.target.value })}>
                  <option value="">-</option>
                  {MIN_REQ_LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" className="btn-primary w-full" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Menyimpan…" : "Simpan"}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL]}>
      <EmployeesPageContent />
    </RoleGuard>
  );
}
