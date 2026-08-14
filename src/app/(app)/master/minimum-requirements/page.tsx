'use client';

import MasterDataPage from '@/components/master/master-data-page';
import { formatRupiah } from '@/lib/money';

interface MinimumRequirement {
  id: string;
  category: string;
  minimumAmount: number;
  effectiveFrom: string;
}

export default function MinimumRequirementsPage() {
  return (
    <MasterDataPage<MinimumRequirement>
      title="Pendapatan Minimum (Minimum Requirement)"
      description="Nilai pendapatan Jaspel minimum yang dijamin untuk kategori tenaga tertentu (dokter spesialis, perawat mahir, dsb.)."
      listUrl="/api/master/minimum-requirements"
      createUrl="/api/master/minimum-requirements"
      fields={[
        {
          name: 'category',
          label: 'Kategori (kode bebas, dipakai di Data Pegawai)',
          type: 'text',
          required: true,
          placeholder: 'dokter_spesialis'
        },
        { name: 'minimumAmount', label: 'Nominal Minimum (Rp)', type: 'number', required: true },
        { name: 'effectiveFrom', label: 'Berlaku Sejak', type: 'date', required: true }
      ]}
      columns={[
        { header: 'Kategori', render: (r) => r.category },
        { header: 'Nominal Minimum', render: (r) => formatRupiah(r.minimumAmount) },
        { header: 'Berlaku Sejak', render: (r) => r.effectiveFrom }
      ]}
    />
  );
}
