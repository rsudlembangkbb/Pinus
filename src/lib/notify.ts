import { eq } from 'drizzle-orm';
import { getDb, schema, Db } from '@/db';
import { newId } from '@/lib/ids';
import { RoleCode } from '@/lib/auth/roles';

/** In-app notification per PRD 5.4.5. Creates one row per matching user. */
export async function notifyRole(
  db: Db,
  roleCode: RoleCode,
  title: string,
  body: string,
  link?: string,
  restrictToWorkUnitIds?: string[]
): Promise<void> {
  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, roleCode)).limit(1);
  if (!role) return;
  const users = await db.select().from(schema.users).where(eq(schema.users.roleId, role.id));

  const targets = restrictToWorkUnitIds
    ? users.filter((u) => u.workUnitId && restrictToWorkUnitIds.includes(u.workUnitId))
    : users;

  for (const user of targets) {
    await db.insert(schema.notifications).values({ id: newId('ntf'), userId: user.id, title, body, link: link ?? null });
  }
}

export async function notifyUser(db: Db, userId: string, title: string, body: string, link?: string): Promise<void> {
  await db.insert(schema.notifications).values({ id: newId('ntf'), userId, title, body, link: link ?? null });
}
