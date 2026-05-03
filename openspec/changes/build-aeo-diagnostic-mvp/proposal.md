## Why

Founders and marketers have no quick way to see whether 5 different LLMs recommend their brand for buyer-intent queries, and how they rank against competitors. The AEO Diagnostic MVP is a 1–2 evening, password-gated tool that fans out 1–5 user queries to 5 free OpenRouter models in parallel, streams results back over SSE, and renders a side-by-side grid plus a live Report Card scoring brand mention rate, average rank, and top competitors. It also serves as a portfolio assignment demonstrating Next.js App Router, server-side LLM orchestration, SSE streaming, and HMAC cookie auth.

## What Changes

- New Next.js 15 (App Router) + React 19 + TS strict + Tailwind 4 + shadcn/ui project, deployable to Vercel free tier, ~15 source files.
- HMAC-signed cookie gate: `/` password form, `/api/auth`, `/api/logout`, `proxy.ts (was `middleware.ts` in PRD §14 — renamed in Next 16)` protecting `/audit` and `/api/run`. Single shared password from `APP_PASSWORD` env var.
- `/audit` page with brand input + 1–5 queries textarea + Run button.
- `POST /api/run` SSE endpoint that fans out `queries × 5` parallel OpenRouter calls (60s per-cell timeout, single failure never aborts), emitting one `data:` event per cell as it settles plus a final `{done:true}`.
- `POST /api/cell` JSON endpoint to retry exactly one (queryIdx, modelId) cell from the UI's retry button. (Resolves PRD ambiguity in F-D5.)
- Pure-regex `lib/analyze.ts` extracting `{mentioned, rank, competitors}` from each response, no second LLM call.
- `lib/reportCard.ts` aggregating cells into a Report Card with: % mentioned, avg rank, best model (most #1 ranks), worst model (fewest mentions), top 3 competitors with normalized names (lowercase + strip generic legal/category suffixes).
- ResultsGrid + Cell components rendering markdown via `react-markdown` + `remark-gfm`, brand highlighted with `<mark>` via a small custom rehype plugin (text-node walker — `components` prop alone can't reach text nodes per react-markdown v10 docs), per-cell Copy and Retry, skeleton loaders, error banners.
- 5 model slugs locked in `lib/models.ts` (the verbatim PRD list — verified live on OpenRouter at proposal time).
- Hard secret-handling rules (SC1–SC6): `OPENROUTER_API_KEY`, `APP_PASSWORD`, `COOKIE_SECRET` are server-only, read at request time, never bundled, never echoed in errors or SSE payloads. **All LLM calls happen inside server route handlers; the client never holds or transmits the OpenRouter key.**
- Public GitHub repo + Vercel deploy + README per AC11 + screenshot in `docs/`.

## Capabilities

### New Capabilities
- `auth-gate`: HMAC-signed-cookie shared-password gate covering `/`, `/api/auth`, `/api/logout`, and proxy-level (Next 16's renamed middleware) protection of `/audit` + `/api/run` + `/api/cell`.
- `audit-runner`: Brand + 1–5 queries input, server-side fan-out to 5 OpenRouter models with SSE streaming, per-cell timeout/error isolation, single-cell retry endpoint.
- `response-analysis`: Pure-regex analyzer for mentioned/rank/competitors, plus aggregation into a live Report Card with best/worst model and top-3 competitor dedupe.
- `audit-ui`: `/audit` page composition — brand input, textarea, Run button, sticky Report Card, query-blocked grid of model cells with markdown rendering, brand `<mark>` highlight, Copy/Retry, skeleton/error states.

### Modified Capabilities
<!-- None — fresh project, no existing specs. -->

## Impact

- **New code**: every file in the locked file structure (PRD §14): `app/`, `components/`, `lib/`, `proxy.ts (was `middleware.ts` in PRD §14 — renamed in Next 16)`, `.env.local.example`, `README.md`. Plus `app/api/cell/route.ts` (added beyond PRD §14 to resolve F-D5 retry ambiguity — design.md justifies the deviation from the "15 source files. No more." constraint).
- **New deps** — exact versions verified on npm registry on 2026-05-03 (the PRD's "Last updated" date). Lock these in `package.json` as caret-pinned to the major:

  | Package | Version | Notes |
  |---|---|---|
  | `next` | `16.2.4` | App Router; PRD said 15.x but 16.x is current latest stable. Override locked decision (see design D12). |
  | `react` | `19.2.5` | RSC + server components |
  | `react-dom` | `19.2.5` | matches react |
  | `typescript` | `6.0.3` | strict mode; PRD said 5.x but 6.x is current latest stable. Override locked decision (see design D12). |
  | `tailwindcss` | `4.2.4` | CSS-first config — NO `tailwind.config.ts` file in v4. Theme tokens go in `app/globals.css` via `@theme {}` |
  | `@tailwindcss/postcss` | latest at install time | required PostCSS plugin for Next.js + Tailwind v4 |
  | `postcss` | latest at install time | required by `@tailwindcss/postcss` |
  | `openai` | `6.35.0` | configured for OpenRouter base URL; PRD said `^4.x` but 6.x is current. Override locked decision (see design D12). |
  | `react-markdown` | `10.1.0` | renders cell responses |
  | `remark-gfm` | `4.0.1` | GFM tables/strikethrough |
  | `shadcn` (CLI only, dev-time) | `4.6.0` | run via `pnpm dlx`, not added as dep |
  | `class-variance-authority` | `0.7.1` | shadcn primitive dep |
  | `clsx` | `2.1.1` | shadcn primitive dep |
  | `tailwind-merge` | `3.5.0` | shadcn primitive dep |
  | `lucide-react` | `1.14.0` | icons used by shadcn defaults — version per current npm `latest`; if shadcn `init` pulls a different range, accept whatever it pins |
  | `@radix-ui/react-slot` | `1.2.4` | required by shadcn `Button` |
  | `tw-animate-css` | `1.4.0` | shadcn v4 default animation utility |
  | `eslint` | `10.3.0` | dev |
  | `eslint-config-next` | `16.2.4` | dev; matches next major |
  | `@types/react` | `19.2.14` | dev |
  | `@types/react-dom` | `19.2.3` | dev |
  | `@types/node` | `25.6.0` | dev |
  | `vitest` | `4.1.5` | dev — analyzer + reportCard unit tests |
  | `pnpm` | `10.33.2` | package manager (pin via `packageManager` field in `package.json`) |

  Total runtime deps: 13 (next, react, react-dom, openai, react-markdown, remark-gfm, tailwindcss, @tailwindcss/postcss, class-variance-authority, clsx, tailwind-merge, lucide-react, @radix-ui/react-slot, tw-animate-css). Devs: 7.
- **Env vars** (server-only, never `NEXT_PUBLIC_`): `OPENROUTER_API_KEY`, `APP_PASSWORD`, `COOKIE_SECRET`, `APP_URL`.
- **External services**: OpenRouter free-tier API (5 model slugs), Vercel free tier (hosting + encrypted env vars).
- **Out of scope** (locked, PRD §16): no DB, no accounts, no JSON-mode, no judge LLM, no templates, no mobile-first, no i18n, no analytics, no rate limiting.
