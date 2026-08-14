#!/usr/bin/env node
/**
 * Generates drizzle/seed.sql: roles, reference master data (work units,
 * job grades, deduction rules, minimum requirements, indexing weight
 * components, a starter proportion-scheme set from the Kepdirjen Yankes
 * national reference ranges - PRD section 9.1), and one bootstrap
 * Super Admin account with a freshly-generated temporary password.
 *
 * Run with: node scripts/generate-seed.mjs
 * Then apply with: npm run db:seed:local (or :remote)
 */
import { webcrypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const crypto = webcrypto;
const ITERATIONS = 210_000;

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits'
  ]);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, keyMaterial, 256);
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(derived))}`;
}

function newId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function generateTemporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

const roles = [
  ['super_admin', 'Super Admin / IT Administrator'],
  ['admin_jaspel', 'Admin Jaspel / Tim Remunerasi'],
  ['verifikator_unit', 'Verifikator Unit / Kepala Instalasi'],
  ['keuangan', 'Bagian Keuangan / Pejabat Keuangan BLUD'],
  ['direktur', 'Direktur / Pejabat Pengelola BLUD'],
  ['pegawai', 'Pegawai'],
  ['auditor', 'Auditor / Inspektorat']
];

const workUnits = [
  ['IGD', 'Instalasi Gawat Darurat', 'igd'],
  ['RANAP', 'Rawat Inap', 'rawat_inap'],
  ['RAJAL', 'Rawat Jalan', 'rawat_jalan'],
  ['IBS', 'Instalasi Bedah Sentral', 'ibs'],
  ['RADIOLOGI', 'Radiologi', 'radiologi'],
  ['LAB', 'Laboratorium Patologi Klinik', 'lab_patologi'],
  ['REHAB', 'Rehabilitasi Medik', 'rehab_medik'],
  ['ADM', 'Administrasi Umum', 'administrasi'],
  ['STRUKTURAL', 'Struktural / Manajemen', 'struktural']
];

const jobGrades = [
  ['JG-1', 'Job Grade I (Pemula)', 'tenaga_kesehatan', 8000, 1],
  ['JG-2', 'Job Grade II (Terampil)', 'tenaga_kesehatan', 10000, 2],
  ['JG-3', 'Job Grade III (Mahir)', 'tenaga_kesehatan', 13000, 3],
  ['JG-4', 'Job Grade IV (Penyelia)', 'tenaga_kesehatan', 16000, 4],
  ['JGA-1', 'Job Grade Administrasi I', 'administrasi_struktural', 8000, 1],
  ['JGA-2', 'Job Grade Administrasi II', 'administrasi_struktural', 11000, 2]
];

const deductionRules = [
  ['POT-CUTI', 'Cuti >= 1 bulan', 'cuti', 5000, 0, '2026-01-01'],
  ['POT-DIKLAT', 'Diklat > 1 bulan', 'diklat', 5000, 0, '2026-01-01'],
  ['POT-DISIPLIN', 'Pembinaan/Hukuman Disiplin', 'pembinaan_disiplin', 5000, 1, '2026-01-01'],
  ['POT-TUBEL', 'Tugas Belajar (ketidakhadiran >= 3 hari/minggu)', 'tugas_belajar', 8000, 0, '2026-01-01'],
  ['POT-PERKELAHIAN', 'Terlibat Perkelahian (masa pembinaan)', 'perkelahian', 5000, 1, '2026-01-01']
];

const minimumRequirements = [
  ['dokter_subspesialis', 25_000_000, '2026-01-01'],
  ['dokter_spesialis', 18_000_000, '2026-01-01'],
  ['dokter_umum', 10_000_000, '2026-01-01'],
  ['perawat_mahir', 4_000_000, '2026-01-01']
];

const indexingWeights = [
  ['administrasi_struktural', 'pengalaman', 'Pengalaman & Masa Kerja', 1500],
  ['administrasi_struktural', 'keterampilan', 'Keterampilan/Ilmu Pengetahuan/Perilaku', 1500],
  ['administrasi_struktural', 'risiko_kerja', 'Risiko Kerja', 1500],
  ['administrasi_struktural', 'kegawatdaruratan', 'Tingkat Kegawatdaruratan', 1000],
  ['administrasi_struktural', 'jabatan', 'Jabatan yang Disandang', 1500],
  ['administrasi_struktural', 'capaian_kinerja', 'Capaian Kinerja (Kehadiran 40% + Kualitas 60%)', 3000]
];

// Starter proportion schemes using the midpoint of the Kepdirjen Yankes national
// reference ranges (PRD Tabel 9.1) - MUST be reviewed & replaced with RSUD
// Lembang's officially gazetted values (Keputusan Bupati/Direktur) before go-live.
function proportionRow(unitCode, paymentType, role, percent) {
  return { unitCode, paymentType, role, bps: Math.round(percent * 100) };
}
const proportionSchemes = [
  proportionRow('RANAP', 'jkn', 'dpjp', 12.5),
  proportionRow('RANAP', 'non_jkn', 'dpjp', 60),
  proportionRow('RAJAL', 'jkn', 'dpjp', 17.5),
  proportionRow('RAJAL', 'non_jkn', 'dpjp', 60),
  proportionRow('IGD', 'non_jkn', 'dpjp', 60),
  proportionRow('IBS', 'jkn', 'operator', 12.5),
  proportionRow('IBS', 'jkn', 'co_operator', 7),
  proportionRow('IBS', 'jkn', 'anestesi', 4.5),
  proportionRow('IBS', 'non_jkn', 'operator', 25),
  proportionRow('IBS', 'non_jkn', 'co_operator', 6.5),
  proportionRow('IBS', 'non_jkn', 'anestesi', 10.5),
  proportionRow('RADIOLOGI', 'jkn', 'pelaksana', 7.5),
  proportionRow('RADIOLOGI', 'non_jkn', 'pelaksana', 12.5),
  proportionRow('LAB', 'jkn', 'pelaksana', 3),
  proportionRow('LAB', 'non_jkn', 'pelaksana', 6.5),
  proportionRow('REHAB', 'jkn', 'pelaksana', 7.5),
  proportionRow('REHAB', 'non_jkn', 'pelaksana', 60)
];

const lines = [];
lines.push('-- Generated by scripts/generate-seed.mjs - reference/starter data only.');
lines.push('-- Values marked "[Medium confidence]" in the PRD MUST be replaced with');
lines.push("-- RSUD Lembang's officially gazetted figures before production go-live.");
lines.push('');

for (const [code, name] of roles) {
  lines.push(`INSERT INTO roles (id, code, name) VALUES (${sqlStr(newId('role'))}, ${sqlStr(code)}, ${sqlStr(name)});`);
}
lines.push('');

const unitIdByCode = {};
for (const [code, name, category] of workUnits) {
  const id = newId('wu');
  unitIdByCode[code] = id;
  lines.push(
    `INSERT INTO work_units (id, code, name, category) VALUES (${sqlStr(id)}, ${sqlStr(code)}, ${sqlStr(name)}, ${sqlStr(category)});`
  );
}
lines.push('');

for (const [code, name, category, weight, sortOrder] of jobGrades) {
  lines.push(
    `INSERT INTO job_grades (id, code, name, category, weight_factor, sort_order) VALUES (${sqlStr(newId('jg'))}, ${sqlStr(code)}, ${sqlStr(name)}, ${sqlStr(category)}, ${weight}, ${sortOrder});`
  );
}
lines.push('');

for (const [code, name, recordType, bps, requiresDoc, effectiveFrom] of deductionRules) {
  lines.push(
    `INSERT INTO deduction_rules (id, code, name, attendance_record_type, deduction_bps, requires_document, effective_from) VALUES (${sqlStr(newId('ddr'))}, ${sqlStr(code)}, ${sqlStr(name)}, ${sqlStr(recordType)}, ${bps}, ${requiresDoc}, ${sqlStr(effectiveFrom)});`
  );
}
lines.push('');

for (const [category, amount, effectiveFrom] of minimumRequirements) {
  lines.push(
    `INSERT INTO minimum_requirements (id, category, minimum_amount, effective_from) VALUES (${sqlStr(newId('minreq'))}, ${sqlStr(category)}, ${amount}, ${sqlStr(effectiveFrom)});`
  );
}
lines.push('');

for (const [category, key, label, bps] of indexingWeights) {
  lines.push(
    `INSERT INTO indexing_weight_components (id, category, component_key, label, weight_bps, effective_from) VALUES (${sqlStr(newId('iwc'))}, ${sqlStr(category)}, ${sqlStr(key)}, ${sqlStr(label)}, ${bps}, '2026-01-01');`
  );
}
lines.push('');

for (const p of proportionSchemes) {
  const unitId = unitIdByCode[p.unitCode];
  lines.push(
    `INSERT INTO proportion_schemes (id, work_unit_id, payment_type, role, proportion_bps, effective_from) VALUES (${sqlStr(newId('psc'))}, ${sqlStr(unitId)}, ${sqlStr(p.paymentType)}, ${sqlStr(p.role)}, ${p.bps}, '2026-01-01');`
  );
}
lines.push('');

const adminPassword = generateTemporaryPassword();
const adminHash = await hashPassword(adminPassword);
const adminUserId = newId('usr');
lines.push('-- Bootstrap Super Admin account. CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN.');
lines.push(
  `INSERT INTO users (id, username, email, password_hash, role_id, must_change_password) SELECT ${sqlStr(adminUserId)}, 'admin', 'admin@rsudlembang.local', ${sqlStr(adminHash)}, id, 1 FROM roles WHERE code = 'super_admin';`
);

writeFileSync(new URL('../drizzle/seed.sql', import.meta.url), lines.join('\n') + '\n');

console.log('Wrote drizzle/seed.sql');
console.log('');
console.log('Bootstrap Super Admin credentials (SAVE THESE - shown only once):');
console.log('  username: admin');
console.log(`  password: ${adminPassword}`);
console.log('');
console.log('Apply with: npm run db:seed:local   (or npm run db:migrate:remote + wrangler d1 execute --remote for production)');
