import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCookie } from '@/lib/auth';

export default function proxy(request: NextRequest): Response {
  const cookie = request.cookies.get('aeo_auth')?.value;
  const ok = verifyCookie(cookie);
  if (ok) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // API routes → JSON 401, never HTML
  if (pathname.startsWith('/api/')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Page routes → 307 redirect to /
  return NextResponse.redirect(new URL('/', request.url), 307);
}

export const config = {
  matcher: ['/audit/:path*', '/api/run', '/api/cell'],
};
