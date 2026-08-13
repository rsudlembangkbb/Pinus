import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Permission } from "@pinus/shared";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-6 w-6 text-pinus-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequirePermission({ perms, children }: { perms: Permission[]; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(...perms)) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        Anda tidak memiliki hak akses untuk membuka halaman ini.
      </div>
    );
  }
  return <>{children}</>;
}
