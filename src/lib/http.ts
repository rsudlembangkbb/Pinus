import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb, getEnv, schema } from '@/db';
import { SESSION_COOKIE, SessionPayload, verifySessionToken } from '@/lib/auth/session';
import { RoleCode } from '@/lib/auth/roles';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonOk<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json({ ok: true, data }, typeof init === 'number' ? { status: init } : init);
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * Resolves & verifies the current session from the request cookie, and
 * checks the token's embedded `tokenVersion` against the live value on the
 * user record so that revoking access (deactivating a user, changing
 * their role) takes effect immediately instead of waiting out the JWT's
 * remaining validity window.
 */
export async function requireSession(): Promise<SessionPayload> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError(401, 'Belum masuk (login diperlukan).');
  const env = await getEnv();
  const payload = await verifySessionToken(token, env.JWT_SECRET);
  if (!payload) throw new ApiError(401, 'Sesi tidak valid atau kedaluwarsa.');

  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.sub)).limit(1);
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, 'Sesi tidak valid atau telah dicabut. Silakan masuk kembali.');
  }
  return payload;
}

export function requireRole(session: SessionPayload, allowed: RoleCode[]) {
  if (!allowed.includes(session.role as RoleCode)) {
    throw new ApiError(403, 'Anda tidak memiliki wewenang untuk aksi ini.');
  }
}

const UNIQUE_FIELD_LABELS: Record<string, string> = {
  'work_units.code': 'Kode unit kerja',
  'job_grades.code': 'Kode job grade',
  'deduction_rules.code': 'Kode aturan potongan',
  'employees.nip': 'NIP',
  'users.username': 'Username',
  'users.email': 'Email',
  'calculation_periods.code': 'Kode periode',
  'employee_identity_mappings.source_system, employee_identity_mappings.external_code': 'Kombinasi sistem sumber + kode eksternal'
};

/** Extracts a human-readable message from a D1/SQLite UNIQUE constraint violation, or null if the error isn't one. */
function describeUniqueConstraintError(err: unknown): string | null {
  const message = err instanceof Error ? (err.cause instanceof Error ? err.cause.message : err.message) : String(err);
  const match = message.match(/UNIQUE constraint failed: ([\w., ]+)/);
  if (!match) return null;
  const field = match[1]!.trim();
  const label = UNIQUE_FIELD_LABELS[field] ?? field;
  return `${label} sudah digunakan - silakan gunakan nilai lain.`;
}

/** Wraps a route handler with uniform error -> JSON translation. */
export function withApi(handler: (req: NextRequest, ctx: any) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: any) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        return jsonError(err.message, err.status);
      }
      const uniqueMessage = describeUniqueConstraintError(err);
      if (uniqueMessage) {
        return jsonError(uniqueMessage, 409);
      }
      console.error('Unhandled API error', err);
      const debugDetail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      return jsonError(`Terjadi kesalahan pada server. [DEBUG ${debugDetail}]`, 500);
    }
  };
}

export function clientIp(req: NextRequest): string | undefined {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? undefined;
}
