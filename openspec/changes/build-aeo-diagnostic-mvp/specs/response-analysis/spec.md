## ADDED Requirements

### Requirement: Pure analyzer extracts mentioned/rank/competitors
The system SHALL provide a synchronous pure function `analyze(brand: string, response: string): {mentioned, rank, competitors}` that uses only string and regex operations, performs no I/O, no LLM calls, and completes in under 5 ms per response on a typical Vercel cold start.

**Note (deviation from PRD §9):** `competitors` is `Competitor[]` where `Competitor = {name: string, rank: number}`, not the PRD's `string[]`. The `rank` field is the **original numbered-list position** the competitor appeared at (so `"1. Sleepwell, 2. Calm"` analyzed for brand `Sleepwell` produces `competitors: [{name: 'Calm', rank: 2}]`, NOT `[{name: 'Calm', rank: 1}]`). This is required because the brand line is filtered out, so the array index no longer corresponds to the original list rank — without the explicit `rank` field, downstream `buildReportCard` averages would systematically under-rank competitors that appeared after the brand. See design D16.

#### Scenario: Brand mentioned in free text returns mentioned=true, rank=null
- **WHEN** `analyze('Sleepwell', 'I really like Sleepwell, it works for me.')` is called
- **THEN** the result is `{mentioned: true, rank: null, competitors: []}`

#### Scenario: Brand at numbered-list position 3 returns rank=3
- **WHEN** `analyze('Sleepwell', '1. Calm\n2. Natural Vitality\n3. Sleepwell - good for sleep\n4. Doctor\'s Best')` is called
- **THEN** the result has `mentioned: true, rank: 3, competitors: ['Calm', 'Natural Vitality', "Doctor's Best"]`

#### Scenario: Brand absent returns mentioned=false
- **WHEN** `analyze('Sleepwell', 'Top picks: Calm, Natural Vitality, Doctor\'s Best.')` is called
- **THEN** the result has `mentioned: false, rank: null, competitors: []` (no numbered list → no competitors extracted)

#### Scenario: Case-insensitive brand match
- **WHEN** `analyze('SLEEPWELL', 'i recommend sleepwell daily')` is called
- **THEN** `mentioned` is `true`

#### Scenario: Brand with regex metacharacters does not crash
- **WHEN** `analyze('A.B+C*', 'I use A.B+C* every morning')` is called
- **THEN** the result is `{mentioned: true, rank: null, competitors: []}` (no exception, treats brand as plain string)

#### Scenario: Numbered-list with parens delimiter is recognized
- **WHEN** the response contains `1) Calm\n2) Sleepwell\n3) Doctor's Best`
- **THEN** the analyzer matches the `^\s*(\d+)[.)]\s+` pattern and assigns rank=2 for brand 'Sleepwell'

#### Scenario: Markdown bold/italic markers stripped from competitor names
- **WHEN** the response contains `1. **Calm Magnesium** — best for sleep`
- **THEN** the extracted competitor name is `Calm Magnesium` (no `**`, no trailing ` — best for sleep`)

#### Scenario: Competitors capped at 5
- **WHEN** the response is a numbered list of 8 brand names not matching the user's brand
- **THEN** the `competitors` array contains exactly 5 entries (the first 5 by list position)

#### Scenario: Empty response
- **WHEN** `analyze('Sleepwell', '')` is called
- **THEN** the result is `{mentioned: false, rank: null, competitors: []}`

#### Scenario: Competitor rank preserves original list position after brand removal
- **WHEN** the response is `"1. Sleepwell\n2. Calm\n3. Doctor's Best"` and brand is `'Sleepwell'`
- **THEN** `competitors === [{name: 'Calm', rank: 2}, {name: "Doctor's Best", rank: 3}]`
- **AND** the `rank` field reflects the original numbered-list position from the response, NOT the position in the filtered `competitors` array

### Requirement: Report Card aggregates cells live
The system SHALL provide a pure function `buildReportCard(grid, brand, models)` that aggregates the current `ResultsGrid` into a `ReportCard` and SHALL be re-invoked on every SSE event so the UI updates incrementally.

#### Scenario: Mention rate
- **WHEN** 11 of 25 done cells have `analysis.mentioned === true`
- **THEN** `mentionedCount === 11` and `totalCells === 25`, `doneCells === 25`

#### Scenario: Average rank ignores nulls
- **WHEN** done cells have ranks `[1, 2, 3, null, null]`
- **THEN** `averageRank === 2` (mean of `[1,2,3]`)

#### Scenario: Average rank null when no mentions
- **WHEN** no done cell has a non-null rank
- **THEN** `averageRank === null`

#### Scenario: Best model is the one with most #1 ranks
- **WHEN** Llama has rank=1 in 2 cells and Qwen has rank=1 in 1 cell
- **THEN** `bestModel.id === 'llama'` and `bestModel.reason` is `'ranked #1 in 2 queries'`

#### Scenario: Best model tiebreak by mention count
- **WHEN** two models tie at zero #1 ranks
- **THEN** `bestModel` is the one with the higher mention count, and `reason` is `'mentioned in N/M cells'`

#### Scenario: Worst model is the one with fewest mentions
- **WHEN** Nemotron has 0 mentions and all other models have ≥1 mention
- **THEN** `worstModel.id === 'nemotron'` and `worstModel.reason` is `'never mentioned'`

#### Scenario: Top competitors deduped via normalized names
- **WHEN** done cells produce competitor lists `['Calm Inc', 'CALM INC.', 'calm inc', 'Doctor\'s Best LLC', 'Natural Vitality']`
- **THEN** after normalization (lowercase + strip suffixes ` inc`, ` inc.`, ` llc`), `'calm'` has count 3, `'doctor\'s best'` count 1, `'natural vitality'` count 1
- **AND** `topCompetitors` lists `[{name:'calm', count:3, ...}, {name:'doctor\'s best', count:1, ...}, {name:'natural vitality', count:1, ...}]` (display layer may title-case for UI)

#### Scenario: Top competitors excludes the user brand
- **WHEN** the user brand is `'Sleepwell'` and one cell's competitors include `'Sleepwell'`
- **THEN** that occurrence is dropped from the competitor count after both names are normalized

#### Scenario: Pure function — no I/O
- **WHEN** `buildReportCard` is invoked
- **THEN** it makes zero network calls, file reads, or env reads, and is deterministic given the same input

### Requirement: Competitor name normalization preserves verticals
The system SHALL normalize competitor names by lowercasing, trimming, and stripping a fixed list of generic legal/corporate suffixes (`inc`, `inc.`, `llc`, `ltd`, `ltd.`, `corp`, `corp.`, `co`, `co.`, `company`, `brands`, `co., ltd.`), and SHALL NOT strip product-category words (e.g., `magnesium`, `vitamin`, `supplement`, `coffee`, `bike`).

#### Scenario: Legal suffix stripped
- **WHEN** normalizing `'Calm Inc.'`
- **THEN** the result is `'calm'`

#### Scenario: Product noun preserved
- **WHEN** normalizing `'Calm Magnesium'`
- **THEN** the result is `'calm magnesium'` (the word `magnesium` is NOT stripped)
