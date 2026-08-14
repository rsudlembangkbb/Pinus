'use client';

import MasterDataPage from '@/components/master/master-data-page';
import { WORK_UNIT_CATEGORIES } from '@/lib/constants';

interface WorkUnit {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
}

export default function WorkUnitsPage() {
  return (
    <MasterDataPage<WorkUnit>
      title="Unit Kerja / Instalasi"
      description="Master unit kerja beserta kategori layanan yang menjadi acuan skema proporsi Jaspel."
      listUrl="/api/master/work-units"
      createUrl="/api/master/work-units"
      fields={[
        { name: 'code', label: 'Kode Unit', type: 'text', required: true, placeholder: 'IGD' },
        { name: 'name', label: 'Nama Unit', type: 'text', required: true, placeholder: 'Instalasi Gawat Darurat' },
        {
          name: 'category',
          label: 'Kategori Layanan',
          type: 'select',
          required: true,
          options: WORK_UNIT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))
        }
      ]}
      columns={[
        { header: 'Kode', render: (r) => r.code },
        { header: 'Nama', render: (r) => r.name },
        {
          header: 'Kategori',
          render: (r) => WORK_UNIT_CATEGORIES.find((c) => c.value === r.category)?.label ?? r.category
        },
        {
          header: 'Status',
          render: (r) => (
            <span className={`badge ${r.isActive ? 'bg-pinus-100 text-pinus-800' : 'bg-slate-100 text-slate-600'}`}>
              {r.isActive ? 'Aktif' : 'Nonaktif'}
            </span>
          )
        }
      ]}
    />
  );
}
