"use client";

import {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, buildApiUrl } from "@/lib/api";
import type {
  AuditLog,
  AuthProfile,
  BootstrapData,
  CalculationResult,
  JobGrade,
  Period,
  PeriodDetail,
  WorkUnit,
} from "@/lib/types";

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN_JASPEL: "Admin Jaspel",
  VERIFIER_UNIT: "Verifikator Unit",
  FINANCE: "Keuangan",
  DIRECTOR: "Direktur",
  EMPLOYEE: "Pegawai",
  AUDITOR: "Auditor",
};

function formatCurrency(value: number | string | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function StatCard(props: { label: string; value: string; helper?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{props.value}</p>
      {props.helper ? <p className="mt-2 text-xs text-slate-500">{props.helper}</p> : null}
    </div>
  );
}

function Section(props: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">{props.title}</h2>
        {props.description ? <p className="mt-1 text-sm text-slate-500">{props.description}</p> : null}
      </div>
      {props.children}
    </section>
  );
}

function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 ${props.className ?? ""}`}
    />
  );
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 ${props.className ?? ""}`}
    />
  );
}

export default function Home() {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapData | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [periodDetail, setPeriodDetail] = useState<PeriodDetail | null>(null);
  const [slips, setSlips] = useState<CalculationResult[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [loginForm, setLoginForm] = useState({ login: "adminjaspel", password: "pinus123" });
  const [workUnitForm, setWorkUnitForm] = useState({ code: "", name: "", serviceType: "" });
  const [jobGradeForm, setJobGradeForm] = useState({ code: "", name: "", weight: "1" });
  const [employeeForm, setEmployeeForm] = useState({
    employeeNumber: "",
    fullName: "",
    category: "MEDICAL",
    employmentStatus: "PNS",
    startDate: "2026-01-01",
    profession: "",
    position: "",
    minimumGuarantee: "",
    workUnitId: "",
    jobGradeId: "",
  });
  const [periodForm, setPeriodForm] = useState({
    month: "8",
    year: "2026",
    budgetCap: "28000000",
    healthcarePool: "8000000",
    administrativePool: "6000000",
  });

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId],
  );

  async function loadProfile() {
    try {
      const current = await apiFetch<AuthProfile>("/auth/me");
      setProfile(current);
      return current;
    } catch {
      setProfile(null);
      return null;
    }
  }

  async function refreshSelectedPeriod(periodId: string) {
    setSelectedPeriodId(periodId);
    const detail = await apiFetch<PeriodDetail>(`/pinus/periods/${periodId}/results`);
    setPeriodDetail(detail);
  }

  async function loadWorkspace(currentProfile: AuthProfile) {
    const [bootstrapData, periodsData] = await Promise.all([
      apiFetch<BootstrapData>("/pinus/bootstrap"),
      apiFetch<Period[]>("/pinus/periods"),
    ]);

    setBootstrap(bootstrapData);
    setPeriods(periodsData);

    const activePeriodId = selectedPeriodId || periodsData[0]?.id || "";
    if (activePeriodId) {
      await refreshSelectedPeriod(activePeriodId);
    } else {
      setPeriodDetail(null);
    }

    if (currentProfile.role === "EMPLOYEE") {
      setSlips(await apiFetch<CalculationResult[]>("/pinus/me/slips"));
    } else {
      setSlips([]);
    }

    if (["SUPER_ADMIN", "ADMIN_JASPEL", "AUDITOR"].includes(currentProfile.role)) {
      setAuditLogs(await apiFetch<AuditLog[]>("/pinus/audit-logs"));
    } else {
      setAuditLogs([]);
    }
  }

  async function initialize() {
    setLoading(true);
    setError("");
    try {
      const current = await loadProfile();
      if (current) {
        await loadWorkspace(current);
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Gagal memuat aplikasi.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const run = async () => {
      await initialize();
    };
    void run();
    // initialize sengaja dipanggil sekali saat mount untuk bootstrap sesi awal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    const timer = window.setInterval(() => {
      void loadWorkspace(profile).catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
    // Polling ringan mengikuti sesi aktif dan periode yang sedang dipilih.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, selectedPeriodId]);

  async function onLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiFetch("/auth/login", { method: "POST", body: loginForm });
      const current = await loadProfile();
      if (current) {
        await loadWorkspace(current);
        setMessage("Login berhasil dan dashboard telah dimuat.");
      }
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Login gagal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setProfile(null);
    setBootstrap(null);
    setPeriods([]);
    setSelectedPeriodId("");
    setPeriodDetail(null);
    setAuditLogs([]);
    setSlips([]);
    setMessage("Sesi berhasil diakhiri.");
  }

  async function submitJson(path: string, body: unknown, successMessage: string) {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(path, { method: "POST", body });
      if (profile) {
        await loadWorkspace(profile);
      }
      setMessage(successMessage);
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Aksi gagal.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitImport() {
    if (!selectedPeriodId || !importFile) {
      setError("Pilih periode dan file impor terlebih dahulu.");
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);

    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await apiFetch(`/pinus/periods/${selectedPeriodId}/import-transactions`, {
        method: "POST",
        body: formData,
        isFormData: true,
      });
      if (profile) {
        await loadWorkspace(profile);
      }
      setImportFile(null);
      setMessage("Impor transaksi berhasil diproses.");
    } catch (currentError) {
      setError(currentError instanceof Error ? currentError.message : "Impor gagal.");
    } finally {
      setSubmitting(false);
    }
  }

  const canManageMaster = ["SUPER_ADMIN", "ADMIN_JASPEL"].includes(profile?.role ?? "");
  const canApproveUnit = profile?.role === "VERIFIER_UNIT" || profile?.role === "SUPER_ADMIN";
  const canApproveFinance = profile?.role === "FINANCE" || profile?.role === "SUPER_ADMIN";
  const canApproveDirector = profile?.role === "DIRECTOR" || profile?.role === "SUPER_ADMIN";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_25%),linear-gradient(180deg,#eff6f3_0%,#f8fafc_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="card overflow-hidden">
          <div className="grid gap-8 bg-gradient-to-r from-teal-800 via-teal-700 to-sky-700 p-8 text-white lg:grid-cols-[1.6fr_1fr]">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-teal-100">PINUS RSUD Lembang</p>
              <h1 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl">
                Sistem pembagian insentif dan jasa pelayanan rumah sakit yang transparan, auditable, dan siap operasional.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-teal-50/90 sm:text-base">
                Fondasi MVP ini dibangun berdasarkan PRD RSUD Lembang: master data, impor SIMRS, kalkulasi proporsional, workflow approval, slip PDF, ekspor Excel, RBAC, audit trail, dan dashboard per peran.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-5 backdrop-blur">
              {profile ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-teal-100">Akun aktif</p>
                    <h2 className="mt-2 text-xl font-semibold">{profile.fullName}</h2>
                    <p className="mt-1 text-sm text-teal-50">
                      {roleLabels[profile.role]} · {profile.username}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/10 p-4 text-sm">
                    <p>Email: {profile.email}</p>
                    <p>Unit: {profile.workUnit?.name ?? "Semua Unit"}</p>
                    <p>Pegawai: {profile.employee?.employeeNumber ?? "-"}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void initialize()}
                      className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-teal-800"
                    >
                      Refresh Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => void onLogout()}
                      className="rounded-xl border border-white/30 px-4 py-3 text-sm font-medium text-white"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={onLogin}>
                  <div>
                    <p className="text-sm text-teal-100">Demo akun seed</p>
                    <h2 className="mt-2 text-xl font-semibold">Masuk ke aplikasi</h2>
                  </div>
                  <Input
                    placeholder="Username atau email"
                    value={loginForm.login}
                    onChange={(event) => setLoginForm((current) => ({ ...current, login: event.target.value }))}
                  />
                  <Input
                    type="password"
                    placeholder="Password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-teal-800"
                  >
                    {submitting ? "Memproses..." : "Login"}
                  </button>
                  <div className="rounded-xl bg-white/10 p-3 text-xs leading-6 text-teal-50">
                    <p>Gunakan `adminjaspel`, `verifikator`, `keuangan`, `direktur`, `pegawai`, atau `auditor`.</p>
                    <p>Password default seluruh akun: `pinus123`</p>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        {message ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {loading ? <div className="card p-8 text-sm text-slate-500">Memuat konteks aplikasi...</div> : null}

        {profile && bootstrap ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Realisasi Terakhir"
                value={formatCurrency(bootstrap.summary.totals.total)}
                helper={bootstrap.summary.latestPeriod?.label ?? "Belum ada periode"}
              />
              <StatCard
                label="Periode Aktif Terpilih"
                value={selectedPeriod?.label ?? "-"}
                helper={selectedPeriod?.status ?? "Belum dipilih"}
              />
              <StatCard label="Jumlah Unit Kerja" value={String(bootstrap.units.length)} helper="Master unit aktif" />
              <StatCard
                label="Slip Pegawai Saya"
                value={bootstrap.summary.myLatest ? formatCurrency(bootstrap.summary.myLatest.finalAmount) : "-"}
                helper={bootstrap.summary.myLatest?.period.label ?? "Tidak tersedia"}
              />
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <Section
                title="Status Periode dan Operasional"
                description="Kelola siklus bulanan mulai dari draft, impor, kalkulasi, verifikasi, hingga publikasi."
              >
                <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                  <Select
                    value={selectedPeriodId}
                    onChange={(event) => {
                      if (event.target.value) void refreshSelectedPeriod(event.target.value);
                    }}
                  >
                    <option value="">Pilih periode</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.label} · {period.status}
                      </option>
                    ))}
                  </Select>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => selectedPeriodId && void refreshSelectedPeriod(selectedPeriodId)}
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                    >
                      Muat Detail
                    </button>
                    <a
                      className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
                      href={selectedPeriodId ? buildApiUrl(`/pinus/periods/${selectedPeriodId}/export.xlsx`) : "#"}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ekspor Excel
                    </a>
                    {canManageMaster ? (
                      <button
                        type="button"
                        onClick={() =>
                          selectedPeriodId &&
                          void submitJson(
                            `/pinus/periods/${selectedPeriodId}/calculate`,
                            {},
                            "Kalkulasi periode berhasil dijalankan.",
                          )
                        }
                        className="btn-primary rounded-xl px-4 py-3 text-sm font-medium"
                      >
                        Jalankan Kalkulasi
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="px-3 py-3">Periode</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Budget</th>
                        <th className="px-3 py-3">Transaksi</th>
                        <th className="px-3 py-3">Hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((period) => (
                        <tr key={period.id} className="border-b border-slate-100 text-slate-700">
                          <td className="px-3 py-3">{period.label}</td>
                          <td className="px-3 py-3">{period.status}</td>
                          <td className="px-3 py-3">{formatCurrency(period.budgetCap)}</td>
                          <td className="px-3 py-3">{period._count?.transactions ?? 0}</td>
                          <td className="px-3 py-3">{period._count?.results ?? 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section
                title="Persetujuan Berjenjang"
                description="Aksi approval mengikuti workflow maker-checker-approver pada PRD."
              >
                <div className="space-y-3">
                  {(periodDetail?.approvals ?? []).map((approval) => (
                    <div key={approval.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">{approval.level}</p>
                          <p className="mt-1 text-xs text-slate-500">{approval.note ?? "Belum ada catatan"}</p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700">
                          {approval.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  {canApproveUnit ? (
                    <button
                      type="button"
                      onClick={() =>
                        selectedPeriodId &&
                        void submitJson(
                          `/pinus/periods/${selectedPeriodId}/approve/UNIT`,
                          { status: "APPROVED", note: "Disetujui verifikator unit" },
                          "Verifikasi unit berhasil disimpan.",
                        )
                      }
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                    >
                      Approve Unit
                    </button>
                  ) : null}
                  {canApproveFinance ? (
                    <button
                      type="button"
                      onClick={() =>
                        selectedPeriodId &&
                        void submitJson(
                          `/pinus/periods/${selectedPeriodId}/approve/FINANCE`,
                          { status: "APPROVED", note: "Sesuai pagu dan alokasi BLUD" },
                          "Verifikasi keuangan berhasil disimpan.",
                        )
                      }
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700"
                    >
                      Approve Keuangan
                    </button>
                  ) : null}
                  {canApproveDirector ? (
                    <button
                      type="button"
                      onClick={() =>
                        selectedPeriodId &&
                        void submitJson(
                          `/pinus/periods/${selectedPeriodId}/approve/DIRECTOR`,
                          { status: "APPROVED", note: "Disetujui direktur" },
                          "Persetujuan direktur berhasil disimpan.",
                        )
                      }
                      className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-medium text-purple-700"
                    >
                      Approve Direktur
                    </button>
                  ) : null}
                </div>
              </Section>
            </div>

            {canManageMaster ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <Section
                  title="Master Data"
                  description="Master pegawai, unit, dan grade menjadi dasar validasi impor serta distribusi hasil."
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-medium text-slate-900">Tambah Unit Kerja</h3>
                      <Input placeholder="Kode" value={workUnitForm.code} onChange={(event) => setWorkUnitForm((current) => ({ ...current, code: event.target.value }))} />
                      <Input placeholder="Nama Unit" value={workUnitForm.name} onChange={(event) => setWorkUnitForm((current) => ({ ...current, name: event.target.value }))} />
                      <Input placeholder="Kategori Layanan" value={workUnitForm.serviceType} onChange={(event) => setWorkUnitForm((current) => ({ ...current, serviceType: event.target.value }))} />
                      <button type="button" className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-medium" onClick={() => void submitJson("/pinus/work-units", workUnitForm, "Unit kerja berhasil ditambahkan.")}>
                        Simpan Unit
                      </button>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-medium text-slate-900">Tambah Job Grade</h3>
                      <Input placeholder="Kode" value={jobGradeForm.code} onChange={(event) => setJobGradeForm((current) => ({ ...current, code: event.target.value }))} />
                      <Input placeholder="Nama Grade" value={jobGradeForm.name} onChange={(event) => setJobGradeForm((current) => ({ ...current, name: event.target.value }))} />
                      <Input type="number" step="0.1" placeholder="Bobot" value={jobGradeForm.weight} onChange={(event) => setJobGradeForm((current) => ({ ...current, weight: event.target.value }))} />
                      <button
                        type="button"
                        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-medium"
                        onClick={() => void submitJson("/pinus/job-grades", { ...jobGradeForm, weight: Number(jobGradeForm.weight) }, "Job grade berhasil ditambahkan.")}
                      >
                        Simpan Grade
                      </button>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-medium text-slate-900">Tambah Pegawai</h3>
                      <Input placeholder="Nomor Pegawai" value={employeeForm.employeeNumber} onChange={(event) => setEmployeeForm((current) => ({ ...current, employeeNumber: event.target.value }))} />
                      <Input placeholder="Nama Pegawai" value={employeeForm.fullName} onChange={(event) => setEmployeeForm((current) => ({ ...current, fullName: event.target.value }))} />
                      <Select value={employeeForm.category} onChange={(event) => setEmployeeForm((current) => ({ ...current, category: event.target.value }))}>
                        <option value="MEDICAL">Tenaga Medis</option>
                        <option value="HEALTHCARE">Tenaga Kesehatan</option>
                        <option value="ADMINISTRATIVE">Administrasi</option>
                        <option value="STRUCTURAL">Struktural</option>
                      </Select>
                      <Select value={employeeForm.workUnitId} onChange={(event) => setEmployeeForm((current) => ({ ...current, workUnitId: event.target.value }))}>
                        <option value="">Pilih Unit</option>
                        {bootstrap.units.map((unit: WorkUnit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}
                          </option>
                        ))}
                      </Select>
                      <Select value={employeeForm.jobGradeId} onChange={(event) => setEmployeeForm((current) => ({ ...current, jobGradeId: event.target.value }))}>
                        <option value="">Pilih Grade</option>
                        {bootstrap.grades.map((grade: JobGrade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </Select>
                      <Input placeholder="Profesi" value={employeeForm.profession} onChange={(event) => setEmployeeForm((current) => ({ ...current, profession: event.target.value }))} />
                      <Input placeholder="Jabatan" value={employeeForm.position} onChange={(event) => setEmployeeForm((current) => ({ ...current, position: event.target.value }))} />
                      <Input type="date" value={employeeForm.startDate} onChange={(event) => setEmployeeForm((current) => ({ ...current, startDate: event.target.value }))} />
                      <Input type="number" placeholder="Minimum Guarantee" value={employeeForm.minimumGuarantee} onChange={(event) => setEmployeeForm((current) => ({ ...current, minimumGuarantee: event.target.value }))} />
                      <button
                        type="button"
                        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-medium"
                        onClick={() =>
                          void submitJson(
                            "/pinus/employees",
                            {
                              ...employeeForm,
                              minimumGuarantee: employeeForm.minimumGuarantee ? Number(employeeForm.minimumGuarantee) : undefined,
                            },
                            "Pegawai berhasil ditambahkan.",
                          )
                        }
                      >
                        Simpan Pegawai
                      </button>
                    </div>
                  </div>
                </Section>

                <Section
                  title="Periode, Impor, dan Kalkulasi"
                  description="Membuka periode baru, mengunggah file transaksi SIMRS, lalu menjalankan kalkulasi."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-medium text-slate-900">Buka Periode Baru</h3>
                      <Input type="number" placeholder="Bulan" value={periodForm.month} onChange={(event) => setPeriodForm((current) => ({ ...current, month: event.target.value }))} />
                      <Input type="number" placeholder="Tahun" value={periodForm.year} onChange={(event) => setPeriodForm((current) => ({ ...current, year: event.target.value }))} />
                      <Input type="number" placeholder="Budget Cap" value={periodForm.budgetCap} onChange={(event) => setPeriodForm((current) => ({ ...current, budgetCap: event.target.value }))} />
                      <Input type="number" placeholder="Healthcare Pool" value={periodForm.healthcarePool} onChange={(event) => setPeriodForm((current) => ({ ...current, healthcarePool: event.target.value }))} />
                      <Input type="number" placeholder="Administrative Pool" value={periodForm.administrativePool} onChange={(event) => setPeriodForm((current) => ({ ...current, administrativePool: event.target.value }))} />
                      <button
                        type="button"
                        className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-medium"
                        onClick={() =>
                          void submitJson(
                            "/pinus/periods",
                            {
                              month: Number(periodForm.month),
                              year: Number(periodForm.year),
                              budgetCap: Number(periodForm.budgetCap),
                              healthcarePool: Number(periodForm.healthcarePool),
                              administrativePool: Number(periodForm.administrativePool),
                            },
                            "Periode baru berhasil dibuat.",
                          )
                        }
                      >
                        Simpan Periode
                      </button>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                      <h3 className="font-medium text-slate-900">Impor File Transaksi SIMRS</h3>
                      <p className="text-sm text-slate-500">
                        Kolom utama: Tanggal Layanan, Kode Unit Kerja, Kode Pegawai Pelaksana, Jenis Layanan/Tindakan, Peran dalam Tindakan, Status Penjaminan, Nilai Tarif/Klaim, Jumlah Pasien/Tindakan.
                      </p>
                      <input
                        type="file"
                        accept=".csv,.xlsx"
                        onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                        className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm"
                      />
                      <button type="button" onClick={() => void submitImport()} className="btn-primary w-full rounded-xl px-4 py-3 text-sm font-medium">
                        Unggah dan Proses
                      </button>
                    </div>
                  </div>
                </Section>
              </div>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <Section
                title="Rincian Hasil Kalkulasi"
                description="Distribusi gross, potongan, penyesuaian pagu, dan final amount per pegawai."
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="px-3 py-3">Pegawai</th>
                        <th className="px-3 py-3">Unit</th>
                        <th className="px-3 py-3">Gross</th>
                        <th className="px-3 py-3">Potongan</th>
                        <th className="px-3 py-3">Penyesuaian</th>
                        <th className="px-3 py-3">Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(periodDetail?.results ?? []).map((result) => (
                        <tr key={result.id} className="border-b border-slate-100 text-slate-700">
                          <td className="px-3 py-3">
                            <div className="font-medium">{result.employee.fullName}</div>
                            <div className="text-xs text-slate-500">{result.employee.employeeNumber}</div>
                          </td>
                          <td className="px-3 py-3">{result.workUnit.name}</td>
                          <td className="px-3 py-3">{formatCurrency(result.grossAmount)}</td>
                          <td className="px-3 py-3">{formatCurrency(result.deductionAmount)}</td>
                          <td className="px-3 py-3">{formatCurrency(result.adjustmentAmount)}</td>
                          <td className="px-3 py-3 font-semibold text-slate-900">{formatCurrency(result.finalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section
                title="Self-Service Pegawai"
                description="Pegawai hanya melihat data pribadinya dan dapat mengunduh slip PDF."
              >
                {slips.length ? (
                  <div className="space-y-3">
                    {slips.map((slip) => (
                      <div key={slip.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-slate-500">{slip.employee.fullName}</p>
                            <h3 className="mt-1 font-semibold text-slate-900">{formatCurrency(slip.finalAmount)}</h3>
                            <p className="mt-1 text-xs text-slate-500">{slip.workUnit.name}</p>
                          </div>
                          {profile.role === "EMPLOYEE" ? (
                            <a
                              href={buildApiUrl(`/pinus/me/slips/${slip.periodId}/pdf`)}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700"
                            >
                              Slip PDF
                            </a>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Login sebagai akun `pegawai` untuk melihat dashboard transparansi individual.
                  </div>
                )}
              </Section>
            </div>

            {auditLogs.length ? (
              <Section
                title="Audit Trail"
                description="Menelusuri perubahan master data, proses impor, kalkulasi, dan approval."
              >
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-500">
                        <th className="px-3 py-3">Waktu</th>
                        <th className="px-3 py-3">Aktor</th>
                        <th className="px-3 py-3">Aksi</th>
                        <th className="px-3 py-3">Entitas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100">
                          <td className="px-3 py-3">{new Date(log.createdAt).toLocaleString("id-ID")}</td>
                          <td className="px-3 py-3">{log.actor?.fullName ?? "System"}</td>
                          <td className="px-3 py-3">{log.action}</td>
                          <td className="px-3 py-3">{log.entityType} · {log.entityId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
