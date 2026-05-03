export const runtime = 'nodejs';
export const maxDuration = 60;

import { MODELS } from '@/lib/models';
import { callModel, mapError, logOpenRouterError } from '@/lib/openrouter';
import { analyze } from '@/lib/analyze';

export async function POST(request: Request): Promise<Response> {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  // 2. Validate shape
  if (
    body === null ||
    typeof body !== 'object' ||
    !('brand' in body) ||
    !('query' in body) ||
    !('modelId' in body)
  ) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  const { brand, query, modelId } = body as Record<string, unknown>;

  if (typeof brand !== 'string' || brand.trim().length === 0) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (brand.trim().length > 60) {
    return Response.json({ error: 'brand too long' }, { status: 400 });
  }

  if (typeof query !== 'string' || query.trim().length === 0) {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  if (typeof modelId !== 'string') {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }

  // 3. Look up model
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) {
    return Response.json({ error: 'unknown model' }, { status: 400 });
  }

  // 4. Check env
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  // 5. Run callModel with 60s timeout
  const trimmedBrand = brand.trim();
  const trimmedQuery = query.trim();

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 60000);
  const start = Date.now();

  try {
    const { text, latencyMs } = await callModel(model.slug, trimmedQuery, ctrl.signal);
    clearTimeout(timeoutId);
    const a = analyze(trimmedBrand, text);
    return Response.json({ status: 'done', text, latencyMs, analysis: a });
  } catch (err) {
    clearTimeout(timeoutId);
    logOpenRouterError({ slug: model.slug, modelId: model.id }, err);
    return Response.json({
      status: 'error',
      error: mapError(err),
      latencyMs: Date.now() - start,
    });
  }
}
