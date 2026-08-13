import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getPageSession } from '@/lib/auth/page-session';
import { getDb, schema } from '@/db';
import { ROLE_LABELS, RoleCode } from '@/lib/auth/roles';
import AppShell from '@/components/app-shell';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getPageSession();
  if (!session) redirect('/login');

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.sub)).limit(1);
  if (!user) redirect('/login');

  let workUnitName: string | null = null;
  if (user.workUnitId) {
    const [unit] = await db.select().from(schema.workUnits).where(eq(schema.workUnits.id, user.workUnitId)).limit(1);
    workUnitName = unit?.name ?? null;
  }

  const unreadNotifications = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user.id))
    .limit(50);
  const unreadCount = unreadNotifications.filter((n) => !n.isRead).length;

  return (
    <AppShell
      user={{
        username: user.username,
        role: session.role as RoleCode,
        roleLabel: ROLE_LABELS[session.role as RoleCode] ?? session.role,
        workUnitName,
        mustChangePassword: user.mustChangePassword
      }}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
