# AEO Diagnostic

A password-gated single-page Next.js app that takes 1–5 free-text queries plus a brand name, fires each query at 5 free LLMs in parallel via OpenRouter, and returns a side-by-side response grid (5 columns × N queries) with the user's brand highlighted in every cell, plus a live "Report Card" summarising how often and how highly the user's brand was recommended versus competitors.

No persistence, no accounts, no prompt templates, no hard-coded categories.

## Live

- URL: _set after Vercel deploy_
- Password: contact the maintainer (or check Vercel env var `APP_PASSWORD`)

## Stack

- Next.js 16.2.4 (App Router) + React 19.2.5 + TypeScript 6 strict
- Tailwind v4 (CSS-first, no `tailwind.config.ts`) + shadcn/ui
- `openai@6.35.0` configured for OpenRouter (`baseURL: https://openrouter.ai/api/v1`)
- `react-markdown@10` + `remark-gfm` + custom rehype plugin for `<mark>` brand highlighting
- HMAC-SHA256 signed cookie auth, no NextAuth, no DB
- Vitest 4 for analyzer + reportCard unit tests (68 tests)
- Vercel free tier deployment

## Architecture

| Layer | File |
|---|---|
| Password gate | `app/page.tsx`, `components/PasswordForm.tsx`, `app/api/auth/route.ts`, `app/api/logout/route.ts` |
| Cookie auth (HMAC) | `lib/auth.ts` |
| Route protection | `proxy.ts` (Next 16's renamed `middleware.ts`) |
| OpenRouter client | `lib/openrouter.ts` (lazy singleton, `mapError` helper) |
| Models list | `lib/models.ts` (frozen 5-entry array) |
| SSE fan-out | `app/api/run/route.ts` (`queries × 5` parallel, per-cell 60s timeout, single failure never aborts) |
| Single-cell retry | `app/api/cell/route.ts` |
| Pure regex analyzer | `lib/analyze.ts`, `lib/normalizeCompetitor.ts` |
| Report Card aggregator | `lib/reportCard.ts` |
| Brand `<mark>` highlight | `lib/rehypeHighlightBrand.ts` (rehype plugin, `unist-util-visit`) |
| UI (cells, grid, form) | `components/Cell.tsx`, `ResultsGrid.tsx`, `AuditForm.tsx`, `AuditClient.tsx`, `ReportCard.tsx` |

## Models

5 free OpenRouter slugs (verified live on `https://openrouter.ai/api/v1/models`):

```
google/gemma-4-26b-a4b-it:free
meta-llama/llama-3.3-70b-instruct:free
qwen/qwen3-next-80b-a3b-instruct:free
openai/gpt-oss-120b:free
nvidia/nemotron-3-super-120b-a12b:free
```

Order in `lib/models.ts` determines column order in the grid. If a slug 404s, the cell shows `model unavailable` and the run continues.

## Environment variables

Server-side only. Never prefixed with `NEXT_PUBLIC_`. Required for both local dev and production:

```
OPENROUTER_API_KEY=sk-or-v1-...
APP_PASSWORD=correct-horse-battery-staple
COOKIE_SECRET=any-32-char-random-string
APP_URL=http://localhost:3000
```

See `.env.local.example`. `.env.local` is gitignored.

On Vercel, set all four as **Encrypted** environment variables in the project settings (not Plain Text).

## Development

```bash
pnpm install
cp .env.local.example .env.local      # then fill in real values
pnpm dev                              # http://localhost:3000
pnpm test                             # 68 unit tests
pnpm lint                             # zero errors
pnpm build                            # production build (runs prebuild secret audit)
```

## Hard secret-handling rules (enforced)

- `OPENROUTER_API_KEY`, `APP_PASSWORD`, `COOKIE_SECRET` are read **only** inside `lib/auth.ts`, `lib/openrouter.ts`, and `app/api/**/route.ts`.
- All LLM calls happen server-side. The client never holds or transmits the OpenRouter key.
- SSE event payloads emit only curated error strings from a fixed enum (`'timeout'`, `'rate limit — try again in a minute'`, `'upstream error'`, `'model unavailable'`, `'server misconfigured'`) — never raw exception text.
- The brand string is **never** included in the prompt sent to any model. It's used only post-hoc by `analyze(brand, response)` for highlighting and ranking.
- `scripts/check-secrets.sh` runs as a `prebuild` hook and fails the build if any forbidden file references the env vars.

## Design decisions

- **16 source files instead of PRD's 15**: PRD §14 listed `middleware.ts` as the auth-protection file; Next 16 renamed that convention to `proxy.ts`. We also added `app/api/cell/route.ts` to support the F-D5 single-cell retry button (PRD's only run endpoint takes a full batch, which would be wasteful for retry). Both deviations are documented in `openspec/changes/build-aeo-diagnostic-mvp/design.md` decisions D5 and D13.
- **`max_completion_tokens` instead of `max_tokens`**: openai SDK v6 deprecated `max_tokens` in favor of `max_completion_tokens`. PRD §F-R3 specified `max_tokens: 600`; we use the non-deprecated equivalent.
- **Best/worst model**: best = most #1 ranks (tiebreak by mention count); worst = fewest mentions (tiebreak by worst average rank). See `openspec/.../specs/response-analysis/spec.md`.
- **Competitor dedupe**: lowercase + strip generic legal suffixes (`Inc`, `LLC`, `Corp`, `Ltd`, `Co`, `Company`, `Brands`) only. Product-category words (`magnesium`, `vitamin`, etc.) are NOT stripped, preserving the PRD's "no vertical lock-in" constraint. This means `'Calm'` and `'Calm Magnesium'` count as distinct competitors.
- **Reading secrets at request time, not module load**: `lib/auth.ts` reads `COOKIE_SECRET` inside each function call, not via a module-level `const`, so build-time env evaluation can't bake in stale values and Vercel's runtime env vars take effect immediately.

