import { createHmac, timingSafeEqual } from 'node:crypto';

function hmacSha256Hex(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function signCookie(): string {
  const secret = process.env.COOKIE_SECRET ?? '';
  return 'ok.' + hmacSha256Hex('ok', secret);
}

export function verifyCookie(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  const dotIndex = value.indexOf('.');
  if (dotIndex === -1) return false;
  const secret = process.env.COOKIE_SECRET;
  if (!secret) return false;
  const sig = value.slice(dotIndex + 1);
  const expected = hmacSha256Hex('ok', secret);
  if (sig.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export function verifyPassword(submitted: string): boolean {
  const stored = process.env.APP_PASSWORD;
  if (!stored) return false;
  const a = Buffer.from(submitted, 'utf8');
  const b = Buffer.from(stored, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function assertSecretsSet(): void {
  if (!process.env.APP_PASSWORD || !process.env.COOKIE_SECRET) {
    throw new Error('SERVER_MISCONFIGURED');
  }
}
