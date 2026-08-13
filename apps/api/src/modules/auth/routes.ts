import { and, eq, gt, isNull } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import { changePasswordSchema, loginSchema } from "@pinus/shared";
import { schema } from "../../db/client.js";
import type { AppEnv } from "../../lib/app-context.js";
import { clientIp, clientUserAgent, recordAudit } from "../../lib/audit.js";
import { Errors } from "../../lib/errors.js";
import { newId } from "../../lib/ids.js";
import { generateRefreshToken, hashToken, signAccessToken } from "../../lib/jwt.js";
import { hashPassword, verifyPassword } from "../../lib/password.js";
import { currentUser, loadAuthUser, requireAuth } from "../../middleware/auth.js";

const REFRESH_COOKIE = "pinus_rt";

function refreshCookieOptions(c: { env: Env }) {
  const isDev = c.env.APP_ENV === "development";
  return {
    httpOnly: true as const,
    secure: !isDev,
    sameSite: (isDev ? "Lax" : "None") as "Lax" | "None",
    path: "/api/auth",
  };
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data login tidak valid", body.error.flatten());

  const db = c.get("db");
  const ip = clientIp(c);
  const ua = clientUserAgent(c);

  const userRow = await db.query.users.findFirst({ where: eq(schema.users.email, body.data.email) });
  const ok = userRow ? await verifyPassword(body.data.password, userRow.passwordHash) : false;

  if (!userRow || !ok || !userRow.isActive) {
    await recordAudit(db, {
      actorUserId: userRow?.id ?? null,
      actorName: body.data.email,
      action: "LOGIN_FAILED",
      entityType: "user",
      entityId: userRow?.id ?? null,
      ipAddress: ip,
      userAgent: ua,
    });
    throw Errors.unauthorized("Email atau kata sandi salah");
  }

  const accessToken = await signAccessToken(
    { sub: userRow.id, role: userRow.roleCode as never, employeeId: userRow.employeeId },
    c.env.JWT_ACCESS_SECRET,
    Number(c.env.ACCESS_TOKEN_TTL_SECONDS),
  );

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = await hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + Number(c.env.REFRESH_TOKEN_TTL_SECONDS) * 1000).toISOString();
  await db.insert(schema.refreshTokens).values({
    id: newId(),
    userId: userRow.id,
    tokenHash: refreshTokenHash,
    expiresAt,
    userAgent: ua,
    ipAddress: ip,
  });

  await db.update(schema.users).set({ lastLoginAt: new Date().toISOString() }).where(eq(schema.users.id, userRow.id));
  await recordAudit(db, {
    actorUserId: userRow.id,
    actorName: userRow.fullName,
    action: "LOGIN",
    entityType: "user",
    entityId: userRow.id,
    ipAddress: ip,
    userAgent: ua,
  });

  setCookie(c, REFRESH_COOKIE, refreshToken, refreshCookieOptions(c));

  const user = await loadAuthUser(db, userRow.id);
  return c.json({ accessToken, user });
});

authRoutes.post("/refresh", async (c) => {
  const db = c.get("db");
  const token = getCookie(c, REFRESH_COOKIE);
  if (!token) throw Errors.unauthorized("Sesi tidak ditemukan, silakan login kembali");

  const tokenHash = await hashToken(token);
  const now = new Date().toISOString();
  const row = await db.query.refreshTokens.findFirst({
    where: and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt), gt(schema.refreshTokens.expiresAt, now)),
  });
  if (!row) {
    deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth" });
    throw Errors.unauthorized("Sesi kedaluwarsa, silakan login kembali");
  }

  // rotation: revoke the presented token, issue a fresh one
  await db.update(schema.refreshTokens).set({ revokedAt: now }).where(eq(schema.refreshTokens.id, row.id));

  const userRow = await db.query.users.findFirst({ where: eq(schema.users.id, row.userId) });
  if (!userRow || !userRow.isActive) {
    deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth" });
    throw Errors.unauthorized("Akun tidak ditemukan atau nonaktif");
  }

  const newRefreshToken = generateRefreshToken();
  const newExpiresAt = new Date(Date.now() + Number(c.env.REFRESH_TOKEN_TTL_SECONDS) * 1000).toISOString();
  await db.insert(schema.refreshTokens).values({
    id: newId(),
    userId: userRow.id,
    tokenHash: await hashToken(newRefreshToken),
    expiresAt: newExpiresAt,
    userAgent: clientUserAgent(c),
    ipAddress: clientIp(c),
  });
  setCookie(c, REFRESH_COOKIE, newRefreshToken, refreshCookieOptions(c));

  const accessToken = await signAccessToken(
    { sub: userRow.id, role: userRow.roleCode as never, employeeId: userRow.employeeId },
    c.env.JWT_ACCESS_SECRET,
    Number(c.env.ACCESS_TOKEN_TTL_SECONDS),
  );
  const user = await loadAuthUser(db, userRow.id);
  return c.json({ accessToken, user });
});

authRoutes.post("/logout", async (c) => {
  const db = c.get("db");
  const token = getCookie(c, REFRESH_COOKIE);
  if (token) {
    const tokenHash = await hashToken(token);
    await db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(and(eq(schema.refreshTokens.tokenHash, tokenHash), isNull(schema.refreshTokens.revokedAt)));
  }
  deleteCookie(c, REFRESH_COOKIE, { path: "/api/auth" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = currentUser(c);
  return c.json({ user });
});

authRoutes.post("/change-password", requireAuth, async (c) => {
  const user = currentUser(c);
  const body = changePasswordSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) throw Errors.validation("Data tidak valid", body.error.flatten());

  const db = c.get("db");
  const userRow = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
  if (!userRow) throw Errors.unauthorized();

  const ok = await verifyPassword(body.data.currentPassword, userRow.passwordHash);
  if (!ok) throw Errors.badRequest("Kata sandi saat ini salah");

  const newHash = await hashPassword(body.data.newPassword);
  await db
    .update(schema.users)
    .set({ passwordHash: newHash, mustChangePassword: false, updatedAt: new Date().toISOString() })
    .where(eq(schema.users.id, user.id));

  await recordAudit(db, {
    actorUserId: user.id,
    actorName: user.fullName,
    action: "UPDATE",
    entityType: "user_password",
    entityId: user.id,
    ipAddress: clientIp(c),
    userAgent: clientUserAgent(c),
  });

  return c.json({ ok: true });
});
