import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';

export const config = {
  matcher: [
    /*
     * Protect everything except: the login page, static assets, and the
     * public auth API routes. Fine-grained per-role authorization still
     * happens server-side (page loaders + API route handlers) because
     * verifying the JWT signature needs the JWT_SECRET binding, which is
     * only reliably available inside the request context, not in every
     * middleware invocation ahead of static generation.
     */
    '/((?!login|api/auth/login|_next/static|_next/image|favicon.ico|assets).*)'
  ]
};

export function middleware(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith('/api');
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession) {
    if (isApi) {
      return NextResponse.json({ ok: false, error: 'Belum masuk (login diperlukan).' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
