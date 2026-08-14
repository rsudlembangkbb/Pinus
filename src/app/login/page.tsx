'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api-client';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/auth/login', { identifier, password });
      const next = params.get('next') ?? '/';
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-4">
      <div>
        <label className="label" htmlFor="identifier">
          Username atau Email
        </label>
        <input
          id="identifier"
          className="input"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Kata Sandi
        </label>
        <input
          id="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? 'Memproses...' : 'Masuk'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4"
      style={{ background: 'var(--pinus-gradient)' }}
    >
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold tracking-tight">PINUS</h1>
        <p className="mt-1 text-sm text-pinus-100">
          Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua
        </p>
        <p className="text-xs text-pinus-200">RSUD Lembang - Kabupaten Bandung Barat</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
