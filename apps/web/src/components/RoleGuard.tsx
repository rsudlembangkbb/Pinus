"use client";

import { UserRole } from "@pinus/shared";
import { useAuth } from "@/lib/auth-context";

export function RoleGuard({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="card p-8 text-center text-gray-500">
        Anda tidak memiliki akses ke halaman ini.
      </div>
    );
  }
  return <>{children}</>;
}
