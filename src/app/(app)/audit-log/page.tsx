'use client';

import { Fragment, useEffect, useState } from 'react';
import { api } from '@/lib/api-client';

interface AuditLogRow {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: number;
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AuditLogRow[]>('/api/audit-log')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Jejak Audit</h1>
        <p className="text-sm text-slate-500">Pencatatan menyeluruh: siapa mengubah apa, kapan, dan nilai sebelum/sesudah.</p>
      </div>
      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : error ? (
          <p className="p-4 text-sm text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada aktivitas tercatat.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Entitas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td className="whitespace-nowrap">{new Date(r.createdAt * 1000).toLocaleString('id-ID')}</td>
                    <td>{r.actorName ?? '-'}</td>
                    <td>
                      <span className="badge bg-lembang-100 text-lembang-800">{r.action}</span>
                    </td>
                    <td>
                      {r.entityType}
                      {r.entityId ? ` #${r.entityId.slice(0, 12)}` : ''}
                    </td>
                    <td>
                      {(r.beforeJson || r.afterJson) && (
                        <button className="text-xs text-lembang-700 hover:underline" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                          {expanded === r.id ? 'Sembunyikan' : 'Detail'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === r.id && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50">
                        <div className="grid grid-cols-1 gap-2 p-3 text-xs sm:grid-cols-2">
                          {r.beforeJson && (
                            <div>
                              <p className="mb-1 font-medium text-slate-600">Sebelum</p>
                              <pre className="whitespace-pre-wrap break-all rounded bg-white p-2 text-slate-600">{prettyJson(r.beforeJson)}</pre>
                            </div>
                          )}
                          {r.afterJson && (
                            <div>
                              <p className="mb-1 font-medium text-slate-600">Sesudah</p>
                              <pre className="whitespace-pre-wrap break-all rounded bg-white p-2 text-slate-600">{prettyJson(r.afterJson)}</pre>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
