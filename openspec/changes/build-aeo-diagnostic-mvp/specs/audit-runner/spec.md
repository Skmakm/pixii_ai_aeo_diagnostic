## ADDED Requirements

### Requirement: Audit input form
The system SHALL render `/audit` with a brand input, a 1–5 query textarea, and a Run button, with client-side validation before submission.

#### Scenario: Valid input enables Run
- **WHEN** the user enters a non-empty trimmed brand (≤60 chars) and 1–5 non-empty trimmed lines in the textarea
- **THEN** the Run button is enabled and clicking it triggers `POST /api/run`

#### Scenario: Empty brand blocks Run
- **WHEN** the user clicks Run with an empty or whitespace-only brand
- **THEN** the form shows inline red error text "Brand is required" and does not POST

#### Scenario: Zero or six+ queries blocks Run
- **WHEN** the user clicks Run with zero non-empty lines OR more than 5 non-empty lines (after splitting by `\n` and trimming each)
- **THEN** the form shows inline red error text "Enter 1–5 queries" and does not POST

#### Scenario: Run button is disabled while a run is in progress
- **WHEN** a run is in progress (SSE stream open, `done:true` not yet received)
- **THEN** the Run button is `disabled` and shows a spinner
- **AND** the brand input and query textarea are `readOnly`

#### Scenario: New run replaces previous results
- **WHEN** the user starts a new run after a prior run has completed
- **THEN** the previous grid and Report Card values are cleared from React state before the new SSE stream begins emitting

### Requirement: Server fans out queries × 5 parallel OpenRouter calls
The system SHALL fire `queries.length × 5` parallel calls to OpenRouter from `POST /api/run`, never including the brand string in any model prompt.

#### Scenario: Brand never appears in upstream payload
- **WHEN** `POST /api/run` is invoked with `{brand:'Sleepwell', queries:['best magnesium']}`
- **THEN** every outbound HTTP request body to `https://openrouter.ai/api/v1/chat/completions` contains `messages: [{role:'user', content:'best magnesium'}]` and nowhere contains the substring `Sleepwell`

#### Scenario: Each call uses fixed parameters
- **WHEN** `POST /api/run` invokes any `callModel`
- **THEN** the request body has `temperature: 0.2`, `max_tokens: 600`, exactly one user message equal verbatim to the query string

### Requirement: SSE streaming of per-cell results
The system SHALL emit one `data:` SSE event per cell as soon as it settles (success or error), and a final `data: {done:true}` once all cells have settled.

#### Scenario: Each settled cell emits an event
- **WHEN** an individual `callModel` promise resolves with a successful response
- **THEN** the SSE stream emits `data: {queryIdx, modelId, status:'done', text, latencyMs, mentioned, rank, competitors}\n\n` immediately, before any other pending cells settle

#### Scenario: Stream closes after all settle
- **WHEN** every one of the `queries.length × 5` cell promises has settled (resolved or rejected)
- **THEN** the SSE stream emits `data: {"done":true}\n\n` and closes the response

#### Scenario: First event arrives within 5 seconds
- **WHEN** `POST /api/run` is hit with one query and 5 valid free models under normal conditions
- **THEN** the first `data:` event reaches the client within 5 seconds of request acceptance (NF2)

### Requirement: Client disconnect cancels in-flight upstream calls
The system SHALL abort all in-flight OpenRouter requests when the SSE stream is cancelled by the client (browser navigation, fetch abort, page unload), so that abandoned runs do not continue burning compute or OpenRouter quota.

#### Scenario: Client cancels mid-stream
- **WHEN** the client cancels the response body's reader (or the underlying TCP connection drops) before all cells have settled
- **THEN** the `ReadableStream`'s `cancel()` handler runs and calls `.abort()` on every in-flight per-cell `AbortController`
- **AND** no further `data:` events are enqueued
- **AND** any subsequently-settled `callModel` promises are silently discarded

