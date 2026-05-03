import { assertSecretsSet, signCookie, verifyPassword } from '@/lib/auth';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('password' in body) ||
    typeof (body as Record<string, unknown>).password !== 'string'
  ) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  const { password } = body as { password: string };

  try {
    assertSecretsSet();
  } catch {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  if (!verifyPassword(password)) {
    return Response.json({ error: 'invalid' }, { status: 401 });
  }

  const cookieValue = signCookie();
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `aeo_auth=${cookieValue}; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`,
    },
  });
}
