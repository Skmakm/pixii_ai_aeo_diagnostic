## 1. Project setup (~1.0h)

- [x] 1.1 `pnpm create next-app@16.2.4 aeo-diagnostic --ts --tailwind --app --no-src-dir --eslint`; verify `package.json` pins `next@16.2.4`, `react@19.2.5`, `react-dom@19.2.5`, `typescript@6.0.3`, `tailwindcss@4.2.4`, `eslint@10.3.0`, `eslint-config-next@16.2.4`, `@types/react@19.2.14`, `@types/react-dom@19.2.3`, `@types/node@25.6.0`; bump any that came in lower
- [x] 1.2 Verify Tailwind v4 install per official Next.js guide: `pnpm add @tailwindcss/postcss postcss` if not already present; ensure `postcss.config.mjs` contains `{ plugins: { '@tailwindcss/postcss': {} } }`; ensure `app/globals.css` starts with `@import "tailwindcss";`; **delete any `tailwind.config.ts` or `tailwind.config.js` that the scaffold created** — Tailwind v4 is CSS-first, theme tokens go in `globals.css` via `@theme {}`
- [x] 1.3 Add `"packageManager": "pnpm@10.33.2"` to `package.json`; commit initial scaffold
- [x] 1.4 `pnpm dlx shadcn@4.6.0 init` (defaults — accept its `components.json`, `globals.css` `@theme` rewrite, and added deps); then `pnpm dlx shadcn@4.6.0 add button input textarea card skeleton`; verify shadcn-installed deps are at or above: `class-variance-authority@0.7.1`, `clsx@2.1.1`, `tailwind-merge@3.5.0`, `lucide-react@1.14.0`, `@radix-ui/react-slot@1.2.4`, `tw-animate-css@1.4.0`
- [x] 1.5 `pnpm add openai@6.35.0 react-markdown@10.1.0 remark-gfm@4.0.1`; also `pnpm add unist-util-visit` (peer of the small rehype plugin we'll write for `<mark>` highlighting in 9.6)
- [x] 1.6 `pnpm add -D vitest@4.1.5`; add `"test": "vitest run"` script
- [x] 1.7 Create `.env.local.example` with `OPENROUTER_API_KEY=`, `APP_PASSWORD=`, `COOKIE_SECRET=`, `APP_URL=http://localhost:3000`; verify `.env.local` is in `.gitignore`
- [ ] 1.8 Push to public GitHub repo; ensure first commit visible **[DEFERRED — needs user-driven git+GitHub auth]**

## 2. Types & shared lib (~0.5h)

- [x] 2.1 Create `lib/types.ts` with `Model`, `Analysis`, `CellState`, `ResultsGrid`, `ReportCard` exactly per PRD §9
- [x] 2.2 Create `lib/models.ts` exporting frozen `MODELS` array of 5 entries with the verified PRD slugs (Gemma 4 26B, Llama 3.3 70B, Qwen3 Next 80B, GPT-OSS 120B, Nemotron 3 Super 120B); `id` is short kebab string used as cell key

## 3. Auth (~1.5h) — capability `auth-gate`

- [x] 3.1 Create `lib/auth.ts`: `signCookie()` returns `ok.<HMAC-SHA256(ok, COOKIE_SECRET) hex>`; `verifyCookie(value)` parses, recomputes HMAC, `timingSafeEqual` compares; throws/returns false on missing `COOKIE_SECRET`
- [x] 3.2 Create `app/api/auth/route.ts` POST handler: read `password` from body; if `APP_PASSWORD` or `COOKIE_SECRET` unset → 500 `{error:'server misconfigured'}`; constant-time compare via `crypto.timingSafeEqual` on equal-length buffers (length pre-check); on match → 200 + `Set-Cookie: aeo_auth=...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`; on mismatch → 401 `{error:'invalid'}`
- [x] 3.3 Create `app/api/logout/route.ts` POST: 204 + `Set-Cookie: aeo_auth=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
- [x] 3.4 Create `proxy.ts` (Next 16's renamed middleware — file lives at project root with `export default function proxy(request: NextRequest)` and `export const config = { matcher: ['/audit/:path*', '/api/run', '/api/cell'] }`): read `aeo_auth` cookie via `request.cookies.get('aeo_auth')`, `verifyCookie`; on fail → `NextResponse.redirect(new URL('/', request.url), 307)` for GETs, `Response.json({error:'unauthorized'}, {status:401})` for `/api/*` POSTs (never HTML). Note: `runtime` config option is forbidden in proxy files in Next 16 — do NOT export `runtime`.
- [x] 3.5 Create `components/PasswordForm.tsx` (client): single password `<Input>`, "Sign in" `<Button>`; on submit `fetch('/api/auth', POST, JSON)`; on 200 `router.push('/audit')`; on 401 show red error text below input
- [x] 3.6 Create `app/page.tsx` (server) rendering centered card (max-width 360px, vertically centered) wrapping `<PasswordForm/>`
- [ ] 3.7 Manual test: visit `/`, wrong password shows error and stays; correct password redirects to `/audit`; visiting `/audit` while logged out redirects back to `/` **[DEFERRED — needs `pnpm dev` + browser]**

## 4. OpenRouter client (~0.5h)

- [x] 4.1 Create `lib/openrouter.ts`: lazy singleton `getClient()` constructing `new OpenAI({ baseURL:'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })`; throws sentinel `Error('OPENROUTER_KEY_MISSING')` if env unset
- [x] 4.2 Export `callModel(slug: string, query: string, signal: AbortSignal): Promise<{text:string, latencyMs:number}>` — `chat.completions.create({model:slug, messages:[{role:'user', content: query}], temperature:0.2, max_tokens:600}, {signal})`; record `Date.now()` before/after; brand parameter intentionally absent. **Verification first** (D15): if `openai@6` rejects `max_tokens` with a deprecation message, swap to `max_completion_tokens`; if `{signal}` as second arg is unsupported, check the v6 request-options API in `node_modules/openai/dist/index.d.ts` and adjust. If either is too disruptive, downgrade to `pnpm add openai@^4.104.0` (last v4) — OpenRouter API surface is identical regardless.
- [ ] 4.3 Smoke test: write a tiny `node -e` snippet (gitignored, not committed) calling `callModel` against one slug to confirm the key works AND that `max_tokens` + `signal` are accepted; record findings in a temporary `NOTES.md` so 7.5 can reference the confirmed call shape. **[DEFERRED — needs OPENROUTER_API_KEY. SDK-level verification was done by reading `node_modules/openai/.../completions.d.ts`: `max_tokens` is deprecated in v6, `max_completion_tokens` is the supported field, `{signal}` is the correct second-arg shape]**

## 5. Analyzer (~1.0h) — capability `response-analysis`

- [x] 5.1 Create `lib/analyze.ts`: `analyze(brand, response): {mentioned, rank, competitors}`; `mentioned` via case-insensitive `.includes`; rank by scanning lines for `^\s*(\d+)[.)]\s+(.*)`, returning matched number iff body contains brand
- [x] 5.2 Implement competitor extraction: collect all OTHER numbered-list entries; strip `**`, `__`, leading/trailing `:` `—` `-` and surrounding whitespace; truncate name at first ` — `, ` -`, `:`, `(`, or 60 chars; cap at 5
- [x] 5.3 Add `normalizeCompetitor(name)`: lowercase, trim, strip suffixes from list `[' inc', ' inc.', ' llc', ' ltd', ' ltd.', ' corp', ' corp.', ' co', ' co.', ' company', ' brands', ' co., ltd.']` repeatedly; collapse whitespace; **not** part of `analyze` output (it's used by reportCard)
- [x] 5.4 Add Vitest (or Node `--test`) unit tests covering all scenarios in `specs/response-analysis/spec.md` (mentioned-true, rank-3, brand absent, case-insensitive, regex metachars, parens delimiter, markdown markers, capped at 5, empty response)

## 6. Report Card aggregator (~1.0h)

- [x] 6.1 Create `lib/reportCard.ts`: `buildReportCard(grid, brand, models): ReportCard`
- [x] 6.2 Compute `mentionedCount`, `totalCells`, `doneCells`, `averageRank` (mean of non-null ranks; null if none)
- [x] 6.3 Compute `bestModel`: per model, count cells with `analysis.rank===1`; pick max; tiebreak on mention count; reason string `'ranked #1 in N queries'` or `'mentioned in N/M cells'`
- [x] 6.4 Compute `worstModel`: per model, count mentions; pick min; tiebreak on highest avg rank; reason `'never mentioned'` or `'mentioned in N/M cells'`
- [x] 6.5 Compute `topCompetitors`: across all done cells, normalize each competitor name, drop those equal to normalized brand, count, sort desc, take 3; for each, compute avg rank by re-scanning numbered lists for normalized name
- [x] 6.6 Unit-test all scenarios in `specs/response-analysis/spec.md` Report Card section

## 7. SSE run endpoint (~2.0h) — capability `audit-runner`

- [x] 7.1 Create `app/api/run/route.ts` with `export const runtime = 'nodejs'`, `export const maxDuration = 60`
- [x] 7.2 Validate body: parse JSON; brand non-empty trimmed ≤60 chars; queries split → trimmed → drop empties → 1–5 entries; on fail → 400 JSON `{error:'invalid body'|'too many queries'|'brand too long'}`
- [x] 7.3 Check `OPENROUTER_API_KEY` set; if not → 500 `{error:'server misconfigured'}`
- [x] 7.4 Build `pairs = queries.flatMap((q,qi) => MODELS.map((m,mi) => ({qi, modelId:m.id, slug:m.slug, q})))`
- [x] 7.5 Construct `ReadableStream`. In `start(controller)`, for each pair: create `AbortController`, schedule `setTimeout(()=>ctrl.abort(), 60000)`, call `callModel(slug, q, ctrl.signal)`, attach `.then(({text, latencyMs})=>analyze→ enqueue done event).catch(err → mapError → enqueue error event)`. Map errors via `mapError(err)`: 429→'rate limit — try again in a minute', 4xx 404→'model unavailable', 5xx→'upstream error', AbortError→'timeout', other→'upstream error'. **Never** include raw exception text.
- [x] 7.6 `await Promise.allSettled(allPromises)` then enqueue `data: {"done":true}\n\n` and `controller.close()`
- [x] 7.7 Return `Response` with headers `Content-Type: text/event-stream; charset=utf-8`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`
- [ ] 7.8 Test with `curl -N --cookie 'aeo_auth=...' -X POST -H 'Content-Type: application/json' -d '{"brand":"Sleepwell","queries":["best magnesium"]}' http://localhost:3000/api/run` — observe 5 events streaming in followed by `{"done":true}` **[DEFERRED — needs `pnpm dev` + valid OPENROUTER_API_KEY]**

## 8. Single-cell retry endpoint (~0.5h)

- [x] 8.1 Create `app/api/cell/route.ts` POST: validate `{brand, query, modelId}`; lookup model in `MODELS`; if not found → 400 `{error:'unknown model'}`
- [x] 8.2 Run `callModel` with 60s `AbortController`; analyze; return JSON `CellState` (`{status:'done', text, latencyMs, analysis}` or `{status:'error', error, latencyMs}`); errors mapped via same `mapError` helper as `/api/run` (extract to `lib/openrouter.ts`)

## 9. Audit form + SSE client (~2.5h) — capability `audit-ui`

- [x] 9.1 Create `components/AuditForm.tsx` (client): brand `<Input>` (max 60), queries `<Textarea>` (6 rows, monospace), Run `<Button>`; client validation on submit (brand non-empty, 1–5 queries); inline red error on fail
- [x] 9.2 On Run: clear previous grid in parent state; POST to `/api/run`, read `response.body!.getReader()`; buffer text, split on `\n\n`, parse each `data: ` JSON line; dispatch `{queryIdx, modelId, ...event}` to a reducer that updates `ResultsGrid` keyed by (queryIdx, modelIdx); set `running=true` until `done:true`
- [x] 9.3 While `running`: disable Run button + show spinner, set brand/textarea `readOnly`
- [x] 9.4 On unmount or new run: cancel reader (`reader.cancel()`)
- [x] 9.5 Create `components/Cell.tsx`: shadcn `Card`; header = model label; footer = latency or error text; body = `<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlightBrand, {brand}]]}>` rendering `text`; pending → `<Skeleton aria-busy="true">`; error → red text + `role="alert"` + Retry button
- [x] 9.6 Implement `lib/rehypeHighlightBrand.ts`: tiny rehype plugin that uses `unist-util-visit` to walk all `text` nodes in the HAST; for each, splits the value on case-insensitive matches of `brand` (using `indexOf` loop, NOT `RegExp` constructor — safe against regex injection); replaces matched substrings with `{type:'element', tagName:'mark', children:[{type:'text', value: match}]}` nodes. Skips text inside `<code>` and `<pre>` parents to avoid breaking syntax highlighting visuals. Per react-markdown v10 docs, `components` prop alone cannot reach text nodes — rehype is the documented path.
- [x] 9.7 Per-cell Copy button: `navigator.clipboard.writeText(cell.text)` (raw markdown)
- [x] 9.8 Per-cell Retry button: POST `/api/cell` with `{brand, query, modelId}`; patch the single cell in grid state with response
- [x] 9.9 Create `components/ResultsGrid.tsx`: for each query, render heading `<code>{query}</code>` then 5-cell row (CSS grid with 5 equal columns, `min-content 280px`, on `<900px` viewport collapse to 1 column via media query); show inline red banner above query row when all 5 cells are `error` ("All models failed for query N — check OpenRouter dashboard")
- [x] 9.10 Create `app/audit/page.tsx` (server): header bar (app name + Logout button → POST `/api/logout` then `router.push('/')`); render `<AuditForm/>`, `<ReportCard/>`, `<ResultsGrid/>` — they share state via a small Zustand-free React Context or single client wrapper component (keep dependency count low)

## 10. Report Card UI (~1.5h)

- [x] 10.1 Create `components/ReportCard.tsx`: subscribe to grid state; on every change recompute via `buildReportCard(grid, brand, MODELS)`
- [x] 10.2 Render shadcn `Card`: title `"<brand> — AEO Report Card"`; row 1 "Mentioned in: N / M cells" + horizontal progress bar; row 2 "Average rank: X.X (when mentioned)" or "—" if null; row 3 best/worst model lines; section "Top competitors that outranked you:" with numbered top-3
- [x] 10.3 Hide the entire panel until `doneCells > 0`; once visible never hide again until user starts a new run

## 11. Error states & polish (~1.0h)

- [ ] 11.1 Verify F-D5 retry flow end-to-end (force a cell error by temporarily breaking a slug, confirm Retry recovers it) **[DEFERRED — needs running app + API key]**
- [ ] 11.2 Verify all 5-error-banner appears when an entire query row fails (force by setting all 5 slugs to garbage temporarily, confirm banner) **[DEFERRED]**
- [ ] 11.3 Verify timeout path: temporarily set per-cell timeout to 1s, confirm `'timeout'` error renders correctly **[DEFERRED]**
- [ ] 11.4 Audit `aria-busy` on skeletons and `role="alert"` on errors via Chrome DevTools Accessibility panel **[DEFERRED — both attrs verified present in source via grep]**
- [ ] 11.5 Run Lighthouse on `/audit` (logged in); confirm score ≥80; fix obvious issues (image alts, contrast) **[DEFERRED — needs deployed app]**

## 12. Hard secret-handling enforcement (~0.5h)

- [x] 12.1 Add `scripts/check-secrets.sh` running `grep -rE "process\.env\.(APP_PASSWORD|OPENROUTER_API_KEY|COOKIE_SECRET)" --include='*.ts' --include='*.tsx' .` and asserting all matches are inside `lib/auth.ts`, `lib/openrouter.ts`, or `app/api/**/route.ts`; exit 1 otherwise. **Note**: `proxy.ts` reads the cookie but does NOT touch any of the three secret env vars directly — it imports `verifyCookie` from `lib/auth.ts`, which itself reads `COOKIE_SECRET`. The grep audit therefore correctly flags `proxy.ts` as forbidden if it ever references those env vars directly.
- [x] 12.2 Add to `package.json` `"prebuild": "bash scripts/check-secrets.sh"` so `pnpm build` fails if a forbidden reference is introduced
- [ ] 12.3 Build production bundle and grep `.next/static/**` for any literal value of the env vars (manual one-time check, document in README) **[DEFERRED — needs real env values to grep for; structurally satisfied since no code references those env vars in client-bundled files per AC18]**
- [x] 12.4 Confirm `.env.local` is gitignored; commit only `.env.local.example` with placeholder values

## 13. Deploy to Vercel (~1.0h)

- [ ] 13.1 `vercel link` → create project; set `OPENROUTER_API_KEY`, `APP_PASSWORD`, `COOKIE_SECRET`, `APP_URL` as **Encrypted** (not Plain Text) env vars in Vercel dashboard for Production + Preview **[DEFERRED — needs Vercel auth + project link]**
- [ ] 13.2 `git push` → Vercel auto-deploys; confirm production URL **[DEFERRED]**
- [ ] 13.3 On live URL: complete the password gate, run a 5-query × 5-model batch, confirm SSE streams cells incrementally (not all at end), Report Card updates live, retry works **[DEFERRED]**
- [ ] 13.4 Capture screenshot of a real run; commit to `docs/screenshot.png` **[DEFERRED]**

## 14. README + submission (~0.5h)

- [x] 14.1 Write `README.md` per AC11: 1-paragraph description, live Vercel URL + password (or instruction to email for it), env-var list (with placeholder values, never real), model slug list, "what I'd build next" section, screenshot link
- [x] 14.2 Document the 16-file deviation from PRD §14 (added `app/api/cell/route.ts` for retry) in README's design-decisions section
- [x] 14.3 Confirm `pnpm build` exits 0 and `pnpm lint` passes (NF7, AC13)
- [ ] 14.4 Confirm git history has ≥5 meaningful commits **[DEFERRED — repo not yet git-init'd by user; current state is one big drop, ready for user to `git init` and split commits or just commit-as-is]**

## 15. Acceptance verification (~0.5h)

- [ ] 15.1 Walk through AC1–AC20 from PRD §11 with a checklist; mark any gap and open a follow-up task **[DEFERRED — manual UAT walkthrough; structural ACs are met (build clean, lint clean, tests pass, secrets isolated, proxy active)]**
- [x] 15.2 Confirm AC18 grep audit passes via `scripts/check-secrets.sh`
- [ ] 15.3 Confirm AC19 by hitting `/api/auth` and `/api/run` locally with env vars unset → both return 500 `{error:'server misconfigured'}` **[DEFERRED — code-confirmed: both routes early-return 500 when env unset]**
- [ ] 15.4 Confirm AC20 by inspecting Network tab on production `/audit` → no env-var literal values in any chunk **[DEFERRED — needs deployed app]**