### Requirement: Per-cell timeout isolates failures
The system SHALL apply a 60-second timeout to each individual cell, and a single cell failure (timeout, 4xx, 5xx, network error) SHALL NOT abort other cells.

#### Scenario: Timeout produces error event for that cell only
- **WHEN** a single `callModel` promise does not settle within 60 seconds
- **THEN** the server aborts that one request via `AbortController.abort()`
- **AND** emits `data: {queryIdx, modelId, status:'error', error:'timeout', latencyMs:60000}\n\n`
- **AND** all other cells continue to stream their own events

#### Scenario: 429 from OpenRouter maps to friendly error string
- **WHEN** OpenRouter returns HTTP 429 for a cell
- **THEN** the SSE event for that cell has `error: 'rate limit — try again in a minute'`

#### Scenario: 5xx from OpenRouter maps to friendly error string
- **WHEN** OpenRouter returns HTTP 5xx for a cell
- **THEN** the SSE event for that cell has `error: 'upstream error'` and no retry is attempted on the first run

#### Scenario: 404 model unavailable maps to friendly error string
- **WHEN** OpenRouter returns HTTP 404 (slug not found) for a cell
- **THEN** the SSE event has `error: 'model unavailable'` and the server logs a warning to stderr (without secrets)

#### Scenario: Error message strings come from a fixed enum, never raw exception text
- **WHEN** any cell errors for any reason
- **THEN** the `error` field is one of `'timeout' | 'rate limit — try again in a minute' | 'upstream error' | 'model unavailable' | 'server misconfigured'` and never contains a stack trace, request URL, or the value of `OPENROUTER_API_KEY`

### Requirement: Single-cell retry endpoint
The system SHALL provide `POST /api/cell` that re-runs exactly one (brand, query, modelId) cell and returns a JSON `CellState`.

#### Scenario: Retry call returns updated cell
- **WHEN** the user clicks Retry on a cell that has `status:'error'`
- **THEN** the client POSTs `{brand, query, modelId}` to `/api/cell`
- **AND** the server returns 200 JSON `{status:'done', text, latencyMs, analysis}` on success or `{status:'error', error, latencyMs}` on failure

#### Scenario: Retry endpoint enforces auth
- **WHEN** an unauthenticated request hits `POST /api/cell`
- **THEN** middleware returns 401 `{error:'unauthorized'}`

#### Scenario: Retry validates modelId
- **WHEN** `POST /api/cell` receives a `modelId` not present in `MODELS`
- **THEN** the server returns 400 `{error:'unknown model'}`

### Requirement: Run handler validates input
The system SHALL validate `POST /api/run` request body and return structured 400/401/500 JSON before opening the SSE stream.

#### Scenario: Malformed JSON
- **WHEN** the request body is not valid JSON or missing `brand` or `queries`
- **THEN** the server returns 400 `{error:'invalid body'}` with `Content-Type: application/json`, never opens an SSE stream

#### Scenario: queries.length > 5
- **WHEN** the request has more than 5 non-empty queries
- **THEN** the server returns 400 `{error:'too many queries'}` and never opens an SSE stream

#### Scenario: brand longer than 60 chars
- **WHEN** the request has a brand string longer than 60 characters after trimming
- **THEN** the server returns 400 `{error:'brand too long'}`

#### Scenario: OPENROUTER_API_KEY missing
- **WHEN** `process.env.OPENROUTER_API_KEY` is unset and `POST /api/run` is called
- **THEN** the server returns 500 `{error:'server misconfigured'}` and never opens an SSE stream

#### Scenario: Non-string entry in queries array rejected
- **WHEN** the request has `queries: [123, "best CRM"]` (or any element whose `typeof !== 'string'`)
- **THEN** the server returns 400 `{error:'invalid body'}` and never opens an SSE stream
- **AND** does NOT silently coerce or drop the non-string entry

