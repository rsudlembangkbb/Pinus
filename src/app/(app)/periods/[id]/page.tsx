'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api-client';
import { PERIOD_STATUS_LABELS } from '@/lib/constants';
import ImportPanel from '@/components/periods/import-panel';
import CalculationPanel from '@/components/periods/calculation-panel';
import VerificationPanel from '@/components/periods/verification-panel';
import ResultsPanel from '@/components/periods/results-panel';
import { ROLES, RoleCode } from '@/lib/auth/roles';

interface PeriodDetail {
  period: {
    id: string;
    code: string;
    label: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  importBatches: any[];
  approvalSteps: any[];
  calculationRuns: any[];
}

interface Me {
  role: RoleCode;
  workUnit: { id: string } | null;
}

interface WorkUnit {
  id: string;
  name: string;
}

const TABS = ['import', 'kalkulasi', 'verifikasi', 'hasil'] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  import: 'Impor Data',
  kalkulasi: 'Kalkulasi',
  verifikasi: 'Verifikasi & Persetujuan',
  hasil: 'Hasil'
};

export default function PeriodDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [units, setUnits] = useState<WorkUnit[]>([]);
  const [tab, setTab] = useState<Tab>('import');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [d, m, u] = await Promise.all([
        api.get<PeriodDetail>(`/api/periods/${params.id}`),
        api.get<Me>('/api/auth/me'),
        api.get<WorkUnit[]>('/api/master/work-units')
      ]);
      setDetail(d);
      setMe(m);
      setUnits(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data periode.');
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!detail || !me) return <p className="text-sm text-slate-500">Memuat...</p>;

  const canRunCalculation = ([ROLES.SUPER_ADMIN, ROLES.ADMIN_JASPEL] as RoleCode[]).includes(me.role);
  const canExport = ([ROLES.SUPER_ADMIN, ROLES.ADMIN_JASPEL, ROLES.KEUANGAN, ROLES.DIREKTUR] as RoleCode[]).includes(me.role);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">{detail.period.label}</h1>
        <p className="text-sm text-slate-500">
          {detail.period.startDate} s.d. {detail.period.endDate} - Status:{' '}
          <span className="font-medium">{PERIOD_STATUS_LABELS[detail.period.status as keyof typeof PERIOD_STATUS_LABELS] ?? detail.period.status}</span>
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t ? 'border-pinus-700 text-pinus-800' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'import' && <ImportPanel periodId={params.id} batches={detail.importBatches} onChanged={load} />}
      {tab === 'kalkulasi' && (
        <CalculationPanel periodId={params.id} periodStatus={detail.period.status} runs={detail.calculationRuns} canRun={canRunCalculation} onChanged={load} />
      )}
      {tab === 'verifikasi' && (
        <VerificationPanel
          periodId={params.id}
          steps={detail.approvalSteps}
          workUnits={units}
          userRole={me.role}
          userWorkUnitId={me.workUnit?.id ?? null}
          onChanged={load}
        />
      )}
      {tab === 'hasil' && <ResultsPanel periodId={params.id} canExport={canExport} />}
    </div>
  );
}
