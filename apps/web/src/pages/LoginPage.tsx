import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api-client";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk, silakan coba lagi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-lembang-900 via-lembang-800 to-pinus-800 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/pinus-mark.svg" alt="PINUS" className="mb-3 h-14 w-14" />
          <h1 className="text-lg font-semibold text-slate-900">PINUS</h1>
          <p className="mt-1 text-xs text-slate-500">
            Sistem Pembagian Insentif daN Jasa Pelayanan Untuk Semua
            <br />
            RSUD Lembang
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ErrorBanner message={error} />}
          <Field label="Email">
            <Input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@rsudlembang.go.id" />
          </Field>
          <Field label="Kata Sandi">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Memproses…" : "Masuk"}
          </Button>
        </form>
      </div>
    </div>
  );
}