## What I'd build next

- Persistence: Postgres + a "saved runs" view so a founder can compare brand visibility week-over-week.
- Custom prompt templates per vertical (e-comm, B2B, healthcare) with per-template recommended models.
- Auto-suggested competitor list seeded from the user's first run, editable for subsequent runs.
- Better error retry: distinguish transient from permanent failures, exponential backoff per cell.
- Slack/email digest of weekly brand-mention rate.

## Repository layout

```
aeo-diagnostic/
├── app/
│   ├── layout.tsx, globals.css
│   ├── page.tsx                    # password gate
│   ├── audit/page.tsx              # main app
│   └── api/
│       ├── auth/route.ts           # POST: HMAC-cookie auth
│       ├── logout/route.ts         # POST: clear cookie
│       ├── run/route.ts            # POST: SSE stream of N×5 cells
│       └── cell/route.ts           # POST: single-cell retry (JSON)
├── components/
│   ├── PasswordForm.tsx, LogoutButton.tsx
│   ├── AuditForm.tsx, AuditClient.tsx (SSE consumer + state owner)
│   ├── ResultsGrid.tsx, Cell.tsx
│   ├── ReportCard.tsx
│   └── ui/                          # shadcn primitives
├── lib/
│   ├── auth.ts                      # HMAC sign/verify + verifyPassword + assertSecretsSet
│   ├── models.ts                    # frozen MODELS array
│   ├── openrouter.ts                # client + callModel + mapError
│   ├── analyze.ts, normalizeCompetitor.ts
│   ├── reportCard.ts
│   ├── rehypeHighlightBrand.ts
│   └── types.ts
├── proxy.ts                         # Next 16's renamed middleware
├── scripts/check-secrets.sh         # prebuild secret audit
├── openspec/                        # change proposals + spec deltas
├── .env.local.example
└── README.md
```
