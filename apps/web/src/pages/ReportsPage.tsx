import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PERIOD_STATUS_LABELS, type CalculationPeriod } from "@pinus/shared";
import { Button, Card, CardHeader, Field, PageHeader, Select } from "@/components/ui";
import { api, downloadFile } from "@/lib/api-client";

export function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["periods", "all"],
    queryFn: () => api.get<{ items: CalculationPeriod[] }>("/workflow/periods?pageSize=100"),
  });
  const [periodId, setPeriodId] = useState("");
  const period = data?.items.find((p) => p.id === periodId) ?? data?.items[0];
  const effectiveId = periodId || period?.id || "";

  const exports = [
    { key: "rekap-unit.xlsx", label: "Rekap per Unit Kerja", desc: "Untuk verifikasi Kepala Instalasi/Unit", icon: "📊" },
    { key: "rekap-total.xlsx", label: "Rekap Total Periode", desc: "Dasar penatausahaan pembayaran Bagian Keuangan BLUD", icon: "📈" },
    { key: "raw-data.xlsx", label: "Data Mentah", desc: "Transaksi & hasil kalkulasi untuk audit/analisis lanjutan", icon: "🗄️" },
    { key: "slips.zip", label: "Slip Jaspel Massal", desc: "Seluruh slip individual dalam satu arsip ZIP", icon: "🧾" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan & Ekspor" description="Unduh rekap dan dokumen pendukung penatausahaan Jaspel per periode." />

      <Card>
        <div className="p-5">
          <Field label="Pilih Periode">
            <Select value={effectiveId} onChange={(e) => setPeriodId(e.target.value)} className="max-w-sm">
              {data?.items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} — {PERIOD_STATUS_LABELS[p.status as keyof typeof PERIOD_STATUS_LABELS]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {exports.map((exp) => (
          <Card key={exp.key}>
            <CardHeader title={`${exp.icon} ${exp.label}`} subtitle={exp.desc} />
            <div className="p-5">
              <Button
                disabled={!effectiveId}
                onClick={() => downloadFile(`/reports/periods/${effectiveId}/${exp.key}`, `${exp.key.replace(".", `-${period?.code}.`)}`)}
              >
                Unduh
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
