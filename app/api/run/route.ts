export const runtime = 'nodejs';
// Sequential calls: 25 cells × ~3s = ~75s worst-case. Vercel Hobby caps at 60s
// (deploy will warn but accept); Pro accepts up to 300s.
export const maxDuration = 300;

import { MODELS } from '@/lib/models';
import { callModel, mapError, logOpenRouterError } from '@/lib/openrouter';
import { analyze } from '@/lib/analyze';

interface RequestBody {
  brand: unknown;
  queries: unknown;
}

export async function POST(request: Request): Promise<Response> {
  // Step 1: Parse and validate body
  let body: RequestBody;
  try {
    const raw: unknown = await request.json();
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return Response.json({ error: 'invalid body' }, { status: 400 });
    }
    body = raw as RequestBody;
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  // Validate brand
  if (typeof body.brand !== 'string' || body.brand.trim().length === 0) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  const brand = body.brand.trim();
  if (brand.length > 60) {
    return Response.json({ error: 'brand too long' }, { status: 400 });
  }

  // Validate queries
  if (!Array.isArray(body.queries)) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  const rawQueries: unknown[] = body.queries;
  if (!rawQueries.every((q): q is string => typeof q === 'string')) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  const queries: string[] = rawQueries.map((q) => q.trim()).filter((q) => q.length > 0);

  if (queries.length === 0) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  if (queries.length > 5) {
    return Response.json({ error: 'too many queries' }, { status: 400 });
  }

  // Step 2: Server config check
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  // Step 3: Build pairs
  const pairs = queries.flatMap((q, qi) =>
    MODELS.map((m) => ({ qi, modelId: m.id, slug: m.slug, q })),
  );

  // Step 4: Construct ReadableStream — one worker per model (parallel across models,
  // sequential within a single model's queue). With N models this gives us at most
  // N concurrent upstream calls — each model has its own rate-limit pool, so they
  // don't contend with each other.
  const encoder = new TextEncoder();
  const inflight = new Set<AbortController>();
  let closed = false;

  // Group pairs by model so each worker processes one model's queue
  const pairsByModel = new Map<string, typeof pairs>();
  for (const p of pairs) {
    const arr = pairsByModel.get(p.modelId) ?? [];
    arr.push(p);
    pairsByModel.set(p.modelId, arr);
  }

  const stream = new ReadableStream({
    start(controller) {
      const enqueue = (event: object): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may have been closed by cancel()
        }
      };

      const runOne = async (pair: (typeof pairs)[number]) => {
        if (closed) return;
        const { qi, modelId, slug, q } = pair;
        const ctrl = new AbortController();
        inflight.add(ctrl);
        const timeoutId = setTimeout(() => ctrl.abort(), 60000);
        const start = Date.now();
        try {
          const { text, latencyMs } = await callModel(slug, q, ctrl.signal);
          const a = analyze(brand, text);
          enqueue({
            queryIdx: qi,
            modelId,
            status: 'done',
            text,
            latencyMs,
            mentioned: a.mentioned,
            rank: a.rank,
            competitors: a.competitors,
          });
        } catch (err) {
          logOpenRouterError({ slug, queryIdx: qi, modelId }, err);
          enqueue({
            queryIdx: qi,
            modelId,
            status: 'error',
            error: mapError(err),
            latencyMs: Date.now() - start,
          });
        } finally {
          clearTimeout(timeoutId);
          inflight.delete(ctrl);
        }
      };

      // One worker per model — runs its queue sequentially. Across models, fully parallel.
      const workers = Array.from(pairsByModel.values()).map(async (modelPairs) => {
        for (const pair of modelPairs) {
          if (closed) break;
          await runOne(pair);
        }
      });

      Promise.allSettled(workers).then(() => {
        enqueue({ done: true });
        if (!closed) {
          closed = true;
          try { controller.close(); } catch {}
        }
      });
    },
    cancel() {
      // Client disconnected — abort all in-flight upstream calls so we stop
      // burning OpenRouter quota and Vercel function time.
      closed = true;
      for (const ctrl of inflight) ctrl.abort();
      inflight.clear();
    },
  });

  // Step 5: Return Response with SSE headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
