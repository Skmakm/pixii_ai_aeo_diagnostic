# AEO Diagnostic — Assignment MVP PRD

**Version:** 1.1
**Owner:** Akash Mishra
**Status:** Final, build-ready
**Build target:** 1–2 evenings, ship to Vercel
**Last updated:** 2026-05-03

---

## 1. Summary

A password-gated single-page Next.js app that takes 1–5 free-text queries plus a brand name, fires each query at 5 free LLMs in parallel via OpenRouter, and returns:

1. A side-by-side response grid (5 columns × N queries) with the user's brand highlighted in every cell.
2. A live "Report Card" summarising how often and how highly the user's brand was recommended versus competitors.

No persistence, no accounts, no prompt templates, no hard-coded categories — pure user-driven LLM comparison with brand tracking on top.

---

## 2. Goals

- **G1.** Let any user enter their brand name and arbitrary natural-language queries, and see how 5 LLMs respond.
- **G2.** Surface a clear "report card" showing brand mention rate, average rank, and top competitors — without requiring the user to read every cell.
- **G3.** Demonstrate competence with: Next.js App Router, server-side LLM orchestration, SSE streaming, basic auth, lightweight response parsing.
- **G4.** Deployable to Vercel with $0 monthly cost (free OpenRouter models, free Vercel tier).
- **G5.** Demoable end-to-end in under 5 minutes by anyone with the password.

## 3. Non-goals

- **NG1.** No user accounts, signup, or per-user data.
- **NG2.** No database, no persistence, no audit history.
- **NG3.** No prompt templates, hard-coded categories, or vertical lock-in.
- **NG4.** No JSON-output enforcement on the model side.
- **NG5.** No second LLM call to "extract" or judge — pure regex parsing on responses.
- **NG6.** No paid LLM tiers.
- **NG7.** No mobile-first design (must not break on mobile, but desktop is the target).
- **NG8.** No internationalisation.

---

## 4. Users & Scenarios

### 4.1 Primary user
A solo founder, marketer, or curious technologist who wants to A/B compare LLM responses to a real-world question and see whether their brand is being recommended.

### 4.2 Scenarios

| ID | Scenario |
|---|---|
| S1 | "I sell magnesium supplements as 'Sleepwell'. I type my brand and 5 buyer-intent queries. The report card tells me I show up in 11 of 25 cells, ranked 3.2 on average, behind Calm and Natural Vitality." |
| S2 | "I'm researching e-bikes. I type my brand 'BoltX' and a single query 'top 3 e-bikes under 1 lakh INR'. Five models respond. I see I'm only mentioned by Llama, never by the others." |
| S3 | "I'm a developer evaluating LLMs. I paste 5 queries, brand name 'TestBrand', and use the side-by-side grid to read the differences. The report card is irrelevant to me but doesn't get in the way." |

---

## 5. Functional Requirements

### 5.1 Authentication

| ID | Requirement |
|---|---|
| **F-A1** | The root path `/` displays a single password input and a Submit button. |
| **F-A2** | On submit, client POSTs to `/api/auth` with `{ password: string }`. |
| **F-A3** | Server compares the value to env var `APP_PASSWORD`. On match, server sets an HttpOnly, Secure, SameSite=Lax signed cookie `aeo_auth` (24h max-age) and returns 200. On mismatch, returns 401 with `{ error: 'invalid' }`. |
| **F-A4** | Cookie value is `ok.<HMAC-SHA256(ok, COOKIE_SECRET)>`. |
| **F-A5** | After successful auth, client redirects to `/audit`. |
| **F-A6** | Middleware blocks access to `/audit` and `/api/run` for unauthenticated requests. Redirects unauth GETs to `/`; returns 401 for unauth POSTs to `/api/run`. |
| **F-A7** | A logout link in the `/audit` header POSTs to `/api/logout`, which clears the cookie and redirects to `/`. |

### 5.2 Audit input

