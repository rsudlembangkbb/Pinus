import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRupiah } from "@pinus/shared";
import { Card, CardHeader, PageHeader, StatTile } from "@/components/ui";
import { api } from "@/lib/api-client";

interface Summary {
  period: { label: string; code: string };
  employeeCount: number;
  totalGross: number;
  totalDeduction: number;
  totalNet: number;
  paguAmount: number | null;
  paguUtilizationBp: number | null;
  byCategory: { category: string; count: number; total: number }[];
  byUnit: { unit: string; count: number; total: number }[];
}

interface TrendItem {
  periodCode: string;
  periodLabel: string;
  status: string;
  totalNet: number;
  employeeCount: number;
  paguAmount: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  MEDIS: "Tenaga Medis",
  KEPERAWATAN: "Keperawatan",
  NAKES_LAIN: "Nakes Non-Keperawatan",
  ADMINISTRASI: "Administrasi",
  STRUKTURAL: "Struktural",
};

function currencyTick(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}jt`;
  return `${value}`;
}

export function DashboardPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<Summary>("/dashboard/summary"),
  });
  const { data: trend } = useQuery({
    queryKey: ["dashboard-trend"],
    queryFn: () => api.get<{ items: TrendItem[] }>("/dashboard/trend?months=12"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard Manajemen" description={summary ? `Ringkasan periode ${summary.period.label}` : "Memuat ringkasan periode terbaru…"} />

      {!isLoading && summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total Realisasi Jaspel" value={formatRupiah(summary.totalNet)} tone="green" />
            <StatTile label="Jumlah Pegawai" value={String(summary.employeeCount)} />
            <StatTile label="Total Potongan" value={formatRupiah(summary.totalDeduction)} />
            <StatTile
              label="Utilisasi Pagu"
              value={summary.paguUtilizationBp != null ? `${(summary.paguUtilizationBp / 100).toFixed(1)}%` : "Tidak dibatasi"}
              tone={summary.paguUtilizationBp != null && summary.paguUtilizationBp > 10000 ? "amber" : "blue"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Distribusi per Kategori Tenaga" />
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byCategory.map((c) => ({ ...c, name: CATEGORY_LABELS[c.category] ?? c.category }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
                    <Bar dataKey="total" fill="#3a9640" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Distribusi per Unit Kerja (Top 10)" />
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={summary.byUnit.slice(0, 10)} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={currencyTick} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="unit" width={120} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatRupiah(v)} />
                    <Bar dataKey="total" fill="#1a4869" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader title="Tren Realisasi Jaspel" subtitle="Perbandingan realisasi terhadap pagu, 12 periode terakhir." />
        <div className="h-72 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend?.items ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="periodCode" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={currencyTick} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Line type="monotone" dataKey="totalNet" name="Realisasi" stroke="#3a9640" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="paguAmount" name="Pagu" stroke="#1a4869" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
