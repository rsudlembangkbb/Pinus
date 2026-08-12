"use client";

import { LogOut } from "lucide-react";
import { ROLE_LABELS } from "@pinus/shared";
import { CurrentUser, useAuth } from "@/lib/auth-context";

export function Topbar({ user }: { user: CurrentUser }) {
  const { logout } = useAuth();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <div>
        <div className="text-sm font-semibold text-gray-800">
          {user.employee?.fullName ?? user.username}
        </div>
        <div className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</div>
      </div>
      <button onClick={logout} className="btn-secondary text-xs">
        <LogOut size={14} /> Keluar
      </button>
    </header>
  );
}
