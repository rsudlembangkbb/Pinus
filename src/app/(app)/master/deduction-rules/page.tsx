'use client';

import MasterDataPage from '@/components/master/master-data-page';
import { ATTENDANCE_RECORD_TYPES } from '@/lib/constants';

interface DeductionRule {
  id: string;
  code: string;
  name: string;
  attendanceRecordType: string;
  deductionBps: number;
  requiresDocument: boolean;
  effectiveFrom: string;
}

export default function DeductionRulesPage() {
  return (
    <MasterDataPage<DeductionRule>
      title="Aturan Pengurangan / Potongan"
      description="Konfigurasi potongan Jaspel berbasis data kehadiran BARAYA sesuai Pasal 15 Raperbup Remunerasi."
      listUrl="/api/master/deduction-rules"
      createUrl="/api/master/deduction-rules"
      fields={[
        { name: 'code', label: 'Kode', type: 'text', required: true, placeholder: 'CUTI-1BLN' },
        { name: 'name', label: 'Nama Aturan', type: 'text', required: true, placeholder: 'Cuti >= 1 bulan' },
        {
          name: 'attendanceRecordType',
          label: 'Jenis Kehadiran Terkait',
          type: 'select',
          required: true,
          options: ATTENDANCE_RECORD_TYPES.filter((t) => t.value !== 'hadir').map((t) => ({ value: t.value, label: t.label }))
        },
        { name: 'deductionPercent', label: 'Persentase Potongan (%)', type: 'number', required: true, placeholder: '50' },
        { name: 'requiresDocument', label: 'Wajib Dokumen Pendukung', type: 'checkbox' },
        { name: 'effectiveFrom', label: 'Berlaku Sejak', type: 'date', required: true }
      ]}
      columns={[
        { header: 'Kode', render: (r) => r.code },
        { header: 'Nama', render: (r) => r.name },
        {
          header: 'Jenis Kehadiran',
          render: (r) => ATTENDANCE_RECORD_TYPES.find((t) => t.value === r.attendanceRecordType)?.label ?? r.attendanceRecordType
        },
        { header: 'Potongan', render: (r) => `${(r.deductionBps / 100).toFixed(2)}%` },
        { header: 'Berlaku Sejak', render: (r) => r.effectiveFrom }
      ]}
    />
  );
}
