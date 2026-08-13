import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuditAction, AuditLog } from "@pinus/shared";
import { Column, DataTable } from "@/components/DataTable";
import { Badge, Field, Input, Modal, PageHeader, Select } from "@/components/ui";
import { api } from "@/lib/api-client";

const ACTION_TONE: Record<string, "green" | "red" | "amber" | "blue" | "slate"> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  APPROVE: "green",
  REJECT: "red",
  LOCK: "amber",
  UNLOCK: "amber",
  LOGIN: "slate",
  LOGIN_FAILED: "red",
  LOGOUT: "slate",
  EXPORT: "blue",
  IMPORT_COMMIT: "green",
  CALCULATE: "blue",
};

export function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, entityType, action],
    queryFn: () =>
      api.get<{ items: AuditLog[]; total: number; page: number; pageSize: number }>(
        `/audit?page=${page}${entityType ? `&entityType=${entityType}` : ""}${action ? `&action=${action}` : ""}`,
      ),
  });

  const columns: Column<AuditLog>[] = [
    { key: "time", header: "Waktu", render: (r) => r.createdAt.slice(0, 19).replace("T", " ") },
    { key: "actor", header: "Pengguna", render: (r) => r.actorName },
    { key: "action", header: "Aksi", render: (r) => <Badge tone={ACTION_TONE[r.action] ?? "slate"}>{r.action}</Badge> },
    { key: "entity", header: "Entitas", render: (r) => <span className="font-mono text-xs">{r.entityType}</span> },
    {
      key: "detail",
      header: "",
      className: "text-right",
      render: (r) => (
        <button className="text-xs font-medium text-lembang-700 hover:underline" onClick={() => setSelected(r)}>
          Detail
        </button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Audit Log" description="Jejak audit menyeluruh atas perubahan data, parameter, dan keputusan approval." />

      <div className="mb-3 flex flex-wrap gap-3">
        <Field label="Jenis Entitas">
          <Input placeholder="mis. employee, calculation_period" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} />
        </Field>
        <Field label="Aksi">
          <Select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="w-48">
            <option value="">Semua aksi</option>
            {Object.keys(ACTION_TONE).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        keyFor={(r) => r.id}
        loading={isLoading}
        total={data?.total}
        page={page}
        pageSize={data?.pageSize ?? 25}
        onPageChange={setPage}
        emptyTitle="Tidak ada entri audit log"
      />

      {selected && (
        <Modal open onClose={() => setSelected(null)} title="Detail Audit Log">
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-slate-500">Waktu:</span> {selected.createdAt}
            </p>
            <p>
              <span className="text-slate-500">Pengguna:</span> {selected.actorName}
            </p>
            <p>
              <span className="text-slate-500">Aksi:</span> {selected.action}
            </p>
            <p>
              <span className="text-slate-500">Entitas:</span> {selected.entityType} {selected.entityId ?? ""}
            </p>
            <div>
              <p className="mb-1 text-slate-500">Sebelum</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(selected.before, null, 2) ?? "-"}</pre>
            </div>
            <div>
              <p className="mb-1 text-slate-500">Sesudah</p>
              <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(selected.after, null, 2) ?? "-"}</pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
