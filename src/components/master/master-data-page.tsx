'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import FieldForm, { FieldDef } from './field-form';

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => React.ReactNode;
}

export default function MasterDataPage<T extends { id: string }>({
  title,
  description,
  listUrl,
  createUrl,
  columns,
  fields,
  canCreate = true
}: {
  title: string;
  description?: string;
  listUrl: string;
  createUrl: string;
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  canCreate?: boolean;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api.get<T[]>(listUrl);
      setRows(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {canCreate && (
          <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'Tutup Formulir' : '+ Tambah'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <FieldForm
            fields={fields}
            onSubmit={async (values) => {
              await api.post(createUrl, values);
              setShowForm(false);
              await load();
            }}
          />
        </div>
      )}

      <div className="card overflow-x-auto">
        {loading ? (
          <p className="p-4 text-sm text-slate-500">Memuat...</p>
        ) : loadError ? (
          <p className="p-4 text-sm text-red-600">{loadError}</p>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Belum ada data.</p>
        ) : (
          <table className="table-base">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.header}>{c.header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.header}>{c.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
