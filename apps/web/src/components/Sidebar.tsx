"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRole } from "@pinus/shared";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  Building2,
  Percent,
  Layers,
  MinusCircle,
  UploadCloud,
  CalendarClock,
  FileBarChart,
  ShieldCheck,
  UserCog,
  Wallet,
} from "lucide-react";
import { CurrentUser } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  {
    href: "/dashboard/me",
    label: "Jaspel Saya",
    icon: Wallet,
    roles: [UserRole.PEGAWAI],
  },
  {
    href: "/dashboard/periods",
    label: "Periode & Kalkulasi",
    icon: CalendarClock,
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN_JASPEL,
      UserRole.VERIFIKATOR_UNIT,
      UserRole.KEUANGAN,
      UserRole.DIREKTUR,
      UserRole.AUDITOR,
    ],
  },
  {
    href: "/dashboard/import",
    label: "Impor Data SIMRS",
    icon: UploadCloud,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL],
  },
  {
    href: "/dashboard/master-data/employees",
    label: "Master Pegawai",
    icon: Users,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL],
  },
  {
    href: "/dashboard/master-data/work-units",
    label: "Master Unit Kerja",
    icon: Building2,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL],
  },
  {
    href: "/dashboard/master-data/proportion-schemes",
    label: "Skema Proporsi",
    icon: Percent,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL],
  },
  {
    href: "/dashboard/master-data/job-grades",
    label: "Job Grade & Bobot",
    icon: Layers,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL],
  },
  {
    href: "/dashboard/master-data/deduction-rules",
    label: "Aturan Pengurangan",
    icon: MinusCircle,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL],
  },
  {
    href: "/dashboard/reports",
    label: "Laporan & Ekspor",
    icon: FileBarChart,
    roles: [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN_JASPEL,
      UserRole.VERIFIKATOR_UNIT,
      UserRole.KEUANGAN,
      UserRole.DIREKTUR,
      UserRole.AUDITOR,
    ],
  },
  {
    href: "/dashboard/audit",
    label: "Audit Log",
    icon: ShieldCheck,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN_JASPEL, UserRole.AUDITOR],
  },
  {
    href: "/dashboard/users",
    label: "Manajemen Pengguna",
    icon: UserCog,
    roles: [UserRole.SUPER_ADMIN],
  },
];

export function Sidebar({ user }: { user: CurrentUser }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 shrink-0 flex-col bg-gradient-to-b from-pinus-900 to-lembang-900 text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-xl">🌲</div>
        <div>
          <div className="font-bold leading-tight">PINUS</div>
          <div className="text-[11px] text-pinus-200">RSUD Lembang</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-white/15 text-white" : "text-pinus-100 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
