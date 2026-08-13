import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, ErrorBanner, Field, Input, PageHeader } from "@/components/ui";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirm) {
      setError("Konfirmasi kata sandi baru tidak cocok");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      await refreshUser();
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mengubah kata sandi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Ubah Kata Sandi" description="Untuk keamanan akun Anda, silakan ganti kata sandi sementara ini." />
      <Card className="p-5">
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && <ErrorBanner message={error} />}
          <Field label="Kata Sandi Saat Ini">
            <Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </Field>
          <Field label="Kata Sandi Baru" hint="Minimal 8 karakter">
            <Input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Field label="Konfirmasi Kata Sandi Baru">
            <Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Menyimpan…" : "Simpan Kata Sandi"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
