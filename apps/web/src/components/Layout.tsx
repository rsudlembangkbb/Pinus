import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ROLE_LABELS } from "@pinus/shared";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

interface NavItem {
  to: string;
  label: string;
  perm?: Parameters<ReturnType<typeof useAuth>["hasPermission"]>;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "📊", perm: ["dashboard.management.read"] },
  { to: "/my", label: "Jaspel Saya", icon: "🧾", perm: ["self.dashboard.read"] },
  { to: "/periods", label: "Periode & Kalkulasi", icon: "🗓️", perm: ["workflow.read"] },
  { to: "/import", label: "Impor Data SIMRS", icon: "📥", perm: ["import.read"] },
  { to: "/master/employees", label: "Master Pegawai", icon: "🧑‍⚕️", perm: ["master.employee.read"] },
  { to: "/master/work-units", label: "Master Unit Kerja", icon: "🏥", perm: ["master.work_unit.read"] },
  { to: "/master/proportion-schemes", label: "Skema Proporsi", icon: "⚖️", perm: ["master.proportion_scheme.read"] },
  { to: "/master/job-grades", label: "Job Grade & Indeksing", icon: "🏷️", perm: ["master.job_grade.read"] },
  { to: "/master/deduction-rules", label: "Aturan Pengurangan", icon: "➖", perm: ["master.deduction_rule.read"] },
  { to: "/reports", label: "Laporan & Ekspor", icon: "📤", perm: ["report.export"] },
  { to: "/users", label: "Pengguna & Peran", icon: "👥", perm: ["user.read"] },
  { to: "/audit", label: "Audit Log", icon: "🔍", perm: ["audit.read"] },
];

export function Layout() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: notifData } = useNotifications();
  const location = useLocation();

  if (!user) return null;
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.perm || hasPermission(...item.perm));

  const sidebar = (
    <nav className="flex h-full flex-col bg-lembang-900 text-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <img src="/pinus-mark.svg" alt="PINUS" className="h-8 w-8" />
        <div>
          <p className="text-sm font-semibold leading-tight">PINUS</p>
          <p className="text-[10px] leading-tight text-lembang-200">RSUD Lembang</p>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive ? "bg-pinus-600 text-white" : "text-lembang-100 hover:bg-lembang-800"
              }`
            }
          >
            <span aria-hidden>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-lembang-800 px-4 py-3">
        <p className="truncate text-xs font-medium text-white">{user.fullName}</p>
        <p className="truncate text-[11px] text-lembang-200">{ROLE_LABELS[user.roleCode]}</p>
        <button
          onClick={() => logout().then(() => navigate("/login"))}
          className="mt-2 w-full rounded-md bg-lembang-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-lembang-700"
        >
          Keluar
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-full">
      <div className="hidden w-64 shrink-0 md:block">{sidebar}</div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <button className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden" onClick={() => setSidebarOpen(true)}>
            ☰
          </button>
          <div className="hidden md:block" />
          <NavLink to="/notifications" className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100">
            🔔
            {!!notifData?.unreadCount && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {notifData.unreadCount > 9 ? "9+" : notifData.unreadCount}
              </span>
            )}
          </NavLink>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
