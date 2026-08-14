'use client';

import MasterDataPage from '@/components/master/master-data-page';

interface JobGrade {
  id: string;
  code: string;
  name: string;
  category: string;
  weightFactor: number;
  sortOrder: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  tenaga_medis: 'Tenaga Medis',
  tenaga_kesehatan: 'Tenaga Kesehatan',
  administrasi_struktural: 'Administrasi/Struktural'
};

export default function JobGradesPage() {
  return (
    <MasterDataPage<JobGrade>
      title="Job Grade & Bobot Indeksing"
      description="Tingkatan/kelas jabatan yang memengaruhi bobot pembagian insentif tim kerja unit."
      listUrl="/api/master/job-grades"
      createUrl="/api/master/job-grades"
      fields={[
        { name: 'code', label: 'Kode', type: 'text', required: true, placeholder: 'JG-3' },
        { name: 'name', label: 'Nama Job Grade', type: 'text', required: true },
        {
          name: 'category',
          label: 'Kategori',
          type: 'select',
          required: true,
          options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
        },
        {
          name: 'weightFactorPercent',
          label: 'Bobot (% relatif thd baseline 100%)',
          type: 'number',
          required: true,
          placeholder: '100'
        },
        { name: 'sortOrder', label: 'Urutan Tampil', type: 'number' }
      ]}
      columns={[
        { header: 'Kode', render: (r) => r.code },
        { header: 'Nama', render: (r) => r.name },
        { header: 'Kategori', render: (r) => CATEGORY_LABELS[r.category] ?? r.category },
        { header: 'Bobot', render: (r) => `${(r.weightFactor / 100).toFixed(2)}%` }
      ]}
    />
  );
}
