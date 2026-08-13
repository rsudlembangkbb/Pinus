'use client';

import { FormEvent, useState } from 'react';

export type FieldDef =
  | { name: string; label: string; type: 'text' | 'number' | 'date'; required?: boolean; placeholder?: string }
  | { name: string; label: string; type: 'select'; required?: boolean; options: { value: string; label: string }[] }
  | { name: string; label: string; type: 'checkbox' };

export default function FieldForm({
  fields,
  onSubmit,
  submitLabel = 'Simpan'
}: {
  fields: FieldDef[];
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function setValue(name: string, value: unknown) {
    setValues((v) => ({ ...v, [name]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onSubmit(values);
      setValues({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.name} className={f.type === 'checkbox' ? 'flex items-center gap-2 pt-6' : ''}>
          {f.type === 'checkbox' ? (
            <>
              <input
                id={f.name}
                type="checkbox"
                checked={Boolean(values[f.name])}
                onChange={(e) => setValue(f.name, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor={f.name} className="text-sm text-slate-700">
                {f.label}
              </label>
            </>
          ) : f.type === 'select' ? (
            <>
              <label className="label">{f.label}</label>
              <select
                className="input"
                required={f.required}
                value={(values[f.name] as string) ?? ''}
                onChange={(e) => setValue(f.name, e.target.value)}
              >
                <option value="" disabled>
                  Pilih...
                </option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <>
              <label className="label">{f.label}</label>
              <input
                type={f.type}
                className="input"
                required={f.required}
                placeholder={f.placeholder}
                value={(values[f.name] as string) ?? ''}
                onChange={(e) => setValue(f.name, f.type === 'number' ? Number(e.target.value) : e.target.value)}
              />
            </>
          )}
        </div>
      ))}
      <div className="sm:col-span-2">
        {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Menyimpan...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
