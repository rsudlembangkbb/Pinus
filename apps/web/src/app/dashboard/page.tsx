"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { UserRole } from "@pinus/shared";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Period } from "@/types/api";
import { PeriodStatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";

export default function DashboardHomePage() {
  const { user } = useAuth();
  const isManagement = user && user.role !== UserRole.PEGAWAI;

  const { data: periods } = useQuery({
    queryKey: ["periods"],
    queryFn: async () => (await apiClient.get<Period[]>("/periods")).data,
    enabled: !!isManagement,
  });

  if (!isManagement) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="card p-8 text-center">
          <div className="mb-3 text-4xl">🌲</div>
          <h1 className="text-lg font-semibold text-gray-800">Selamat datang di PINUS</h1>
          <p className="mt-2 text-sm text-gray-500">
            Lihat rincian jasa pelayanan (Jaspel) Anda pada menu &ldquo;Jaspel Saya&rdquo;.
          </p>
          <Link href="/dashboard/me" className="btn-primary mt-4 inline-flex">
            Lihat Jaspel Saya
          </Link>
        </div>
      </div>
    );
  }

  const latest = periods?.[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Ringkasan</h1>
        <p className="text-sm text-gray-500">Status siklus bulanan pembagian Jaspel RSUD Lembang.</p>
      </div>

      {latest && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Periode Terbaru</div>
              <div className="text-lg font-semibold text-gray-900">{latest.name}</div>
            </div>
            <PeriodStatusBadge status={latest.status} />
          </div>
          <div className="mt-3 flex gap-4 text-sm text-gray-500">
            <span>Dibuka: {formatDate(latest.createdAt)}</span>
            {latest.calculatedAt && <span>Terakhir dikalkulasi: {formatDate(latest.calculatedAt)}</span>}
          </div>
          <Link href={`/dashboard/periods/${latest.id}`} className="btn-primary mt-4 inline-flex">
            Lihat Detail Periode
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Total Periode" value={periods?.length ?? 0} />
        <SummaryCard
          label="Menunggu Verifikasi"
          value={
            periods?.filter((p) =>
              ["UNIT_VERIFICATION", "FINANCE_VERIFICATION", "DIRECTOR_APPROVAL"].includes(p.status),
            ).length ?? 0
          }
        />
        <SummaryCard label="Terpublikasi" value={periods?.filter((p) => p.status === "PUBLISHED").length ?? 0} />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Periode</th>
              <th>Status</th>
              <th>Dibuka</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {periods?.map((p) => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td>
                  <PeriodStatusBadge status={p.status} />
                </td>
                <td>{formatDate(p.createdAt)}</td>
                <td>
                  <Link href={`/dashboard/periods/${p.id}`} className="text-pinus-700 hover:underline">
                    Lihat
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
