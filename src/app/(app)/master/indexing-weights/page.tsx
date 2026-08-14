'use client';

import MasterDataPage from '@/components/master/master-data-page';

interface IndexingWeight {
  id: string;
  category: string;
  componentKey: string;
  label: string;
  weightBps: number;
  effectiveFrom: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  administrasi_struktural: 'Administrasi/Struktural',
  tenaga_kesehatan: 'Tenaga Kesehatan'
};

const COMPONENT_LABELS: Record<string, string> = {
  pengalaman: 'Pengalaman & Masa Kerja',
  keterampilan: 'Keterampilan/Ilmu Pengetahuan/Perilaku',
  risiko_kerja: 'Risiko Kerja',
  kegawatdaruratan: 'Tingkat Kegawatdaruratan',
  jabatan: 'Jabatan yang Disandang',
  capaian_kinerja: 'Capaian Kinerja'
};

export default function IndexingWeightsPage() {
  return (
    <MasterDataPage<IndexingWeight>
      title="Bobot Variabel Indeksing"
      description="Bobot tiap variabel skor untuk perhitungan indeksing tenaga administrasi/struktural (PRD 9.3). Total bobot per kategori idealnya 100%."
      listUrl="/api/master/indexing-weights"
      createUrl="/api/master/indexing-weights"
      fields={[
        {
          name: 'category',
          label: 'Kategori',
          type: 'select',
          required: true,
          options: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))
        },
        {
          name: 'componentKey',
          label: 'Variabel',
          type: 'select',
          required: true,
          options: Object.entries(COMPONENT_LABELS).map(([value, label]) => ({ value, label }))
        },
        { name: 'label', label: 'Label Tampilan', type: 'text', required: true },
        { name: 'weightPercent', label: 'Bobot (%)', type: 'number', required: true },
        { name: 'effectiveFrom', label: 'Berlaku Sejak', type: 'date', required: true }
      ]}
      columns={[
        { header: 'Kategori', render: (r) => CATEGORY_LABELS[r.category] ?? r.category },
        { header: 'Variabel', render: (r) => COMPONENT_LABELS[r.componentKey] ?? r.componentKey },
        { header: 'Label', render: (r) => r.label },
        { header: 'Bobot', render: (r) => `${(r.weightBps / 100).toFixed(2)}%` },
        { header: 'Berlaku Sejak', render: (r) => r.effectiveFrom }
      ]}
    />
  );
}