| ID | Requirement |
|---|---|
| **F-I1** | `/audit` page shows a single-line text input labeled "Brand" — required, max 60 chars. |
| **F-I2** | Below the brand input: a multi-line textarea labeled "Enter 1–5 queries, one per line." |
| **F-I3** | Below the textarea: a "Run" button (primary, full width on mobile). |
| **F-I4** | Validation on Run click: brand must be non-empty after trim; queries are split by newline, trimmed, with empty lines dropped — must be 1–5 lines. Show inline error if validation fails. |
| **F-I5** | While a run is in progress, the Run button is disabled and shows a spinner. The brand and textarea inputs are read-only. |
| **F-I6** | After the run completes (or errors), the Run button re-enables; the user can run a new batch. Previous results are replaced, not appended. |

### 5.3 Audit execution

| ID | Requirement |
|---|---|
| **F-R1** | On Run, client POSTs to `/api/run` with `{ brand: string, queries: string[] }`. Response is `text/event-stream`. |
| **F-R2** | Server fires `queries.length × 5` parallel calls to OpenRouter using one OpenAI SDK client. The brand is **not** included in the prompt sent to any model. |
| **F-R3** | Each call uses `temperature: 0.2`, `max_tokens: 600`, single user message = the query verbatim. |
| **F-R4** | When each call settles (resolve or reject), server runs the response through `analyze(brand, response)` to compute `mentioned`, `rank`, and `competitors`, then emits an SSE message: `data: { queryIdx, modelId, status: 'done'\|'error', text?, error?, latencyMs, mentioned?, rank?, competitors? }\n\n`. |
| **F-R5** | When all calls have settled, server emits `data: { done: true }\n\n` and closes the stream. |
| **F-R6** | Client maintains a 2-D grid `[queryIdx][modelId] = CellState` updated incrementally as SSE messages arrive. |
| **F-R7** | Per-call timeout: 60 seconds. On timeout, that cell becomes `status: 'error'` with message `"timeout"`. The run continues for other cells. |
| **F-R8** | A single failed cell never aborts the rest of the run. |

### 5.4 Audit display

