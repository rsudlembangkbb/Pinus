import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'pinus_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hour session timeout per NFR (6. Keamanan)

export interface SessionPayload {
  sub: string; // user id
  role: string; // role code
  roleId: string;
  workUnitId: string | null;
  employeeId: string | null;
  tokenVersion: number;
  name: string;
  [key: string]: unknown;
}

function getSecretKey(secret: string) {
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .setIssuer('pinus-rsud-lembang')
    .sign(getSecretKey(secret));
}

export async function verifySessionToken(token: string, secret: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(secret), { issuer: 'pinus-rsud-lembang' });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
