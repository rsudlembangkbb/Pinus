import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  bpToPercentLabel,
  INDEXING_VARIABLES,
  INDEXING_VARIABLE_LABELS,
  percentToBp,
  type IndexingWeight,
  type IndexingWeightInput,
  type JobGrade,
  type JobGradeInput,
  type MinimumRequirementInput,
} from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Button, Card, CardHeader, ErrorBanner, Field, Input, Modal, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

interface MinimumRequirement {
  id: string;
  professionKey: string;
  label: string;
  minAmount: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export function JobGradesPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [minReqModalOpen, setMinReqModalOpen] = useState(false);

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["job-grades"],
    queryFn: () => api.get<{ items: JobGrade[] }>("/master/job-grades"),
  });
  const { data: weights, isLoading: weightsLoading } = useQuery({
    queryKey: ["indexing-weights"],
    queryFn: () => api.get<{ items: IndexingWeight[] }>("/master/indexing-weights"),
  });
  const { data: minReqs, isLoading: minReqsLoading } = useQuery({
    queryKey: ["minimum-requirements"],
    queryFn: () => api.get<{ items: MinimumRequirement[] }>("/master/minimum-requirements"),
  });

  const gradeColumns: Column<JobGrade>[] = [
    { key: "code", header: "Kode", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
    { key: "name", header: "Nama Job Grade", render: (r) => r.name },
    { key: "weight", header: "Bobot", render: (r) => bpToPercentLabel(r.weightBp) },
    { key: "status", header: "Status", render: (r) => <Badge tone={r.isActive ? "green" : "slate"}>{r.isActive ? "Aktif" : "Nonaktif"}</Badge> },
  ];

  const weightColumns: Column<IndexingWeight>[] = [
    { key: "variable", header: "Variabel", render: (r) => INDEXING_VARIABLE_LABELS[r.variable] },
    { key: "weight", header: "Bobot", render: (r) => bpToPercentLabel(r.weightBp) },
    { key: "maxScore", header: "Skor Maksimum", render: (r) => r.maxScore },
    { key: "effective", header: "Berlaku Sejak", render: (r) => r.effectiveFrom },
  ];

  const minReqColumns: Column<MinimumRequirement>[] = [
    { key: "profession", header: "Profesi", render: (r) => r.label },
    { key: "amount", header: "Nominal Minimum", render: (r) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(r.minAmount) },
    { key: "effective", header: "Berlaku Sejak", render: (r) => r.effectiveFrom },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Job Grade, Bobot Indeksing & Minimum Requirement" description="Parameter pembagian tim kerja unit dan indeksing tenaga administrasi/struktural." />

      <Card>
        <CardHeader
          title="Job Grade (Tim Kerja Unit)"
          subtitle="Bobot job grade menentukan proporsi distribusi pool unit kerja untuk tenaga kesehatan."
          action={hasPermission("master.job_grade.write") && <Button onClick={() => setGradeModalOpen(true)}>+ Job Grade</Button>}
        />
        <div className="p-4">
          <DataTable columns={gradeColumns} rows={grades?.items ?? []} keyFor={(r) => r.id} loading={gradesLoading} emptyTitle="Belum ada job grade" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Bobot Indeksing (Administrasi/Struktural)"
          subtitle="Total bobot idealnya 100%. Variabel Capaian Kinerja otomatis dihitung dari kehadiran 40% + kualitas kerja 60%."
          action={hasPermission("master.job_grade.write") && <Button onClick={() => setWeightModalOpen(true)}>+ Bobot Variabel</Button>}
        />
        <div className="p-4">
          <DataTable columns={weightColumns} rows={weights?.items ?? []} keyFor={(r) => r.id} loading={weightsLoading} emptyTitle="Belum ada bobot indeksing" />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Minimum Requirement"
          subtitle="Jaminan pendapatan minimum untuk profesi tertentu (dokter sub-spesialis, spesialis, umum, perawat mahir, dsb.)"
          action={hasPermission("master.deduction_rule.write") && <Button onClick={() => setMinReqModalOpen(true)}>+ Minimum Requirement</Button>}
        />
        <div className="p-4">
          <DataTable columns={minReqColumns} rows={minReqs?.items ?? []} keyFor={(r) => r.id} loading={minReqsLoading} emptyTitle="Belum ada ketentuan minimum requirement" />
        </div>
      </Card>

      {gradeModalOpen && (
        <JobGradeFormModal onClose={() => setGradeModalOpen(false)} onSaved={() => { setGradeModalOpen(false); queryClient.invalidateQueries({ queryKey: ["job-grades"] }); }} />
      )}
      {weightModalOpen && (
        <IndexingWeightFormModal onClose={() => setWeightModalOpen(false)} onSaved={() => { setWeightModalOpen(false); queryClient.invalidateQueries({ queryKey: ["indexing-weights"] }); }} />
      )}
      {minReqModalOpen && (
        <MinimumRequirementFormModal onClose={() => setMinReqModalOpen(false)} onSaved={() => { setMinReqModalOpen(false); queryClient.invalidateQueries({ queryKey: ["minimum-requirements"] }); }} />
      )}
    </div>
  );
}

function JobGradeFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<JobGradeInput>({ code: "", name: "", weightBp: 10000, description: "", isActive: true });
  const [percentInput, setPercentInput] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post("/master/job-grades", { ...form, weightBp: percentToBp(Number(percentInput)) }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });
  return (
    <Modal open onClose={onClose} title="Tambah Job Grade">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {error && <ErrorBanner message={error} />}
        <Field label="Kode">
          <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </Field>
        <Field label="Nama">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Bobot (%)" hint="Bobot relatif terhadap job grade lain saat distribusi pool unit">
          <Input type="number" step="0.01" min="0" required value={percentInput} onChange={(e) => setPercentInput(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function IndexingWeightFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<IndexingWeightInput>({
    variable: "PENGALAMAN_MASA_KERJA",
    weightBp: 1000,
    maxScore: 100,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
  });
  const [percentInput, setPercentInput] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post("/master/indexing-weights", { ...form, weightBp: percentToBp(Number(percentInput)) }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });
  return (
    <Modal open onClose={onClose} title="Tambah Bobot Indeksing">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {error && <ErrorBanner message={error} />}
        <Field label="Variabel">
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.variable}
            onChange={(e) => setForm({ ...form, variable: e.target.value as IndexingWeightInput["variable"] })}
          >
            {INDEXING_VARIABLES.map((v) => (
              <option key={v} value={v}>
                {INDEXING_VARIABLE_LABELS[v]}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bobot (%)">
            <Input type="number" step="0.01" min="0" max="100" required value={percentInput} onChange={(e) => setPercentInput(e.target.value)} />
          </Field>
          <Field label="Skor Maksimum">
            <Input type="number" min="1" required value={form.maxScore} onChange={(e) => setForm({ ...form, maxScore: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Berlaku Sejak">
          <Input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </Modal>
  );
}

function MinimumRequirementFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<MinimumRequirementInput>({
    professionKey: "",
    label: "",
    minAmount: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: null,
  });
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.post("/master/minimum-requirements", form),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Gagal menyimpan"),
  });
  return (
    <Modal open onClose={onClose} title="Tambah Minimum Requirement">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        {error && <ErrorBanner message={error} />}
        <Field label="Kunci Profesi" hint="Harus sama persis dengan isian 'Profesi/Spesialisasi' di Master Pegawai (tidak case-sensitive)">
          <Input required value={form.professionKey} onChange={(e) => setForm({ ...form, professionKey: e.target.value })} placeholder="mis. Dokter Spesialis" />
        </Field>
        <Field label="Label Tampilan">
          <Input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="mis. Dokter Spesialis" />
        </Field>
        <Field label="Nominal Minimum (Rp)">
          <Input type="number" min="0" required value={form.minAmount} onChange={(e) => setForm({ ...form, minAmount: Number(e.target.value) })} />
        </Field>
        <Field label="Berlaku Sejak">
          <Input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </Modal>
  );
}
