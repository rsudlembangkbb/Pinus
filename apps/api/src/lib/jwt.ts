import { jwtVerify, SignJWT } from "jose";
import type { RoleCode } from "@pinus/shared";

export interface AccessTokenPayload {
  sub: string; // user id
  role: RoleCode;
  employeeId: string | null;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ role: payload.role, employeeId: payload.employeeId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (typeof payload.sub !== "string" || typeof payload.role !== "string") return null;
    return {
      sub: payload.sub,
      role: payload.role as RoleCode,
      employeeId: (payload.employeeId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

/** Opaque refresh token: random bytes, only its SHA-256 hash is persisted. */
export function generateRefreshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
