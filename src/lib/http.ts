import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEnv } from '@/db';
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

/** Resolves & verifies the current session from the request cookie. Throws ApiError(401) if absent/invalid. */
export async function requireSession(): Promise<SessionPayload> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) throw new ApiError(401, 'Belum masuk (login diperlukan).');
  const env = getEnv();
  const payload = await verifySessionToken(token, env.JWT_SECRET);
  if (!payload) throw new ApiError(401, 'Sesi tidak valid atau kedaluwarsa.');
  return payload;
}

export function requireRole(session: SessionPayload, allowed: RoleCode[]) {
  if (!allowed.includes(session.role as RoleCode)) {
    throw new ApiError(403, 'Anda tidak memiliki wewenang untuk aksi ini.');
  }
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
      console.error('Unhandled API error', err);
      return jsonError('Terjadi kesalahan pada server.', 500);
    }
  };
}

export function clientIp(req: NextRequest): string | undefined {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? undefined;
}
