'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti kata sandi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-xl font-semibold text-slate-800">Ganti Kata Sandi</h1>
      <form onSubmit={onSubmit} className="card space-y-4">
        <div>
          <label className="label">Kata Sandi Saat Ini</label>
          <input
            type="password"
            className="input"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Kata Sandi Baru</label>
          <input
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-slate-500">Minimal 10 karakter, kombinasi huruf besar, kecil, dan angka.</p>
        </div>
        <div>
          <label className="label">Konfirmasi Kata Sandi Baru</label>
          <input
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {success && (
          <p className="rounded-lg bg-pinus-50 px-3 py-2 text-sm text-pinus-800">
            Berhasil. Mengalihkan ke halaman masuk...
          </p>
        )}
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Memproses...' : 'Simpan'}
        </button>
      </form>
    </div>
  );
}
