'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import { ROLES, RoleCode } from '@/lib/auth/roles';
import { api } from '@/lib/api-client';

interface NavItem {
  href: string;
  label: string;
  roles: RoleCode[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Jaspel Saya', roles: [ROLES.PEGAWAI] },
  {
    href: '/management',
    label: 'Dashboard Manajemen',
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_JASPEL, ROLES.KEUANGAN, ROLES.DIREKTUR, ROLES.AUDITOR]
  },
  {
    href: '/periods',
    label: 'Periode & Kalkulasi',
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_JASPEL, ROLES.VERIFIKATOR_UNIT, ROLES.KEUANGAN, ROLES.DIREKTUR]
  },
  { href: '/master/work-units', label: 'Unit Kerja', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/employees', label: 'Data Pegawai', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/job-grades', label: 'Job Grade', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/indexing-weights', label: 'Bobot Indeksing', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/proportion-schemes', label: 'Skema Proporsi', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/deduction-rules', label: 'Aturan Potongan', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/minimum-requirements', label: 'Pendapatan Minimum', roles: [ROLES.SUPER_ADMIN] },
  { href: '/master/identity-mappings', label: 'Pemetaan Identitas', roles: [ROLES.SUPER_ADMIN] },
  { href: '/users', label: 'Pengguna & Peran', roles: [ROLES.SUPER_ADMIN] },
  {
    href: '/reports',
    label: 'Laporan & Ekspor',
    roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN_JASPEL, ROLES.KEUANGAN, ROLES.DIREKTUR]
  },
  {
    href: '/audit-log',
    label: 'Jejak Audit',
    roles: [ROLES.SUPER_ADMIN, ROLES.DIREKTUR, ROLES.AUDITOR]
  }
];

interface AppShellUser {
  username: string;
  role: RoleCode;
  roleLabel: string;
  workUnitName: string | null;
  mustChangePassword: boolean;
}

export default function AppShell({
  user,
  unreadCount,
  children
}: {
  user: AppShellUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const items = NAV_ITEMS.filter((i) => i.roles.includes(user.role));

  async function logout() {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
    } finally {
      router.push('/login');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside
          className={clsx(
            'fixed inset-y-0 left-0 z-30 w-64 transform bg-pinus-900 text-white transition-transform lg:static lg:translate-x-0',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex h-16 items-center gap-2 border-b border-pinus-800 px-5">
            <span className="text-xl font-bold">PINUS</span>
          </div>
          <nav className="space-y-1 px-3 py-4">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname?.startsWith(item.href) ? 'bg-pinus-700 text-white' : 'text-pinus-100 hover:bg-pinus-800'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
            <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)}>
              <span aria-hidden>&#9776;</span>
              <span className="sr-only">Buka menu</span>
            </button>
            <div className="hidden text-sm text-slate-500 lg:block">
              {user.workUnitName ? `Unit: ${user.workUnitName}` : 'RSUD Lembang'}
            </div>
            <div className="flex items-center gap-4">
              <Link href="/notifications" className="relative rounded-lg p-2 hover:bg-slate-100" aria-label="Notifikasi">
                <span aria-hidden>&#128276;</span>
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <div className="text-right text-sm">
                <div className="font-medium text-slate-800">{user.username}</div>
                <div className="text-xs text-slate-500">{user.roleLabel}</div>
              </div>
              <button className="btn-outline" onClick={logout} disabled={loggingOut}>
                Keluar
              </button>
            </div>
          </header>
          {user.mustChangePassword && (
            <div className="bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 lg:px-6">
              Anda menggunakan kata sandi sementara. Segera{' '}
              <Link href="/account/change-password" className="font-semibold underline">
                ganti kata sandi
              </Link>
              .
            </div>
          )}
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
