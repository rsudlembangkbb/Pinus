import { redirect } from 'next/navigation';
import { getPageSession } from '@/lib/auth/page-session';
import { ROLES } from '@/lib/auth/roles';

const HOME_BY_ROLE: Record<string, string> = {
  [ROLES.PEGAWAI]: '/dashboard',
  [ROLES.VERIFIKATOR_UNIT]: '/periods',
  [ROLES.KEUANGAN]: '/periods',
  [ROLES.DIREKTUR]: '/management',
  [ROLES.AUDITOR]: '/audit-log',
  [ROLES.ADMIN_JASPEL]: '/periods',
  [ROLES.SUPER_ADMIN]: '/periods'
};

export default async function HomePage() {
  const session = await getPageSession();
  if (!session) redirect('/login');
  redirect(HOME_BY_ROLE[session.role] ?? '/periods');
}
