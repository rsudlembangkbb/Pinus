"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { CalculationResult, Period } from "@/types/api";
import { formatRupiah } from "@/lib/format";

interface LineItem {
  [key: string]: unknown;
}

const SERVICE_ROLE_LABELS: Record<string, string> = {
  DPJP: "DPJP",
  OPERATOR: "Operator",
  CO_OPERATOR: "Co-Operator",
  ANESTESI: "Anestesi",
  PELAKSANA: "Pelaksana",
};

const VARIABLE_LABELS: Record<string, string> = {
  EXPERIENCE: "Pengalaman & Masa Kerja",
  SKILL: "Keterampilan",
  RISK: "Risiko Kerja",
  URGENCY: "Kegawatdaruratan",
  POSITION: "Jabatan",
  PERFORMANCE: "Capaian Kinerja",
};

/**
 * The three calculation engines (medical staff, unit team, admin indexing)
 * each produce a differently-shaped line item. Employees viewing their own
 * slip don't need raw ids or internal field names — PRD §10.1 asks for
 * "kejelasan angka dan rincian" for a non-technical audience, so this maps
 * each known shape to plain-language columns instead of dumping the JSON.
 */
function toFriendlyRows(lineItems: LineItem[]): { columns: string[]; rows: string[][] } {
  if (lineItems.length === 0) return { columns: [], rows: [] };
  const sample = lineItems[0];

  if ("serviceRole" in sample && "tariffAmount" in sample) {
    return {
      columns: ["Peran", "Status Jaminan", "Tarif Layanan", "Persentase", "Nominal Jaspel"],
      rows: lineItems.map((item) => [
        SERVICE_ROLE_LABELS[String(item.serviceRole)] ?? String(item.serviceRole),
        item.guaranteeStatus === "JKN" ? "JKN" : "Non-JKN",
        formatRupiah(String(item.tariffAmount)),
        `${item.percentage}%`,
        formatRupiah(String(item.amount)),
      ]),
    };
  }

  if ("unitPoolShare" in sample) {
    return {
      columns: ["Porsi Tetap Unit", "Porsi Subsidi Lintas-Unit", "Bobot", "Total"],
      rows: lineItems.map((item) => [
        formatRupiah(String(item.unitPoolShare)),
        formatRupiah(String(item.crossUnitSubsidyShare)),
        String(item.weight),
        formatRupiah(String(item.amount)),
      ]),
    };
  }

  if ("variableCode" in sample) {
    return {
      columns: ["Variabel Penilaian", "Skor", "Bobot", "Kontribusi"],
      rows: lineItems.map((item) => [
        VARIABLE_LABELS[String(item.variableCode)] ?? String(item.variableCode),
        String(item.score),
        `${item.weightPercent}%`,
        String(item.weightedScore),
      ]),
    };
  }

  const columns = Object.keys(sample);
  return { columns, rows: lineItems.map((item) => columns.map((c) => String(item[c]))) };
}

export default function MyJaspelPage() {
  const { user } = useAuth();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  const { data: periods } = useQuery({
    queryKey: ["my-periods"],
    queryFn: async () => (await apiClient.get<Period[]>("/periods")).data,
  });

  const periodId = selectedPeriodId ?? periods?.[0]?.id ?? null;

  const { data: result, isLoading, error } = useQuery({
    queryKey: ["my-result", periodId],
    queryFn: async () => (await apiClient.get<CalculationResult>(`/periods/${periodId}/results/me`)).data,
    enabled: !!periodId,
    retry: false,
  });

  const components = result?.components as
    | { grossDetail?: LineItem[] | { lineItems?: LineItem[] }; deduction?: { trigger: string | null; percentage: string }; minimumRequirement?: { applied: boolean; minimumAmount: string | null } }
    | undefined;

  const lineItems: LineItem[] = useMemo(() => {
    if (!components?.grossDetail) return [];
    if (Array.isArray(components.grossDetail)) return components.grossDetail;
    return components.grossDetail.lineItems ?? [];
  }, [components]);

  if (!user?.employeeId) {
    return (
      <div className="card p-8 text-center text-gray-500">
        Akun Anda belum terhubung dengan data pegawai. Hubungi Admin Jaspel.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jaspel Saya</h1>
          <p className="text-sm text-gray-500">Rincian jasa pelayanan dan insentif kinerja Anda per periode.</p>
        </div>
        {periods && periods.length > 0 && (
          <select
            className="input w-56"
            value={periodId ?? ""}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {(!periods || periods.length === 0) && (
        <div className="card p-8 text-center text-gray-500">
          Belum ada periode Jaspel yang dipublikasikan.
        </div>
      )}

      {isLoading && periodId && <div className="card p-8 text-center text-gray-400">Memuat…</div>}

      {error && (
        <div className="card p-8 text-center text-gray-500">
          Belum ada rincian Jaspel untuk Anda pada periode ini.
        </div>
      )}

      {result && (
        <>
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-pinus-700 to-lembang-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-pinus-100">Total Diterima</div>
                  <div className="text-3xl font-bold">{formatRupiah(result.netAmount)}</div>
                </div>
                <TrendingUp className="opacity-40" size={40} />
              </div>
              <div className="mt-2 text-sm text-pinus-100">
                {result.employee.fullName} • {result.employee.nip} • {result.employee.workUnit.name}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
              <Stat label="Jumlah Kotor" value={formatRupiah(result.grossAmount)} />
              <Stat label="Potongan" value={`- ${formatRupiah(result.deductionAmount)}`} />
              <Stat
                label="Min. Requirement"
                value={result.minimumRequirementApplied ? "Diterapkan" : "Tidak"}
              />
              <Stat label="Faktor Penyesuaian Pagu" value={Number(result.paguAdjustmentFactor).toFixed(3)} />
            </div>

            <div className="border-t border-gray-100 p-6">
              <a
                className="btn-primary"
                href={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"}/reports/periods/${periodId}/slip/${user.employeeId}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  // Slip download requires the Authorization header, which a
                  // plain anchor can't send — fetch as blob then trigger save.
                  e.preventDefault();
                  downloadSlip(periodId!, user.employeeId!);
                }}
              >
                <Download size={16} /> Unduh Slip Jaspel (PDF)
              </a>
            </div>
          </div>

          {lineItems.length > 0 && (
            <div className="card overflow-x-auto">
              <div className="border-b border-gray-100 px-5 py-3 font-medium text-gray-800">
                Rincian Komponen
              </div>
              {(() => {
                const { columns, rows } = toFriendlyRows(lineItems);
                return (
                  <table className="table-base">
                    <thead className="bg-gray-50">
                      <tr>
                        {columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row, i) => (
                        <tr key={i}>
                          {row.map((val, j) => (
                            <td key={j}>{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 font-semibold text-gray-900">{value}</div>
    </div>
  );
}

async function downloadSlip(periodId: string, employeeId: string) {
  const response = await apiClient.get(`/reports/periods/${periodId}/slip/${employeeId}`, {
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `slip-jaspel-${employeeId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
