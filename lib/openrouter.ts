import OpenAI from 'openai';

let _client: OpenAI | null = null;

export function getClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_KEY_MISSING');
  if (!_client)
    _client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  return _client;
}

// Detects an explicit count ("top 5", "best 10", "5 best", "top three") in the query.
// If none found, the system prompt asks for exactly 5 items.
const COUNT_RE = /\b(?:top|best|recommend(?:ed)?)\s+(\d+|three|four|five|six|seven|eight|nine|ten)\b|\b(\d+|three|four|five|six|seven|eight|nine|ten)\s+(?:best|top|recommended)\b/i;

function queryHasExplicitCount(query: string): boolean {
  return COUNT_RE.test(query);
}

const SYSTEM_PROMPT_BASE = [
  'You are an objective market analyst. Answer the user query with a numbered ranked list of brands or products.',
  '',
  'Neutrality requirements:',
  '- Treat the list as objective market reporting based on general consumer awareness and availability.',
  '- Do not express personal opinion, preference, or recommendation language ("I recommend", "my favorite", "I think", etc.).',
  '- Do not editorialize, hedge, or add disclaimers about choice being subjective.',
  '- Rank purely by typical market presence, brand recognition, and category authority — not by what you prefer.',
  '',
  'Format requirements (strict):',
  '- Begin output with "1." on the first line. No preamble, greeting, restatement of the query, or summary line before it.',
  '- One item per line, prefixed with "1.", "2.", etc., starting at 1 with no gaps.',
  '- Each line: brand or product name first, optionally followed by " — " and a brief factual descriptor (≤ 12 words).',
  '- No closing summary, conclusion, caveats, or follow-up question after the last item.',
  '- Do NOT emit <thinking>, <think>, [reasoning], or any reasoning/scratchpad tags or blocks anywhere in the response.',
  '- Do NOT emit headings (no "#", "##"), no horizontal rules, no quoted blocks.',
  '- No markdown other than the numbered list. No bold, no italics, no code fences, no bullet points.',
  '- Respond with the numbered list only — nothing before, nothing after.',
].join('\n');

function buildSystemPrompt(query: string): string {
  if (queryHasExplicitCount(query)) return SYSTEM_PROMPT_BASE;
  return SYSTEM_PROMPT_BASE + '\n- If the user did not specify a count, return exactly 5 items.';
}

export async function callModel(
  slug: string,
  query: string,
  signal: AbortSignal,
): Promise<{ text: string; latencyMs: number }> {
  const client = getClient();
  const t0 = Date.now();
  const response = await client.chat.completions.create(
    {
      model: slug,
      messages: [
        { role: 'system', content: buildSystemPrompt(query) },
        { role: 'user', content: query },
      ],
      temperature: 0.2,
      max_completion_tokens: 600,
    },
    { signal },
  );
  const latencyMs = Date.now() - t0;
  return { text: response.choices[0]?.message?.content ?? '', latencyMs };
}

/**
 * Server-side log line for an OpenRouter call failure.
 * Logs slug + status + safe message. Never logs API key, full headers, or request body.
 * Goes to stderr so Vercel surfaces it under Function Logs.
 */
export function logOpenRouterError(
  context: { slug: string; queryIdx?: number; modelId?: string },
  err: unknown,
): void {
  const e = err as {
    status?: unknown;
    headers?: Record<string, string> | Headers;
    error?: { message?: string; code?: string };
  } | null | undefined;
  const status = e && 'status' in e ? e.status : undefined;
  const name = err instanceof Error ? err.name : typeof err;

  // Pull rate-limit hints if OpenAI SDK attached the response headers
  let rateLimitInfo = '';
  if (e?.headers) {
    const h = e.headers instanceof Headers
      ? {
          remaining: e.headers.get('x-ratelimit-remaining'),
          reset: e.headers.get('x-ratelimit-reset'),
          retryAfter: e.headers.get('retry-after'),
        }
      : {
          remaining: e.headers['x-ratelimit-remaining'],
          reset: e.headers['x-ratelimit-reset'],
          retryAfter: e.headers['retry-after'],
        };
    const parts = [];
    if (h.remaining) parts.push(`remaining=${h.remaining}`);
    if (h.reset) parts.push(`reset=${h.reset}`);
    if (h.retryAfter) parts.push(`retry-after=${h.retryAfter}`);
    if (parts.length > 0) rateLimitInfo = ' ratelimit{' + parts.join(',') + '}';
  }

  // Surface OpenRouter's nested error message if present (e.g., "rate limit exceeded for model X")
  const upstreamMsg = e?.error?.message ?? '';

  // Trim raw exception message to 200 chars, strip any accidental key prefix
  let message = err instanceof Error ? err.message : String(err);
  if (upstreamMsg) message = `${message} | upstream: ${upstreamMsg}`;
  message = message.replace(/sk-or-[A-Za-z0-9-]+/g, '[REDACTED]').slice(0, 400);

  const ctx = [
    `slug=${context.slug}`,
    context.modelId ? `modelId=${context.modelId}` : '',
    context.queryIdx !== undefined ? `queryIdx=${context.queryIdx}` : '',
    `status=${status ?? 'n/a'}`,
    `name=${name}`,
  ]
    .filter(Boolean)
    .join(' ');
  console.error(`[openrouter] ${ctx}${rateLimitInfo} message="${message}"`);
}

export function mapError(err: unknown): string {
  if (
    err instanceof Error &&
    (err.name === 'AbortError' || (err instanceof DOMException && err.name === 'AbortError'))
  ) {
    return 'timeout';
  }

  if (err instanceof Error && err.message === 'OPENROUTER_KEY_MISSING') {
    return 'server misconfigured';
  }

  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status;
    if (status === 429) return 'rate limit — try again in a minute';
    if (status === 404) return 'model unavailable';
    if (typeof status === 'number' && (status >= 500 || (status >= 400 && status !== 404 && status !== 429))) {
      return 'upstream error';
    }
  }

  return 'upstream error';
}
