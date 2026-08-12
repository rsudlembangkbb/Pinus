"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserRole } from "@pinus/shared";
import { apiClient } from "@/lib/api-client";
import { AuditLogEntry } from "@/types/api";
import { RoleGuard } from "@/components/RoleGuard";
import { formatDateTime } from "@/lib/format";

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-pinus-100 text-pinus-700",
  CREATE_VERSION: "bg-pinus-100 text-pinus-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DEACTIVATE: "bg-gray-100 text-gray-600",
  APPROVE: "bg-pinus-100 text-pinus-700",
  REJECT: "bg-red-100 text-red-700",
  LOGIN: "bg-gray-100 text-gray-600",
  LOGIN_FAILED: "bg-red-100 text-red-700",
  CALCULATE: "bg-indigo-100 text-indigo-700",
  PUBLISH: "bg-lembang-100 text-lembang-700",
};

function AuditLogPageContent() {
  const [entityType, setEntityType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", entityType],
    queryFn: async () =>
      (
        await apiClient.get<{ items: AuditLogEntry[]; total: number }>("/audit-logs", {
          params: { entityType: entityType || undefined, take: 100 },
        })
      ).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500">
          Jejak audit menyeluruh: siapa mengubah apa, kapan, dan nilai sebelum/sesudah.
        </p>
      </div>

      <div className="card p-4">
        <select className="input max-w-xs" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
          <option value="">Semua entitas</option>
          <option value="Employee">Pegawai</option>
          <option value="WorkUnit">Unit Kerja</option>
          <option value="ProportionScheme">Skema Proporsi</option>
          <option value="DeductionRule">Aturan Pengurangan</option>
          <option value="CalculationPeriod">Periode Kalkulasi</option>
          <option value="ApprovalStep">Tahap Approval</option>
          <option value="User">Pengguna</option>
          <option value="ImportBatch">Impor Data</option>
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base">
          <thead className="bg-gray-50">
            <tr>
              <th>Waktu</th>
              <th>Aktor</th>
              <th>Aksi</th>
              <th>Entitas</th>
              <th>ID Entitas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-400">Memuat…</td>
              </tr>
            )}
            {data?.items.map((log) => (
              <tr key={log.id}>
                <td className="text-xs">{formatDateTime(log.createdAt)}</td>
                <td>{log.actor?.username ?? "Sistem"}</td>
                <td>
                  <span className={`badge ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600"}`}>
                    {log.action}
                  </span>
                </td>
                <td>{log.entityType}</td>
                <td className="font-mono text-xs text-gray-400">{log.entityId?.slice(0, 8) ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <RoleGuard roles={[UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL, UserRole.AUDITOR]}>
      <AuditLogPageContent />
    </RoleGuard>
  );
}
