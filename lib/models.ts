import type { Model } from './types';

// Slugs verified live on https://openrouter.ai/api/v1/models (2026-05-03).
// Paid slugs (no :free suffix) — your account has credits, so we use the paid pools
// which have much higher rate limits and no free-tier throttling.
// Claude Sonnet 4.5 added as 6th model.
const MODELS_DATA = [
  { id: 'gemma',     label: 'Gemma 3 27B',             slug: 'google/gemma-3-27b-it' },
  { id: 'llama',     label: 'Llama 3.3 70B',           slug: 'meta-llama/llama-3.3-70b-instruct' },
  { id: 'qwen',      label: 'Qwen3 Next 80B',          slug: 'qwen/qwen3-next-80b-a3b-instruct' },
  { id: 'gpt-oss',   label: 'GPT-OSS 120B',            slug: 'openai/gpt-oss-120b' },
  { id: 'nemotron',  label: 'Nemotron 3 Super 120B',   slug: 'nvidia/nemotron-3-super-120b-a12b' },
  { id: 'claude',    label: 'Claude Sonnet 4.5',       slug: 'anthropic/claude-sonnet-4.5' },
] as const satisfies readonly Model[];

export const MODELS: readonly Model[] = Object.freeze(MODELS_DATA);

export type MODEL_IDS = (typeof MODELS_DATA)[number]['id'];
