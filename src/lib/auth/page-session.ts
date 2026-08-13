import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb, getEnv, schema } from '@/db';
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from './session';

/** Same validation as requireSession() in lib/http.ts, but returns null instead of throwing - for use in Server Components/pages. */
export async function getPageSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const env = await getEnv();
  const payload = await verifySessionToken(token, env.JWT_SECRET);
  if (!payload) return null;

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1);
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) return null;

  return payload;
}
