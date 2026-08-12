import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function hash(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  console.log("Seeding PINUS demo data...");

  // --- Work units ---------------------------------------------------------
  const unitDefs = [
    { code: "IGD", name: "Instalasi Gawat Darurat", serviceCategory: "igd" },
    { code: "RANAP", name: "Rawat Inap", serviceCategory: "rawat_inap" },
    { code: "RAJAL", name: "Rawat Jalan", serviceCategory: "rawat_jalan" },
    { code: "IBS", name: "Instalasi Bedah Sentral", serviceCategory: "ibs" },
    { code: "RADIO", name: "Radiologi", serviceCategory: "radiologi" },
    { code: "LAB", name: "Laboratorium Patologi Klinik", serviceCategory: "laboratorium" },
    { code: "TU", name: "Tata Usaha", serviceCategory: "administrasi" },
  ];
  const units: Record<string, { id: string }> = {};
  for (const u of unitDefs) {
    units[u.code] = await prisma.workUnit.upsert({
      where: { code: u.code },
      update: {},
      create: u,
    });
  }

  // --- Job grades (tenaga kesehatan tim unit) -----------------------------
  const gradeDefs = [
    { code: "JG-1", name: "Job Grade 1 - Perawat Pelaksana", weightScore: 1.0 },
    { code: "JG-2", name: "Job Grade 2 - Perawat Mahir", weightScore: 1.25 },
    { code: "JG-3", name: "Job Grade 3 - Perawat Penyelia", weightScore: 1.5 },
  ];
  const grades: Record<string, { id: string }> = {};
  for (const g of gradeDefs) {
    grades[g.code] = await prisma.jobGrade.upsert({ where: { code: g.code }, update: {}, create: g });
  }

  // --- Proportion schemes (PRD §9.1 reference ranges — mid-range picked) --
  const effectiveFrom = new Date("2026-01-01");
  const schemeDefs: { workUnit: string; guaranteeStatus: "JKN" | "NON_JKN"; serviceRole: string; percentage: number }[] = [
    { workUnit: "RANAP", guaranteeStatus: "JKN", serviceRole: "DPJP", percentage: 12 },
    { workUnit: "RANAP", guaranteeStatus: "JKN", serviceRole: "PELAKSANA", percentage: 8 },
    { workUnit: "RANAP", guaranteeStatus: "NON_JKN", serviceRole: "DPJP", percentage: 60 },
    { workUnit: "RANAP", guaranteeStatus: "NON_JKN", serviceRole: "PELAKSANA", percentage: 15 },
    { workUnit: "RAJAL", guaranteeStatus: "JKN", serviceRole: "DPJP", percentage: 17 },
    { workUnit: "RAJAL", guaranteeStatus: "NON_JKN", serviceRole: "DPJP", percentage: 60 },
    { workUnit: "IGD", guaranteeStatus: "JKN", serviceRole: "DPJP", percentage: 12 },
    { workUnit: "IGD", guaranteeStatus: "NON_JKN", serviceRole: "DPJP", percentage: 60 },
    { workUnit: "IBS", guaranteeStatus: "JKN", serviceRole: "OPERATOR", percentage: 12 },
    { workUnit: "IBS", guaranteeStatus: "JKN", serviceRole: "CO_OPERATOR", percentage: 6 },
    { workUnit: "IBS", guaranteeStatus: "JKN", serviceRole: "ANESTESI", percentage: 4.5 },
    { workUnit: "IBS", guaranteeStatus: "NON_JKN", serviceRole: "OPERATOR", percentage: 25 },
    { workUnit: "IBS", guaranteeStatus: "NON_JKN", serviceRole: "CO_OPERATOR", percentage: 6.5 },
    { workUnit: "IBS", guaranteeStatus: "NON_JKN", serviceRole: "ANESTESI", percentage: 10.5 },
    { workUnit: "RADIO", guaranteeStatus: "JKN", serviceRole: "DPJP", percentage: 7.5 },
    { workUnit: "RADIO", guaranteeStatus: "NON_JKN", serviceRole: "DPJP", percentage: 12.5 },
    { workUnit: "LAB", guaranteeStatus: "JKN", serviceRole: "DPJP", percentage: 3 },
    { workUnit: "LAB", guaranteeStatus: "NON_JKN", serviceRole: "DPJP", percentage: 6.5 },
  ];
  for (const s of schemeDefs) {
    const existing = await prisma.proportionScheme.findFirst({
      where: {
        workUnitId: units[s.workUnit].id,
        guaranteeStatus: s.guaranteeStatus,
        serviceRole: s.serviceRole as never,
        effectiveTo: null,
      },
    });
    if (!existing) {
      await prisma.proportionScheme.create({
        data: {
          workUnitId: units[s.workUnit].id,
          guaranteeStatus: s.guaranteeStatus,
          serviceRole: s.serviceRole as never,
          percentage: s.percentage,
          effectiveFrom,
          notes: "Nilai contoh — rentang acuan nasional Kepdirjen Yankes 2025, belum final untuk RSUD Lembang",
        },
      });
    }
  }

  // --- Indexing weights (tenaga administrasi/struktural, PRD §9.3) -------
  const weightDefs = [
    { variableCode: "EXPERIENCE", variableLabel: "Pengalaman & Masa Kerja", weightPercent: 15 },
    { variableCode: "SKILL", variableLabel: "Keterampilan/Ilmu Pengetahuan/Perilaku", weightPercent: 15 },
    { variableCode: "RISK", variableLabel: "Risiko Kerja", weightPercent: 10 },
    { variableCode: "URGENCY", variableLabel: "Tingkat Kegawatdaruratan", weightPercent: 10 },
    { variableCode: "POSITION", variableLabel: "Jabatan yang Disandang", weightPercent: 20 },
    { variableCode: "PERFORMANCE", variableLabel: "Capaian Kinerja (Kehadiran 40% + Kualitas 60%)", weightPercent: 30 },
  ];
  for (const w of weightDefs) {
    const existing = await prisma.indexingWeight.findFirst({
      where: { variableCode: w.variableCode, effectiveTo: null },
    });
    if (!existing) {
      await prisma.indexingWeight.create({ data: { ...w, effectiveFrom } });
    }
  }

  // --- Deduction rules (PRD §9.5) -----------------------------------------
  const deductionDefs = [
    { trigger: "DISCIPLINARY_ACTION", description: "Menjalani pembinaan/hukuman disiplin", percentage: 50 },
    { trigger: "LEAVE_GE_1_MONTH", description: "Cuti (melahirkan/sakit/besar/haji/lainnya) >= 1 bulan", percentage: 50 },
    { trigger: "FIGHT_DURING_COACHING", description: "Terlibat perkelahian selama masa pembinaan", percentage: 50 },
    { trigger: "TRAINING_GT_1_MONTH", description: "Mengikuti diklat > 1 bulan", percentage: 50 },
    { trigger: "STUDY_ASSIGNMENT_ABSENCE", description: "Tugas belajar dengan ketidakhadiran >= 3 hari/minggu", percentage: 80 },
  ];
  for (const d of deductionDefs) {
    const existing = await prisma.deductionRule.findFirst({ where: { trigger: d.trigger as never, effectiveTo: null } });
    if (!existing) {
      await prisma.deductionRule.create({ data: { ...d, trigger: d.trigger as never, effectiveFrom } });
    }
  }

  // --- Minimum requirements (PRD §9.4) ------------------------------------
  const minReqDefs = [
    { level: "DOKTER_SUBSPESIALIS", minimumAmount: 25_000_000 },
    { level: "DOKTER_SPESIALIS", minimumAmount: 18_000_000 },
    { level: "DOKTER_UMUM", minimumAmount: 9_000_000 },
    { level: "PERAWAT_MAHIR", minimumAmount: 4_000_000 },
  ];
  for (const m of minReqDefs) {
    const existing = await prisma.minimumRequirement.findFirst({ where: { level: m.level as never, effectiveTo: null } });
    if (!existing) {
      await prisma.minimumRequirement.create({ data: { ...m, level: m.level as never, effectiveFrom } });
    }
  }

  // --- Employees ------------------------------------------------------------
  const employeeDefs = [
    { nip: "197001012000011001", fullName: "dr. Andi Wijaya, Sp.B", staffCategory: "MEDIS", profession: "Dokter Spesialis Bedah", workUnit: "IBS", employmentStatus: "PNS", minimumRequirementLevel: "DOKTER_SPESIALIS" },
    { nip: "198002022005012002", fullName: "dr. Budi Santoso", staffCategory: "MEDIS", profession: "Dokter Umum", workUnit: "IGD", employmentStatus: "PNS", minimumRequirementLevel: "DOKTER_UMUM" },
    { nip: "198503032010012003", fullName: "dr. Citra Lestari, Sp.An", staffCategory: "MEDIS", profession: "Dokter Spesialis Anestesi", workUnit: "IBS", employmentStatus: "PNS", minimumRequirementLevel: "DOKTER_SPESIALIS" },
    { nip: "199001042015012004", fullName: "Dewi Anggraini, A.Md.Kep", staffCategory: "KEPERAWATAN", profession: "Perawat Mahir", workUnit: "RANAP", employmentStatus: "PPPK", jobGrade: "JG-2", minimumRequirementLevel: "PERAWAT_MAHIR" },
    { nip: "199105052016012005", fullName: "Eka Putra, S.Kep., Ns.", staffCategory: "KEPERAWATAN", profession: "Perawat Pelaksana", workUnit: "RANAP", employmentStatus: "PPPK", jobGrade: "JG-1" },
    { nip: "198706062012012006", fullName: "Fitriani, A.Md.Rad", staffCategory: "NAKES_LAIN", profession: "Radiografer", workUnit: "RADIO", employmentStatus: "PNS", jobGrade: "JG-1" },
    { nip: "198807072013012007", fullName: "Gunawan, A.Md.AK", staffCategory: "NAKES_LAIN", profession: "Analis Kesehatan", workUnit: "LAB", employmentStatus: "PNS", jobGrade: "JG-2" },
    { nip: "198408082011012008", fullName: "Hesti Rahmawati, S.E.", staffCategory: "ADMINISTRASI", profession: "Staf Keuangan", workUnit: "TU", employmentStatus: "PNS", position: "Bendahara Pengeluaran" },
    { nip: "197909092009012009", fullName: "Indra Kusuma, S.Kom.", staffCategory: "STRUKTURAL", profession: "Kepala Sub Bagian IT", workUnit: "TU", employmentStatus: "PNS", position: "Kasubag SIM RS" },
  ];
  const employees: Record<string, { id: string }> = {};
  for (const e of employeeDefs) {
    employees[e.nip] = await prisma.employee.upsert({
      where: { nip: e.nip },
      update: {},
      create: {
        nip: e.nip,
        fullName: e.fullName,
        staffCategory: e.staffCategory as never,
        profession: e.profession,
        workUnitId: units[e.workUnit].id,
        jobGradeId: e.jobGrade ? grades[e.jobGrade].id : undefined,
        position: e.position,
        employmentStatus: e.employmentStatus as never,
        startDate: new Date("2020-01-01"),
        minimumRequirementLevel: (e.minimumRequirementLevel as never) ?? undefined,
      },
    });
  }

  // --- Users (one per role, plus a login per seeded employee) -------------
  const userDefs = [
    { email: process.env.SEED_ADMIN_EMAIL ?? "admin@rsudlembang.go.id", username: "superadmin", role: "SUPER_ADMIN", password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!" },
    { email: "adminjaspel@rsudlembang.go.id", username: "adminjaspel", role: "ADMIN_JASPEL", password: "AdminJaspel123!" },
    { email: "keuangan@rsudlembang.go.id", username: "keuangan", role: "KEUANGAN", password: "Keuangan123!" },
    { email: "direktur@rsudlembang.go.id", username: "direktur", role: "DIREKTUR", password: "Direktur123!" },
    { email: "auditor@rsudlembang.go.id", username: "auditor", role: "AUDITOR", password: "Auditor123!" },
    { email: "verifikator.ranap@rsudlembang.go.id", username: "verif.ranap", role: "VERIFIKATOR_UNIT", password: "Verifikator123!", employeeNip: "199001042015012004" },
    { email: "andi.wijaya@rsudlembang.go.id", username: "andi.wijaya", role: "PEGAWAI", password: "Pegawai123!", employeeNip: "197001012000011001" },
    { email: "eka.putra@rsudlembang.go.id", username: "eka.putra", role: "PEGAWAI", password: "Pegawai123!", employeeNip: "199105052016012005" },
    { email: "hesti.rahmawati@rsudlembang.go.id", username: "hesti.rahmawati", role: "PEGAWAI", password: "Pegawai123!", employeeNip: "198408082011012008" },
  ];
  for (const u of userDefs) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        username: u.username,
        role: u.role as never,
        passwordHash: await hash(u.password),
        employeeId: u.employeeNip ? employees[u.employeeNip].id : undefined,
      },
    });
  }

  console.log("Seed complete.");
  console.log("---------------------------------------------------------");
  console.log("Login accounts (email / password):");
  for (const u of userDefs) {
    console.log(`  ${u.role.padEnd(18)} ${u.email} / ${u.password}`);
  }
  console.log("---------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
