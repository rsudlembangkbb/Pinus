import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRupiah, bpToPercentLabel, type CalculationComponent, type CalculationPeriod, type CalculationResult } from "@pinus/shared";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Spinner, StatTile } from "@/components/ui";
import { api, downloadFile } from "@/lib/api-client";

interface HistoryItem {
  periodId: string;
  periodCode: string;
  periodLabel: string;
  engineKind: string;
  grossAmount: number;
  deductionAmount: number;
  netAmount: number;
}

export function MyDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-history"],
    queryFn: () => api.get<{ items: HistoryItem[] }>("/transparency/me/history"),
  });
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const history = data?.items ?? [];
  const latest = history[0];
  const activePeriodId = selectedPeriodId ?? latest?.periodId ?? null;

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["my-period-detail", activePeriodId],
    queryFn: () => api.get<{ period: CalculationPeriod; result: CalculationResult & { components: CalculationComponent[] } }>(`/transparency/me/periods/${activePeriodId}`),
    enabled: !!activePeriodId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6 text-pinus-600" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div>
        <PageHeader title="Jaspel Saya" />
        <Card>
          <EmptyState title="Belum ada Jaspel yang dipublikasikan" description="Rincian akan muncul di sini setelah periode berjalan diselesaikan dan disetujui oleh Direktur." />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Jaspel Saya" description="Rincian transparan Jasa Pelayanan Anda per periode." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Periode Terbaru" value={latest?.periodLabel ?? "-"} />
        <StatTile label="Jumlah Diterima" value={formatRupiah(latest?.netAmount ?? 0)} tone="green" />
        <StatTile label="Rata-rata 6 Periode" value={formatRupiah(Math.round(history.slice(0, 6).reduce((s, h) => s + h.netAmount, 0) / Math.min(6, history.length)))} />
      </div>

      <Card>
        <CardHeader title="Tren Penerimaan" subtitle="Perbandingan beberapa periode terakhir." />
        <div className="h-64 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[...history].reverse().slice(-12)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="periodCode" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Bar dataKey="netAmount" fill="#3a9640" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Riwayat Periode"
          action={
            activePeriodId && (
              <Button variant="secondary" onClick={() => downloadFile(`/transparency/me/periods/${activePeriodId}/slip.pdf`, `slip-jaspel-${history.find((h) => h.periodId === activePeriodId)?.periodCode}.pdf`)}>
                ⬇ Unduh Slip PDF
              </Button>
            )
          }
        />
        <div className="divide-y divide-slate-100">
          {history.map((h) => (
            <button
              key={h.periodId}
              onClick={() => setSelectedPeriodId(h.periodId)}
              className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm transition-colors hover:bg-slate-50 ${activePeriodId === h.periodId ? "bg-pinus-50/60" : ""}`}
            >
              <span className="font-medium text-slate-700">{h.periodLabel}</span>
              <span className="flex items-center gap-3">
                <Badge tone="slate">{h.engineKind}</Badge>
                <span className="font-semibold text-pinus-700">{formatRupiah(h.netAmount)}</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {detailLoading && (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5 text-pinus-600" />
        </div>
      )}
      {detail && (
        <Card>
          <CardHeader title={`Rincian Komponen — ${detail.period.label}`} subtitle="Sumber data, formula, dan komponen potongan yang membentuk nominal Jaspel Anda." />
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-3 py-2">Komponen</th>
                  <th className="px-3 py-2">Dasar</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detail.result.components.map((c, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-slate-600">{c.label}</td>
                    <td className="px-3 py-2 text-slate-500">{formatRupiah(c.basisAmount)}</td>
                    <td className="px-3 py-2 text-slate-500">{c.percentBp !== null ? bpToPercentLabel(c.percentBp) : "-"}</td>
                    <td className={`px-3 py-2 text-right font-medium ${c.amount < 0 ? "text-red-600" : "text-slate-800"}`}>{formatRupiah(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td colSpan={3} className="px-3 py-2.5 font-semibold text-slate-800">
                    Jumlah Diterima
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-bold text-pinus-700">{formatRupiah(detail.result.netAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
