"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiErrorMessage } from "@/lib/api-client";

export default function LoginPage() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(apiErrorMessage(err, "Login gagal. Periksa kembali email/username dan password Anda."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-pinus-900 via-pinus-800 to-lembang-900 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl">
            🌲
          </div>
          <h1 className="text-2xl font-bold text-white">PINUS</h1>
          <p className="mt-1 text-sm text-pinus-100">
            Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua
          </p>
          <p className="text-xs text-pinus-200">RSUD Lembang — Kabupaten Bandung Barat</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="identifier">
              Email atau Username
            </label>
            <input
              id="identifier"
              className="input"
              type="text"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? "Memproses…" : "Masuk"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-pinus-200">
          Hubungi Super Admin/IT jika Anda lupa kata sandi atau belum memiliki akun.
        </p>
      </div>
    </div>
  );
}
