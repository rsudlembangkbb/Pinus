"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileArchive, FileText } from "lucide-react";
import { UserRole } from "@pinus/shared";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { RoleGuard } from "@/components/RoleGuard";
import { Period } from "@/types/api";

function ReportsPageContent() {
  const { user } = useAuth();
  const [periodId, setPeriodId] = useState("");

  const { data: periods } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => (await apiClient.get<Period[]>("/periods")).data,
  });

  async function download(path: string, filename: string) {
    const response = await apiClient.get(path, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  const canBatchExport = user && [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL].includes(user.role);
  const canRawExport = canBatchExport;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Laporan & Ekspor</h1>
        <p className="text-sm text-gray-500">Unduh rekap dan dokumen pendukung penatausahaan Jaspel BLUD.</p>
      </div>

      <div className="card p-5">
        <label className="label">Periode</label>
        <select className="input max-w-sm" value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
          <option value="">Pilih periode…</option>
          {periods?.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {periodId && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ReportCard
            icon={<FileSpreadsheet size={24} />}
            title="Rekap per Unit Kerja (Excel)"
            description="Rekap hasil kalkulasi per unit untuk verifikasi Kepala Instalasi/Bagian Keuangan."
            onClick={() => download(`/reports/periods/${periodId}/unit-recap`, `rekap-unit-${periodId}.xlsx`)}
          />
          {canBatchExport && (
            <ReportCard
              icon={<FileArchive size={24} />}
              title="Slip Jaspel Massal (ZIP)"
              description="Kumpulan slip PDF seluruh pegawai dalam satu periode."
              onClick={() => download(`/reports/periods/${periodId}/slips-batch`, `slip-batch-${periodId}.zip`)}
            />
          )}
          {canRawExport && (
            <ReportCard
              icon={<FileText size={24} />}
              title="Data Mentah (Excel)"
              description="Transaksi layanan dan hasil kalkulasi mentah untuk audit/analisis lanjutan."
              onClick={() => download(`/reports/periods/${periodId}/raw-data`, `data-mentah-${periodId}.xlsx`)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="card p-5 text-left transition hover:border-pinus-300 hover:shadow-md">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-pinus-50 text-pinus-600">
        {icon}
      </div>
      <div className="font-medium text-gray-800">{title}</div>
      <div className="mt-1 text-xs text-gray-500">{description}</div>
    </button>
  );
}

export default function ReportsPage() {
  return (
    <RoleGuard
      roles={[
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_JASPEL,
        UserRole.VERIFIKATOR_UNIT,
        UserRole.KEUANGAN,
        UserRole.DIREKTUR,
        UserRole.AUDITOR,
      ]}
    >
      <ReportsPageContent />
    </RoleGuard>
  );
}