| ID | Requirement |
|---|---|
| **F-D1** | Results render as a grid: one row per query, five columns (one per model). |
| **F-D2** | Each cell displays: model label (header), latency in ms (footer), and the response body. |
| **F-D3** | Response body renders as markdown via `react-markdown` + `remark-gfm`. Code blocks, lists, and bold/italic must render correctly. |
| **F-D4** | Pending cell state: skeleton loader. |
| **F-D5** | Error cell state: red icon + error message + a "retry" button. Retry POSTs only that one (queryIdx, modelId) cell. |
| **F-D6** | Cell width on desktop: equal-width columns; min cell width 280px; on viewport <900px, grid collapses to one model per row stacked under each query. |
| **F-D7** | A "Copy" button on each cell copies the response body to clipboard. |
| **F-D8** | A "Report Card" panel renders above the grid showing aggregate stats: % of cells mentioning the brand, average rank when mentioned, best-performing model, worst-performing model. |
| **F-D9** | The Report Card updates live as SSE messages arrive. When the run completes, it locks in final values. |
| **F-D10** | A "Top Competitors" sub-section in the Report Card lists the top 3 brands that appeared most often across all cells (excluding the user's brand), with mention count and average rank. |
| **F-D11** | In every response cell, all case-insensitive occurrences of the brand string are wrapped in `<mark>` (yellow highlight). |

### 5.5 Models

| ID | Requirement |
|---|---|
| **F-M1** | The 5 models are defined in `lib/models.ts` as a frozen array. Order in the array determines column order in the grid. |
| **F-M2** | Initial slug list (verify free status at build time on `https://openrouter.ai/api/v1/models`): `google/gemma-4-26b-a4b-it:free`, `meta-llama/llama-3.3-70b-instruct:free`, `qwen/qwen3-next-80b-a3b-instruct:free`, `openai/gpt-oss-120b:free`, `nvidia/nemotron-3-super-120b-a12b:free`. |
| **F-M3** | If any slug returns 404 from OpenRouter, server logs a warning and that cell becomes `status: 'error'` with message `"model unavailable"`. |

### 5.6 Response parsing (`analyze`)

| ID | Requirement |
|---|---|
| **F-P1** | `analyze(brand, response)` is a pure function that returns `{ mentioned: boolean, rank: number \| null, competitors: string[] }`. |
| **F-P2** | `mentioned` is true iff the lowercase response contains the lowercase brand string. |
| **F-P3** | `rank` is extracted by scanning lines of the response for a numbered-list pattern `^\s*(\d+)[.)]\s+(.*)`. If a matching line contains the brand (case-insensitive), `rank` is the captured number. Otherwise `null`. |
| **F-P4** | `competitors` is the list of all other numbered-list entries' names in the same response, with markdown markers (`**`, `:`, `—`) stripped, max 5 entries. |
| **F-P5** | The function performs no LLM calls and uses only synchronous regex / string operations. Must execute in < 5 ms per response on a typical Vercel cold start. |

---

## 6. Non-Functional Requirements

| ID | Requirement |
|---|---|
| **NF1** | First contentful paint of `/audit` < 1.5s on Vercel free tier. |
| **NF2** | First SSE message from `/api/run` arrives within 5s of POST under normal conditions. |
| **NF3** | The full 25-cell run completes within 60s for typical queries. |
| **NF4** | All API routes return JSON or SSE; no HTML responses. |
| **NF5** | `OPENROUTER_API_KEY`, `APP_PASSWORD`, `COOKIE_SECRET` are server-only env vars. Never leaked to client bundle. |
| **NF6** | The app is fully usable with JavaScript enabled on a modern Chromium/Firefox/Safari (released within last 12 months). |
| **NF7** | `pnpm build` produces zero TypeScript errors and zero ESLint errors. |
| **NF8** | All cells must be accessible: pending cells have `aria-busy="true"`, error cells have `role="alert"`. |

### 6.1 Security & Configuration Constraints (HARD)

These are hard, non-negotiable constraints. Violating either of them is a build failure.

| ID | Constraint |
|---|---|
| **SC1** | The application password **MUST** be read from the `APP_PASSWORD` environment variable on every check. It must **NEVER** appear as a literal in source code, in client-side bundles, in committed config files, or in error messages. There is no fallback default. If `APP_PASSWORD` is unset, the server returns 500 from `/api/auth` with `{ error: 'server misconfigured' }`. |
| **SC2** | The OpenRouter API token **MUST** be read from the `OPENROUTER_API_KEY` environment variable on every server boot. It must **NEVER** appear as a literal in source code, in client-side bundles, in committed config files, in URLs, in browser-side requests, or in error messages or stream events. There is no fallback default. If `OPENROUTER_API_KEY` is unset, the server returns 500 from `/api/run` with `{ error: 'server misconfigured' }`. |
| **SC3** | Neither `APP_PASSWORD` nor `OPENROUTER_API_KEY` may be referenced in any file inside `app/`, `components/`, or any module that gets bundled to the client. Reads happen only inside `lib/auth.ts`, `lib/openrouter.ts`, and route handlers in `app/api/**/route.ts`. |
| **SC4** | `.env.local` is gitignored. Only `.env.local.example` (with placeholder values, no real secrets) is committed. |
| **SC5** | At server startup, validate both env vars exist and are non-empty. If either is missing, log a clear error to stderr (without leaking values) and refuse to serve `/api/auth` or `/api/run`. |
| **SC6** | In Vercel deployment, both vars are set as Encrypted Environment Variables in the project settings. Never as Plain Text. |

---

## 7. UI Specifications

### 7.1 `/` — Gate

```
╔══════════════════════════════════╗
║          AEO Diagnostic          ║
║   ──────────────────────────     ║
║                                  ║
║   Password                       ║
║   [_____________________]        ║
║                                  ║
║   [        Sign in       ]       ║
║                                  ║
╚══════════════════════════════════╝
```

- Centered card, max-width 360px, vertically centered viewport
- Tailwind / shadcn `Input` + `Button`
- Error state shows red text below input

### 7.2 `/audit` — Main

```
┌──────────────────────────────────────────────────────────────────┐
│ AEO Diagnostic                                          [Logout] │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Brand                                                           │
│  [ Sleepwell                                                  ]  │
│                                                                  │
│  Queries (1–5, one per line)                                     │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ best magnesium for seniors                                 │  │
│  │ top 5 magnesium glycinate brands                           │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                       [   Run  ] │
│                                                                  │
│  ─── Sleepwell — AEO Report Card ────────────────────────────    │
│  Mentioned in:    11 / 25 cells   ████████░░░░░░  44%            │
│  Average rank:    3.2  (when mentioned)                          │
│  Best model:      Llama 3.3 70B — ranked #1 in 2 queries         │
│  Worst model:     Nemotron 120B — never mentioned                │
│                                                                  │
│  Top competitors that outranked you:                             │
│   1. Calm Magnesium       (mentioned in 19/25, avg rank 1.8)     │
│   2. Natural Vitality     (17/25, avg rank 2.1)                  │
│   3. Doctor's Best        (14/25, avg rank 2.7)                  │
│                                                                  │
│  ─── Responses ──────────────────────────────────────────────    │
│                                                                  │
│  Query 1: "best magnesium for seniors"                           │
│  ┌──────┬──────┬──────┬──────┬──────┐                            │
│  │Gemma │Llama │ Qwen │ GPT  │ Nem. │                            │
│  │ 1.2s │ 0.9s │ 1.8s │ 2.1s │ 1.5s │                            │
│  │ resp │ resp │ resp │ resp │ resp │                            │
│  └──────┴──────┴──────┴──────┴──────┘                            │
│                                                                  │
│  Query 2: ...                                                    │
└──────────────────────────────────────────────────────────────────┘
```

- Top header: app name (left), Logout button (right)
- Brand input: single line, 60-char max
- Textarea: monospace font, 6 rows tall, full width, max-width 1100px
- Report card panel: shadcn `Card`, sticky behaviour optional
- Each query block has a heading with the query text in `<code>`, then the 5-cell grid
- Cells use shadcn `Card`. Header = model label. Footer = latency or error. Body = markdown response with brand highlighted via `<mark>`

---

## 8. API Contracts

### 8.1 `POST /api/auth`

Request:
```ts
{ password: string }
```
Response:
```ts
// 200 — success, sets cookie
{ ok: true }

// 401 — wrong password
{ error: 'invalid' }
```

### 8.2 `POST /api/logout`

No body. Clears cookie. Returns 204.

### 8.3 `POST /api/run`

Request:
```ts
{
  brand: string,         // non-empty after trim, <= 60 chars
  queries: string[]      // length 1–5, each non-empty after trim
}
```

Response: `text/event-stream`.

Events emitted:
```ts
// per cell, as it settles
data: {
  queryIdx: number,
  modelId: string,
  status: 'done' | 'error',
  text?: string,                  // present iff status === 'done'
  error?: string,                 // present iff status === 'error'
  latencyMs: number,
  mentioned?: boolean,            // present iff status === 'done'
  rank?: number | null,           // present iff status === 'done'
  competitors?: string[]          // present iff status === 'done'
}

// once after all cells settled
data: { done: true }
```

Error responses (sent as JSON before stream starts, with HTTP 4xx):
- 400: malformed body, missing brand, empty `queries`, or `queries.length > 5`
- 401: missing/invalid auth cookie

---

## 9. Data Shapes (TypeScript)

```ts
// lib/types.ts
export type Model = {
  id: string;          // 'gemma' | 'llama' | 'qwen' | 'gpt-oss' | 'nemotron'
  label: string;       // shown in UI
  slug: string;        // OpenRouter model id
};

export type Analysis = {
  mentioned: boolean;
  rank: number | null;
  competitors: string[];
};

export type CellState =
  | { status: 'pending' }
  | { status: 'done'; text: string; latencyMs: number; analysis: Analysis }
  | { status: 'error'; error: string; latencyMs: number };

export type ResultsGrid = CellState[][];   // [queryIdx][modelIdx]

export type ReportCard = {
  totalCells: number;
  doneCells: number;
  mentionedCount: number;
  averageRank: number | null;
  bestModel: { id: string; reason: string } | null;
  worstModel: { id: string; reason: string } | null;
  topCompetitors: { name: string; count: number; avgRank: number | null }[];
};
```

---

## 10. Error Handling

| Scenario | Behavior |
|---|---|
| OpenRouter rate-limited (429) | Cell becomes `error` with message `"rate limit — try again in a minute"` |
| OpenRouter 5xx | Cell becomes `error` with message `"upstream error"`. No retry on first attempt. |
| Network timeout (>60s) | Cell becomes `error` with message `"timeout"` |
| Invalid JSON in stream chunk | Client logs to console, continues processing other events |
| All 5 models error for a query | Show banner: "All models failed for query N — check OpenRouter dashboard" |
| `OPENROUTER_API_KEY` missing on server | Return 500 from `/api/run` with `{ error: 'server misconfigured' }` |

---

## 11. Acceptance Criteria

The build is "done" when **all** of the following are true:

- [ ] **AC1.** Visiting `/` shows the password form.
- [ ] **AC2.** Submitting wrong password shows inline error and does not navigate.
- [ ] **AC3.** Submitting correct password redirects to `/audit`.
- [ ] **AC4.** Visiting `/audit` while logged out redirects to `/`.
- [ ] **AC5.** Entering a brand and one query and clicking Run results in 5 cells filling in (visually) within 30s.
- [ ] **AC6.** Entering a brand and 5 queries (one per line) results in 25 cells (5×5 grid) filling in within 60s.
- [ ] **AC7.** Cells fill in incrementally via SSE — not all at once at the end.
- [ ] **AC8.** A timed-out or errored cell does not block other cells.
- [ ] **AC9.** Refreshing the page clears all results (no persistence — by design).
- [ ] **AC10.** Logout clears cookie and redirects to `/`.
- [ ] **AC11.** README documents: live URL, password, env vars, model slug list.
- [ ] **AC12.** Repo is public on GitHub with > 5 commits showing incremental progress.
- [ ] **AC13.** `pnpm build` exits 0.
- [ ] **AC14.** Lighthouse score ≥ 80 on `/audit` (logged in).
- [ ] **AC15.** Report card renders above the grid as soon as the first cell completes.
- [ ] **AC16.** Report card numbers match what a human counts in the cells.
- [ ] **AC17.** Brand name is highlighted (`<mark>`) wherever it appears in any cell.
- [ ] **AC18.** `grep -r "process.env.APP_PASSWORD\|process.env.OPENROUTER_API_KEY" .` shows references **only** inside `app/api/**`, `lib/auth.ts`, and `lib/openrouter.ts`. No matches in client components, no string literals containing the secret values.
- [ ] **AC19.** Running `pnpm build` with both env vars unset produces a runtime error from the server when hitting `/api/auth` or `/api/run`, not a silent fallback.
- [ ] **AC20.** Inspecting the production JS bundle (Vercel build output / Network tab) shows zero references to either secret value.

---

## 12. Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15.x, App Router, React 19 |
| Language | TypeScript 5.x, strict mode |
| Styling | Tailwind 4.x + shadcn/ui |
| LLM client | `openai` ^4.x, configured for OpenRouter |
| Markdown | `react-markdown` + `remark-gfm` |
| Auth | HMAC-signed cookie via `next/headers` |
| Hosting | Vercel free tier |
| Package manager | pnpm |

Total dependencies: ~10 packages.

---

## 13. Environment Variables

```bash
# .env.local.example
OPENROUTER_API_KEY=sk-or-v1-...
APP_PASSWORD=correct-horse-battery-staple
COOKIE_SECRET=any-32-char-random-string
APP_URL=http://localhost:3000
```

All four are server-side only. None prefixed with `NEXT_PUBLIC_`.

---

## 14. File Structure (locked)

```
aeo-diagnostic/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                    # password gate
│   ├── audit/page.tsx              # main app
│   └── api/
│       ├── auth/route.ts
│       ├── logout/route.ts
│       └── run/route.ts            # SSE stream
├── components/
│   ├── PasswordForm.tsx
│   ├── AuditForm.tsx
│   ├── ReportCard.tsx
│   ├── ResultsGrid.tsx
│   └── Cell.tsx
├── lib/
│   ├── auth.ts                     # cookie sign/verify
│   ├── models.ts                   # MODELS array
│   ├── openrouter.ts               # client + callModel()
│   ├── analyze.ts                  # mentioned / rank / competitors parser
│   ├── reportCard.ts               # aggregate cells -> ReportCard
│   └── types.ts
├── middleware.ts
├── .env.local.example
├── README.md
└── package.json
```

15 source files. No more.

---

## 15. Build Plan (~13 hours of focus)

| Block | Hours | Deliverable |
|---|---|---|
| Setup | 1.0 | Next.js + Tailwind + shadcn scaffolded, repo on GitHub, env vars stubbed |
| Auth | 1.5 | F-A1 through F-A7 working end-to-end |
| LLM core | 1.5 | `lib/openrouter.ts` calling all 5 models against a test prompt |
| Analyzer | 1.0 | `lib/analyze.ts` + unit tests on hand-crafted sample responses |
| Run API | 2.0 | F-R1 through F-R8, tested with curl |
| UI base | 2.5 | F-I1–6 + F-D1–7 polished |
| Report card | 1.5 | F-D8–11 wired to live SSE updates |
| Error states | 1.0 | F-R7, F-D5, error banner |
| Deploy + README | 1.5 | Live on Vercel, README per AC11, screenshot in `/docs` |
| Buffer | 0.5 | Lighthouse audit, final polish |

---

## 16. Out of Scope (locked)

These are explicitly out of scope for v1.0. Any of them coming up = scope creep, must be rejected:

- ❌ User accounts / OAuth / signup
- ❌ Database, persistence, audit history
- ❌ JSON-structured output enforcement on models
- ❌ Second LLM call to extract or judge competitors
- ❌ Prompt templates, categories, verticals
- ❌ Custom prompt builder UI
- ❌ Per-model temperature/max_tokens controls
- ❌ More than 5 queries per batch
- ❌ More than 5 models
- ❌ Paid model fallback
- ❌ Slack/email/webhook integrations
- ❌ Multi-tenant or multi-seat
- ❌ Mobile-first design
- ❌ Internationalisation
- ❌ Rate limiting (free OpenRouter handles it)
- ❌ Analytics / telemetry

---

## 17. Submission Checklist

- [ ] Public GitHub repo
- [ ] Live Vercel URL
- [ ] README with: 1-paragraph description, live URL + password, env-var list, model slug list, "what I'd build next" section
- [ ] Screenshot of a real run committed to `/docs/screenshot.png`
- [ ] Clean git history (≥5 meaningful commits)
- [ ] `.env.local` gitignored, `.env.local.example` committed
- [ ] `pnpm build` and `pnpm lint` pass

---

## 18. Locked Decisions

These are not up for debate during the build. Reopening any of them = scope creep = miss the deadline.

1. **OpenRouter only**, 5 specific slugs (see F-M2). Single API key, single base URL.
2. **Brand + queries are user input.** Nothing hard-coded. No vertical lock.
3. **Brand is never sent to the model.** It is used only post-hoc for analysis.
4. **Regex-based analyzer**, not a second LLM call. Deterministic, fast, free.
5. **SSE streaming** for progress, not polling, not WebSockets.
6. **Password is shared**, not per-user. Single env var (`APP_PASSWORD`).
7. **Cookie auth**, not JWT, not NextAuth. ~20 lines of code.
8. **No DB.** Results live in React state and die on refresh.
9. **Tailwind + shadcn.** No custom design system.
10. **Desktop-first.** Mobile not broken, but not optimised.
11. **English only.**
12. **Password (`APP_PASSWORD`) is ALWAYS read from environment variable at request time.** No literal in code, no fallback default. See SC1.
13. **OpenRouter token (`OPENROUTER_API_KEY`) is ALWAYS read from environment variable at server boot.** No literal in code, no fallback default. See SC2.

---

*End of PRD v1.1.*
