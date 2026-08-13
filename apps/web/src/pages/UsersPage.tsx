import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ROLE_CODES, ROLE_LABELS, type Employee, type RoleCode, type WorkUnit } from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, Card, ErrorBanner, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";

interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  employeeId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [tempPasswordNotice, setTempPasswordNotice] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", search],
    queryFn: () => api.get<{ items: ManagedUser[] }>(`/users?search=${encodeURIComponent(search)}`),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => api.post<{ temporaryPassword: string }>(`/users/${userId}/reset-password`),
    onSuccess: (res) => setTempPasswordNotice(res.temporaryPassword),
  });

  const columns: Column<ManagedUser>[] = [
    { key: "name", header: "Nama", render: (r) => <span className="font-medium text-slate-800">{r.fullName}</span> },
    { key: "email", header: "Email", render: (r) => r.email },
    { key: "role", header: "Peran", render: (r) => ROLE_LABELS[r.roleCode] },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge> },
    { key: "lastLogin", header: "Login Terakhir", render: (r) => r.lastLoginAt?.slice(0, 16).replace("T", " ") ?? "Belum pernah" },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-3">
          <button className="text-xs font-medium text-lembang-700 hover:underline" onClick={() => { setEditing(r); setModalOpen(true); }}>
            Ubah
          </button>
          <button className="text-xs font-medium text-amber-700 hover:underline" onClick={() => resetPasswordMutation.mutate(r.id)}>
            Reset Sandi
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Pengguna & Peran" description="Manajemen akun, penetapan peran (RBAC), dan cakupan akses unit kerja." action={<Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ Pengguna</Button>} />
      {tempPasswordNotice && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Kata sandi sementara: <span className="font-mono font-semibold">{tempPasswordNotice}</span> — sampaikan ke pengguna di luar sistem ini.
          <button className="ml-3 underline" onClick={() => setTempPasswordNotice(null)}>
            Tutup
          </button>
        </div>
      )}
      <DataTable columns={columns} rows={data?.items ?? []} keyFor={(r) => r.id} loading={isLoading} search={search} onSearchChange={setSearch} searchPlaceholder="Cari nama/email…" />
      {modalOpen && (
        <UserFormModal
          initial={editing}
          onClose={() => setModalOpen(false)}
          onSaved={(tempPassword) => {
            setModalOpen(false);
            if (tempPassword) setTempPasswordNotice(tempPassword);
            queryClient.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
    </div>
  );
}

function UserFormModal({ initial, onClose, onSaved }: { initial: ManagedUser | null; onClose: () => void; onSaved: (tempPassword?: string) => void }) {
  const [email, setEmail] = useState(initial?.email ?? "");
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [roleCode, setRoleCode] = useState<RoleCode>(initial?.roleCode ?? "PEGAWAI");
  const [employeeId, setEmployeeId] = useState(initial?.employeeId ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [workUnitIds, setWorkUnitIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ["employees", "picker"],
    queryFn: () => api.get<{ items: Employee[] }>("/master/employees?pageSize=500"),
  });
  const { data: workUnits } = useQuery({
    queryKey: ["work-units", "all"],
    queryFn: () => api.get<{ items: WorkUnit[] }>("/master/work-units?pageSize=200"),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      let tempPassword: string | undefined;
      if (initial) {
        await api.put(`/users/${initial.id}`, { fullName, roleCode, employeeId: employeeId || null, isActive });
      } else {
        const res = await api.post<{ temporaryPassword: string }>("/users", { email, fullName, roleCode, employeeId: employeeId || null });
        tempPassword = res.temporaryPassword;
      }
      if (roleCode === "VERIFIKATOR_UNIT" && initial) {
        await api.put(`/users/${initial.id}/work-units`, { workUnitIds });
      }
      return tempPassword;
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });

  return (
    <Modal open onClose={onClose} title={initial ? "Ubah Pengguna" : "Tambah Pengguna"}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {error && <ErrorBanner message={error} />}
        <Field label="Email">
          <Input type="email" required disabled={!!initial} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Nama Lengkap">
          <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Peran">
          <Select value={roleCode} onChange={(e) => setRoleCode(e.target.value as RoleCode)}>
            {ROLE_CODES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        {roleCode === "PEGAWAI" && (
          <Field label="Tautkan ke Data Pegawai" hint="Wajib agar pegawai dapat melihat dashboard transparansi miliknya">
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">-</option>
              {employees?.items.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.nip})
                </option>
              ))}
            </Select>
          </Field>
        )}
        {roleCode === "VERIFIKATOR_UNIT" && initial && (
          <Field label="Cakupan Unit Kerja">
            <Card className="max-h-40 overflow-y-auto p-3">
              {workUnits?.items.map((w) => (
                <label key={w.id} className="flex items-center gap-2 py-1 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={workUnitIds.includes(w.id)}
                    onChange={(e) => setWorkUnitIds(e.target.checked ? [...workUnitIds, w.id] : workUnitIds.filter((id) => id !== w.id))}
                  />
                  {w.name}
                </label>
              ))}
            </Card>
          </Field>
        )}
        {initial && (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Aktif
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </Modal>
  );
}
