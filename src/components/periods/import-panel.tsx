'use client';

import { useRef, useState } from 'react';
import { IMPORT_SOURCES } from '@/lib/constants';
import { api } from '@/lib/api-client';

interface ImportBatch {
  id: string;
  source: string;
  fileName: string;
  status: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: number;
}

interface UploadResult {
  batchId: string;
  totalRows: number;
  successRows?: number;
  created?: number;
  updated?: number;
  failedRows: number;
  unmatchedIdentities?: number;
  sampleErrors: { rowNumber: number; column?: string; message: string }[];
}

export default function ImportPanel({ periodId, batches, onChanged }: { periodId: string; batches: ImportBatch[]; onChanged: () => void }) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  async function handleUpload(source: string) {
    const input = fileInputs.current[source];
    const file = input?.files?.[0];
    if (!file) {
      setError('Pilih berkas terlebih dahulu.');
      return;
    }
    setUploading(source);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('periodId', periodId);
      const endpoint = `/api/import/${source.replace('_', '-')}`;
      const res = await api.upload<UploadResult>(endpoint, form);
      setResult(res);
      onChanged();
      if (input) input.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah berkas.');
    } finally {
      setUploading(null);
    }
  }

  const batchBySource = (source: string) => batches.filter((b) => b.source === source);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Unggah data bulanan dari setiap sumber. Unduh template terlebih dahulu agar format kolom sesuai. Baris yang
        gagal validasi tidak menggagalkan keseluruhan proses - perbaiki dan unggah ulang.
      </p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {result && (
        <div className="card border-lembang-200 bg-lembang-50">
          <p className="text-sm font-medium text-lembang-900">
            {result.totalRows} baris diproses - {result.successRows ?? (result.created ?? 0) + (result.updated ?? 0)} berhasil,{' '}
            {result.failedRows} gagal
            {result.unmatchedIdentities ? `, ${result.unmatchedIdentities} tidak terpetakan identitasnya` : ''}.
          </p>
          {result.sampleErrors.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-red-700">
              {result.sampleErrors.map((e, i) => (
                <li key={i}>
                  Baris {e.rowNumber}{e.column ? ` (${e.column})` : ''}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {IMPORT_SOURCES.map((source) => {
          const history = batchBySource(source.value);
          return (
            <div key={source.value} className="card">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">{source.label}</h3>
                <a className="text-xs text-lembang-700 hover:underline" href={`/api/import/template/${source.value}`}>
                  Unduh Template
                </a>
              </div>
              <div className="flex items-center gap-2">
                <input
                  ref={(el) => {
                    fileInputs.current[source.value] = el;
                  }}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-pinus-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-pinus-800"
                />
                <button className="btn-secondary shrink-0" disabled={uploading === source.value} onClick={() => handleUpload(source.value)}>
                  {uploading === source.value ? 'Mengunggah...' : 'Unggah'}
                </button>
              </div>
              {history.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {history.map((b) => (
                    <li key={b.id} className="flex justify-between">
                      <span className="truncate">{b.fileName}</span>
                      <span>
                        {b.successRows}/{b.totalRows} ok, {b.failedRows} gagal
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
