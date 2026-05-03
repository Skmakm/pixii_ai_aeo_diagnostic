## ADDED Requirements

### Requirement: Audit page layout
The system SHALL render `/audit` with a header (app name left, Logout button right), a brand input, a 1–5 query textarea, a Run button, a Report Card panel, and a Results grid below it.

#### Scenario: Default layout on viewport ≥900px
- **WHEN** an authenticated user loads `/audit` on a 1280px-wide viewport
- **THEN** the page shows: header bar; brand single-line input (max-width 1100px); textarea (6 rows, monospace, max-width 1100px); Run button (right-aligned, primary); Report Card panel below the form; one query block per query, each followed by a 5-column grid

#### Scenario: Mobile layout below 900px
- **WHEN** the viewport is narrower than 900px
- **THEN** each query block stacks the 5 model cells vertically (one cell per row), Run button becomes full-width

### Requirement: Cell rendering
The system SHALL render each cell as a shadcn `Card` with model label header, response markdown body, and latency or error footer.

#### Scenario: Successful cell shows markdown
- **WHEN** a cell receives a successful SSE event with markdown text including bullets, bold, and code blocks
- **THEN** the cell renders the markdown via `react-markdown` + `remark-gfm` so bullets become `<ul>`, bold becomes `<strong>`, code fences become `<pre><code>`

#### Scenario: Pending cell shows skeleton with aria-busy
- **WHEN** a cell has not yet received an SSE event
- **THEN** the cell renders a shadcn `Skeleton` placeholder with `aria-busy="true"` (NF8)

#### Scenario: Error cell shows alert with retry
- **WHEN** a cell receives an SSE event with `status:'error'`
- **THEN** the cell renders red error text with `role="alert"` (NF8) and a Retry `<Button variant="ghost">`

#### Scenario: Brand highlighted with `<mark>` in every cell
- **WHEN** a cell's response text contains the brand `'Sleepwell'` (any case)
- **THEN** every case-insensitive occurrence inside rendered markdown text is wrapped in `<mark>` (yellow highlight) — including occurrences inside list items and bold text — without breaking markdown structure

#### Scenario: Copy button copies response body
- **WHEN** the user clicks the per-cell Copy button on a done cell
- **THEN** the cell's raw markdown response (not the rendered HTML) is written to the clipboard via `navigator.clipboard.writeText`

#### Scenario: Cell width constraints
- **WHEN** the grid renders on viewport ≥900px
- **THEN** each of the 5 columns has equal width with a minimum cell width of 280px

### Requirement: Report Card panel
The system SHALL render a Report Card panel above the results grid showing aggregate stats and updating live as SSE events arrive.

#### Scenario: Report Card appears as soon as first cell completes
- **WHEN** the first SSE event with `status:'done'` arrives
- **THEN** the Report Card panel renders with the partial aggregate values (mentioned count, average rank, best/worst model, top competitors) computed from cells settled so far (AC15)

#### Scenario: Report Card updates on every event
- **WHEN** any new SSE event arrives (done or error)
- **THEN** the Report Card re-aggregates from the current grid state and re-renders the four numeric/string fields and top-3 competitor list

#### Scenario: Report Card locks final values on done
- **WHEN** the SSE stream emits `data: {done:true}`
- **THEN** the Report Card no longer changes until a new run begins

#### Scenario: Mention rate display
- **WHEN** the Report Card has `mentionedCount=11, totalCells=25`
- **THEN** it displays "Mentioned in: 11 / 25 cells" with a horizontal progress bar at 44%

#### Scenario: Top competitors lists 3 entries
- **WHEN** at least 3 distinct competitors have been extracted across cells
- **THEN** the Report Card shows a numbered list of the top 3 by mention count with format "<title-cased name> (mentioned in N/M cells, avg rank X.X)"

#### Scenario: All-models-failed banner
- **WHEN** all 5 model cells for a single query have `status:'error'`
- **THEN** an inline red banner above that query's row displays "All models failed for query N — check OpenRouter dashboard"

### Requirement: Acceptance flow
The system SHALL satisfy the visible end-to-end flows described by PRD acceptance criteria AC1–AC10, AC15–AC17.

#### Scenario: AC5 single query 5 cells fill within 30s
- **WHEN** an authenticated user enters a brand and one query and clicks Run under normal conditions
- **THEN** all 5 cells visually transition from skeleton to done (or error) within 30 seconds

#### Scenario: AC6 5 queries → 25 cells fill within 60s
- **WHEN** an authenticated user enters a brand and 5 queries and clicks Run under normal conditions
- **THEN** all 25 cells visually transition from skeleton to done (or error) within 60 seconds

#### Scenario: AC7 cells fill incrementally not all-at-once
- **WHEN** a run is in progress
- **THEN** at least two distinct render frames show different counts of done cells (i.e., cells appear over time, not all at the final SSE message)

#### Scenario: AC9 refresh clears results
- **WHEN** the user refreshes `/audit` after a completed run
- **THEN** all grid cells, Report Card values, brand input value, and textarea content are reset to empty/initial state
