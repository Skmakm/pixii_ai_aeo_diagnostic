## ADDED Requirements

### Requirement: Password gate landing page
The system SHALL render a single password form at `/` that posts to `/api/auth` and redirects authenticated users to `/audit`.

#### Scenario: Unauthenticated visitor sees the password form
- **WHEN** a visitor with no `aeo_auth` cookie loads `/`
- **THEN** the page renders a centered card (max-width 360px) containing a single password `<input>` and a "Sign in" `<button>`, with no other navigation, links, or content

#### Scenario: Wrong password shows inline error and stays on `/`
- **WHEN** the user submits a password that does not match `process.env.APP_PASSWORD`
- **THEN** the client receives 401 `{error:'invalid'}` from `POST /api/auth`
- **AND** the form displays red error text below the input
- **AND** the URL does not change and no cookie is set

#### Scenario: Correct password sets cookie and redirects to `/audit`
- **WHEN** the user submits a password that matches `process.env.APP_PASSWORD`
- **THEN** the server returns 200 `{ok:true}` from `POST /api/auth`
- **AND** sets a `Set-Cookie: aeo_auth=ok.<HMAC-SHA256(ok, COOKIE_SECRET) hex>; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/` header
- **AND** the client navigates to `/audit`

### Requirement: Constant-time password comparison
The system SHALL compare the submitted password to `APP_PASSWORD` using a constant-time algorithm so that response timing does not leak password length or content.

#### Scenario: Length mismatch returns same wall-clock-shaped 401 as content mismatch
- **WHEN** `/api/auth` is called with a password whose length differs from `APP_PASSWORD`
- **THEN** the handler returns 401 `{error:'invalid'}` after the same code path used for equal-length mismatches (using `crypto.timingSafeEqual` on equal-length buffers, with a length pre-check that does NOT short-circuit response timing in a measurable way)

#### Scenario: Multibyte input does not throw or 500
- **WHEN** the user submits a password where JS string `.length` equals stored `APP_PASSWORD.length` but the UTF-8 byte length differs (e.g., submitted `'café'` against stored `'abcd'` — both are 4 chars, but `'café'` is 5 bytes in UTF-8)
- **THEN** the handler converts both strings to `Buffer.from(value, 'utf8')` BEFORE the length check, compares `Buffer.length` (byte length), and returns 401 `{error:'invalid'}` without ever calling `crypto.timingSafeEqual` on mismatched-byte-length buffers (which would throw `RangeError` and surface as 500)

### Requirement: Logout clears the cookie
The system SHALL provide a logout endpoint that invalidates the auth cookie.

#### Scenario: Authenticated user clicks Logout
- **WHEN** a user with a valid `aeo_auth` cookie clicks the "Logout" link in the `/audit` header
- **THEN** the client POSTs to `/api/logout`
- **AND** the server returns 204 with `Set-Cookie: aeo_auth=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`
- **AND** the client redirects to `/`

### Requirement: Proxy-protected routes
The system SHALL block unauthenticated access to `/audit`, `/api/run`, and `/api/cell` via a Next.js 16 `proxy.ts` file (the renamed-from-`middleware.ts` convention; function exported as `proxy`, not `middleware`).

#### Scenario: Unauthenticated GET to `/audit` redirects
- **WHEN** a request without a valid `aeo_auth` cookie hits `/audit`
- **THEN** proxy returns a 307 redirect to `/`

#### Scenario: Unauthenticated POST to `/api/run` returns 401
- **WHEN** a request without a valid `aeo_auth` cookie POSTs to `/api/run`
- **THEN** proxy returns 401 `{error:'unauthorized'}` with `Content-Type: application/json` (never HTML)

#### Scenario: Unauthenticated POST to `/api/cell` returns 401
- **WHEN** a request without a valid `aeo_auth` cookie POSTs to `/api/cell`
- **THEN** proxy returns 401 `{error:'unauthorized'}` with `Content-Type: application/json`

#### Scenario: Tampered cookie is rejected
- **WHEN** a request arrives with `aeo_auth=ok.<bad-hmac>`
- **THEN** proxy treats it as unauthenticated (verify HMAC over `'ok'` with `COOKIE_SECRET`, reject if not equal)

### Requirement: Server misconfiguration surfaces as 500, not silent fallback
The system SHALL refuse to authenticate or run audits if `APP_PASSWORD`, `OPENROUTER_API_KEY`, or `COOKIE_SECRET` is missing from the environment.

#### Scenario: APP_PASSWORD unset on /api/auth call
- **WHEN** `process.env.APP_PASSWORD` is `undefined` or empty and `POST /api/auth` is called
- **THEN** the server returns 500 `{error:'server misconfigured'}` and logs to stderr (without echoing values)

#### Scenario: COOKIE_SECRET unset
- **WHEN** `process.env.COOKIE_SECRET` is `undefined` or empty and `POST /api/auth` is called
- **THEN** the server returns 500 `{error:'server misconfigured'}` and does not set any cookie

### Requirement: Secrets never appear in client bundles or non-server code
The system SHALL only reference `APP_PASSWORD`, `OPENROUTER_API_KEY`, and `COOKIE_SECRET` from `lib/auth.ts`, `lib/openrouter.ts`, and files under `app/api/**/route.ts`.

#### Scenario: Repository grep audit passes
- **WHEN** `grep -r "process.env.APP_PASSWORD\|process.env.OPENROUTER_API_KEY\|process.env.COOKIE_SECRET" .` is run on the repo
- **THEN** all matches are inside `lib/auth.ts`, `lib/openrouter.ts`, or `app/api/**/route.ts`
- **AND** no client component, page, proxy, or shared `lib/` file (e.g., `models.ts`, `analyze.ts`, `reportCard.ts`, `types.ts`) references any of those env vars

#### Scenario: Production JS bundle audit passes
- **WHEN** the Vercel production build output is inspected (Network tab on `/audit`, or `.next/static/chunks/*`)
- **THEN** zero references to the literal values of `APP_PASSWORD`, `OPENROUTER_API_KEY`, or `COOKIE_SECRET` appear in any JS chunk
