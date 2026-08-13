import { PrismaClient, ApprovalLevel, ApprovalStatus, EmployeeCategory, EmploymentStatus, PeriodStatus, Role } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash('pinus123', 10);

  const rawatJalan = await prisma.workUnit.upsert({
    where: { code: 'RJ' },
    update: { name: 'Rawat Jalan', serviceType: 'Rawat Jalan' },
    create: {
      code: 'RJ',
      name: 'Rawat Jalan',
      serviceType: 'Rawat Jalan',
    },
  });

  const igd = await prisma.workUnit.upsert({
    where: { code: 'IGD' },
    update: { name: 'Instalasi Gawat Darurat', serviceType: 'IGD' },
    create: {
      code: 'IGD',
      name: 'Instalasi Gawat Darurat',
      serviceType: 'IGD',
    },
  });

  const gradeA = await prisma.jobGrade.upsert({
    where: { code: 'GRADE_A' },
    update: { name: 'Grade A', weight: '1.5' },
    create: {
      code: 'GRADE_A',
      name: 'Grade A',
      weight: '1.5',
    },
  });

  const gradeB = await prisma.jobGrade.upsert({
    where: { code: 'GRADE_B' },
    update: { name: 'Grade B', weight: '1.2' },
    create: {
      code: 'GRADE_B',
      name: 'Grade B',
      weight: '1.2',
    },
  });

  const doctor = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-001' },
    update: {
      fullName: 'dr. Nurul Rasihan',
      workUnitId: rawatJalan.id,
      jobGradeId: gradeA.id,
      minimumGuarantee: '3500000',
    },
    create: {
      employeeNumber: 'EMP-001',
      nationalId: '3201010101010001',
      fullName: 'dr. Nurul Rasihan',
      category: EmployeeCategory.MEDICAL,
      profession: 'Dokter',
      specialization: 'Umum',
      position: 'DPJP',
      employmentStatus: EmploymentStatus.PNS,
      startDate: new Date('2020-01-01'),
      minimumGuarantee: '3500000',
      workUnitId: rawatJalan.id,
      jobGradeId: gradeA.id,
    },
  });

  const nurse = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-002' },
    update: {
      fullName: 'Ns. Sinta Rahmawati',
      workUnitId: igd.id,
      jobGradeId: gradeB.id,
    },
    create: {
      employeeNumber: 'EMP-002',
      nationalId: '3201010101010002',
      fullName: 'Ns. Sinta Rahmawati',
      category: EmployeeCategory.HEALTHCARE,
      profession: 'Perawat',
      position: 'Perawat Pelaksana',
      employmentStatus: EmploymentStatus.PPPK,
      startDate: new Date('2021-02-10'),
      workUnitId: igd.id,
      jobGradeId: gradeB.id,
    },
  });

  const adminEmployee = await prisma.employee.upsert({
    where: { employeeNumber: 'EMP-003' },
    update: {
      fullName: 'Rina Kurnia',
      workUnitId: rawatJalan.id,
      jobGradeId: gradeB.id,
    },
    create: {
      employeeNumber: 'EMP-003',
      nationalId: '3201010101010003',
      fullName: 'Rina Kurnia',
      category: EmployeeCategory.ADMINISTRATIVE,
      profession: 'Administrasi',
      position: 'Staf Keuangan',
      employmentStatus: EmploymentStatus.NON_ASN,
      startDate: new Date('2022-03-15'),
      workUnitId: rawatJalan.id,
      jobGradeId: gradeB.id,
    },
  });

  const userSpecs = [
    {
      email: 'superadmin@pinus.local',
      username: 'superadmin',
      fullName: 'Super Admin PINUS',
      role: Role.SUPER_ADMIN,
      employeeId: null,
      workUnitId: null,
    },
    {
      email: 'admin.jaspel@pinus.local',
      username: 'adminjaspel',
      fullName: 'Admin Jaspel',
      role: Role.ADMIN_JASPEL,
      employeeId: adminEmployee.id,
      workUnitId: rawatJalan.id,
    },
    {
      email: 'verifikator@pinus.local',
      username: 'verifikator',
      fullName: 'Verifikator Unit',
      role: Role.VERIFIER_UNIT,
      employeeId: nurse.id,
      workUnitId: igd.id,
    },
    {
      email: 'keuangan@pinus.local',
      username: 'keuangan',
      fullName: 'Bagian Keuangan',
      role: Role.FINANCE,
      employeeId: adminEmployee.id,
      workUnitId: rawatJalan.id,
    },
    {
      email: 'direktur@pinus.local',
      username: 'direktur',
      fullName: 'Direktur RSUD',
      role: Role.DIRECTOR,
      employeeId: doctor.id,
      workUnitId: rawatJalan.id,
    },
    {
      email: 'pegawai@pinus.local',
      username: 'pegawai',
      fullName: doctor.fullName,
      role: Role.EMPLOYEE,
      employeeId: doctor.id,
      workUnitId: rawatJalan.id,
    },
    {
      email: 'auditor@pinus.local',
      username: 'auditor',
      fullName: 'Auditor Internal',
      role: Role.AUDITOR,
      employeeId: null,
      workUnitId: null,
    },
  ] as const;

  for (const spec of userSpecs) {
    await prisma.user.upsert({
      where: { email: spec.email },
      update: {
        username: spec.username,
        fullName: spec.fullName,
        role: spec.role,
        employeeId: spec.employeeId,
        workUnitId: spec.workUnitId,
        passwordHash,
      },
      create: {
        email: spec.email,
        username: spec.username,
        fullName: spec.fullName,
        role: spec.role,
        employeeId: spec.employeeId,
        workUnitId: spec.workUnitId,
        passwordHash,
      },
    });
  }

  await prisma.proportionScheme.upsert({
    where: { id: '11111111-1111-1111-1111-111111111111' },
    update: {
      workUnitId: rawatJalan.id,
      name: 'Rawat Jalan JKN Dokter',
      serviceType: 'Konsultasi Dokter',
      roleInService: 'DPJP',
      payerType: 'JKN',
      percentage: '15',
      effectiveFrom: new Date('2026-01-01'),
    },
    create: {
      id: '11111111-1111-1111-1111-111111111111',
      workUnitId: rawatJalan.id,
      name: 'Rawat Jalan JKN Dokter',
      serviceType: 'Konsultasi Dokter',
      roleInService: 'DPJP',
      payerType: 'JKN',
      percentage: '15',
      effectiveFrom: new Date('2026-01-01'),
    },
  });

  await prisma.proportionScheme.upsert({
    where: { id: '22222222-2222-2222-2222-222222222222' },
    update: {
      workUnitId: igd.id,
      name: 'IGD Non JKN Perawat',
      serviceType: 'Tindakan IGD',
      roleInService: 'Perawat Pelaksana',
      payerType: 'NON_JKN',
      percentage: '50',
      effectiveFrom: new Date('2026-01-01'),
    },
    create: {
      id: '22222222-2222-2222-2222-222222222222',
      workUnitId: igd.id,
      name: 'IGD Non JKN Perawat',
      serviceType: 'Tindakan IGD',
      roleInService: 'Perawat Pelaksana',
      payerType: 'NON_JKN',
      percentage: '50',
      effectiveFrom: new Date('2026-01-01'),
    },
  });

  const deductionRules = [
    ['DISCIPLINE', 'Potongan Disiplin', 'Pengurangan karena pembinaan disiplin', '50'],
    ['LONG_LEAVE', 'Cuti 1 Bulan', 'Cuti 1 bulan atau lebih', '50'],
    ['TRAINING_LONG', 'Diklat > 1 Bulan', 'Mengikuti diklat lebih dari 1 bulan', '50'],
    ['STUDY_ASSIGNMENT', 'Tugas Belajar', 'Tugas belajar dengan ketidakhadiran >= 3 hari/minggu', '80'],
  ] as const;

  for (const [code, name, description, percentage] of deductionRules) {
    await prisma.deductionRule.upsert({
      where: { code },
      update: {
        name,
        description,
        percentage,
        effectiveFrom: new Date('2026-01-01'),
      },
      create: {
        code,
        name,
        description,
        percentage,
        effectiveFrom: new Date('2026-01-01'),
      },
    });
  }

  const adminJaspel = await prisma.user.findUniqueOrThrow({
    where: { email: 'admin.jaspel@pinus.local' },
  });

  const publishedPeriod = await prisma.calculationPeriod.upsert({
    where: { label: '07/2026' },
    update: {
      budgetCap: '25000000',
      healthcarePool: '7000000',
      administrativePool: '5000000',
      status: PeriodStatus.PUBLISHED,
      createdById: adminJaspel.id,
      finalizedAt: new Date('2026-08-05T10:00:00.000Z'),
    },
    create: {
      month: 7,
      year: 2026,
      label: '07/2026',
      budgetCap: '25000000',
      healthcarePool: '7000000',
      administrativePool: '5000000',
      status: PeriodStatus.PUBLISHED,
      createdById: adminJaspel.id,
      finalizedAt: new Date('2026-08-05T10:00:00.000Z'),
    },
  });

  const draftPeriod = await prisma.calculationPeriod.upsert({
    where: { label: '08/2026' },
    update: {
      budgetCap: '28000000',
      healthcarePool: '8000000',
      administrativePool: '6000000',
      status: PeriodStatus.DRAFT,
      createdById: adminJaspel.id,
    },
    create: {
      month: 8,
      year: 2026,
      label: '08/2026',
      budgetCap: '28000000',
      healthcarePool: '8000000',
      administrativePool: '6000000',
      status: PeriodStatus.DRAFT,
      createdById: adminJaspel.id,
    },
  });

  for (const periodId of [publishedPeriod.id, draftPeriod.id]) {
    for (const level of [ApprovalLevel.UNIT, ApprovalLevel.FINANCE, ApprovalLevel.DIRECTOR]) {
      await prisma.approvalStep.upsert({
        where: {
          periodId_level: { periodId, level },
        },
        update: {
          status: periodId === publishedPeriod.id ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
          note: periodId === publishedPeriod.id ? 'Seeded approval' : null,
          actedById: periodId === publishedPeriod.id ? adminJaspel.id : null,
          actedAt: periodId === publishedPeriod.id ? new Date('2026-08-05T10:00:00.000Z') : null,
        },
        create: {
          periodId,
          level,
          status: periodId === publishedPeriod.id ? ApprovalStatus.APPROVED : ApprovalStatus.PENDING,
          note: periodId === publishedPeriod.id ? 'Seeded approval' : null,
          actedById: periodId === publishedPeriod.id ? adminJaspel.id : null,
          actedAt: periodId === publishedPeriod.id ? new Date('2026-08-05T10:00:00.000Z') : null,
        },
      });
    }
  }

  for (const period of [publishedPeriod, draftPeriod]) {
    await prisma.attendanceRecord.upsert({
      where: { periodId_employeeId: { periodId: period.id, employeeId: doctor.id } },
      update: { attendanceScore: '100', leaveDays: 0, disciplinaryAction: false, trainingMonths: 0, studyDaysPerWeek: 0 },
      create: {
        periodId: period.id,
        employeeId: doctor.id,
        attendanceScore: '100',
        leaveDays: 0,
        disciplinaryAction: false,
        trainingMonths: 0,
        studyDaysPerWeek: 0,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: { periodId_employeeId: { periodId: period.id, employeeId: nurse.id } },
      update: { attendanceScore: '96', leaveDays: 0, disciplinaryAction: false, trainingMonths: 0, studyDaysPerWeek: 0 },
      create: {
        periodId: period.id,
        employeeId: nurse.id,
        attendanceScore: '96',
        leaveDays: 0,
        disciplinaryAction: false,
        trainingMonths: 0,
        studyDaysPerWeek: 0,
      },
    });

    await prisma.attendanceRecord.upsert({
      where: { periodId_employeeId: { periodId: period.id, employeeId: adminEmployee.id } },
      update: { attendanceScore: '94', leaveDays: 0, disciplinaryAction: false, trainingMonths: 0, studyDaysPerWeek: 0 },
      create: {
        periodId: period.id,
        employeeId: adminEmployee.id,
        attendanceScore: '94',
        leaveDays: 0,
        disciplinaryAction: false,
        trainingMonths: 0,
        studyDaysPerWeek: 0,
      },
    });

    await prisma.performanceScore.upsert({
      where: { periodId_employeeId: { periodId: period.id, employeeId: adminEmployee.id } },
      update: { attendanceWeight: '94', qualityWeight: '90', finalScore: '91.60' },
      create: {
        periodId: period.id,
        employeeId: adminEmployee.id,
        attendanceWeight: '94',
        qualityWeight: '90',
        finalScore: '91.60',
      },
    });

    await prisma.performanceScore.upsert({
      where: { periodId_employeeId: { periodId: period.id, employeeId: nurse.id } },
      update: { attendanceWeight: '96', qualityWeight: '92', finalScore: '93.60' },
      create: {
        periodId: period.id,
        employeeId: nurse.id,
        attendanceWeight: '96',
        qualityWeight: '92',
        finalScore: '93.60',
      },
    });
  }

  const transactions = [
    {
      id: '33333333-3333-3333-3333-333333333331',
      periodId: draftPeriod.id,
      workUnitId: rawatJalan.id,
      employeeId: doctor.id,
      serviceDate: new Date('2026-08-03'),
      patientReference: 'RM-0001',
      serviceType: 'Konsultasi Dokter',
      roleInService: 'DPJP',
      payerType: 'JKN' as const,
      tariff: '5000000',
      quantity: 1,
    },
    {
      id: '33333333-3333-3333-3333-333333333332',
      periodId: draftPeriod.id,
      workUnitId: igd.id,
      employeeId: nurse.id,
      serviceDate: new Date('2026-08-04'),
      patientReference: 'RM-0002',
      serviceType: 'Tindakan IGD',
      roleInService: 'Perawat Pelaksana',
      payerType: 'NON_JKN' as const,
      tariff: '1200000',
      quantity: 2,
    },
  ];

  for (const transaction of transactions) {
    await prisma.serviceTransaction.upsert({
      where: { id: transaction.id },
      update: transaction,
      create: transaction,
    });
  }

  const publishedResults = [
    {
      id: '44444444-4444-4444-4444-444444444441',
      periodId: publishedPeriod.id,
      employeeId: doctor.id,
      workUnitId: rawatJalan.id,
      grossAmount: '4500000',
      deductionAmount: '0',
      adjustmentAmount: '0',
      finalAmount: '4500000',
      details: { seeded: true, category: 'MEDICAL', transactionCount: 18 },
      formulaSnapshot: { seeded: true, adjustmentFactor: '1' },
    },
    {
      id: '44444444-4444-4444-4444-444444444442',
      periodId: publishedPeriod.id,
      employeeId: nurse.id,
      workUnitId: igd.id,
      grossAmount: '7000000',
      deductionAmount: '0',
      adjustmentAmount: '0',
      finalAmount: '7000000',
      details: { seeded: true, category: 'HEALTHCARE', jobGradeWeight: '1.2' },
      formulaSnapshot: { seeded: true, adjustmentFactor: '1' },
    },
    {
      id: '44444444-4444-4444-4444-444444444443',
      periodId: publishedPeriod.id,
      employeeId: adminEmployee.id,
      workUnitId: rawatJalan.id,
      grossAmount: '5000000',
      deductionAmount: '0',
      adjustmentAmount: '0',
      finalAmount: '5000000',
      details: { seeded: true, category: 'ADMINISTRATIVE', performanceScore: '91.60' },
      formulaSnapshot: { seeded: true, adjustmentFactor: '1' },
    },
  ];

  for (const result of publishedResults) {
    await prisma.calculationResult.upsert({
      where: {
        periodId_employeeId: {
          periodId: result.periodId,
          employeeId: result.employeeId,
        },
      },
      update: result,
      create: result,
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: adminJaspel.id,
      action: 'SEED_DATABASE',
      entityType: 'System',
      entityId: 'seed',
      after: { timestamp: new Date().toISOString() },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
