import { describe, it, expect } from 'vitest';
import { buildReportCard } from '../reportCard';
import type { CellState, Model, ResultsGrid } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGrid(cells: CellState[][]): ResultsGrid {
  return cells;
}

function doneCell(
  mentioned: boolean,
  rank: number | null,
  competitors: (string | { name: string; rank: number })[] = [],
): CellState {
  // String shorthand: position in array maps to 1-indexed rank.
  const normalized = competitors.map((c, i) =>
    typeof c === 'string' ? { name: c, rank: i + 1 } : c,
  );
  return {
    status: 'done',
    text: '',
    latencyMs: 0,
    analysis: { mentioned, rank, competitors: normalized },
  };
}

function pendingCell(): CellState {
  return { status: 'pending' };
}

function errorCell(error = 'err'): CellState {
  return { status: 'error', error, latencyMs: 0 };
}

// Minimal 5-model array that matches MODELS shape
const MODELS: readonly Model[] = [
  { id: 'gemma', label: 'Gemma 4 26B', slug: 'google/gemma-4-26b-a4b-it:free' },
  { id: 'llama', label: 'Llama 3.3 70B', slug: 'meta-llama/llama-3.3-70b-instruct:free' },
  { id: 'qwen', label: 'Qwen3 Next 80B', slug: 'qwen/qwen3-next-80b-a3b-instruct:free' },
  { id: 'gpt-oss', label: 'GPT-OSS 120B', slug: 'openai/gpt-oss-120b:free' },
  { id: 'nemotron', label: 'Nemotron 3 Super 120B', slug: 'nvidia/nemotron-3-super-120b-a12b:free' },
] as const;

// ---------------------------------------------------------------------------
// Scenario: Mention rate (11/25)
// ---------------------------------------------------------------------------

describe('Mention rate', () => {
  it('mentionedCount is 11 when 11 of 25 done cells are mentioned', () => {
    // 5 queries × 5 models = 25 cells total; 11 have mentioned=true
    const rows: CellState[][] = [];
    let mentionedSoFar = 0;
    for (let q = 0; q < 5; q++) {
      const row: CellState[] = [];
      for (let m = 0; m < 5; m++) {
        const shouldMention = mentionedSoFar < 11;
        row.push(doneCell(shouldMention, null));
        if (shouldMention) mentionedSoFar++;
      }
      rows.push(row);
    }
    const grid = makeGrid(rows);
    const card = buildReportCard(grid, 'TestBrand', MODELS);
    expect(card.totalCells).toBe(25);
    expect(card.doneCells).toBe(25);
    expect(card.mentionedCount).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// Scenario: Average rank ignores nulls
// ---------------------------------------------------------------------------

describe('Average rank', () => {
  it('averageRank is 2 when ranks are [1, 2, 3, null, null] across 5 done cells', () => {
    // Use 1 query × 5 models
    const grid = makeGrid([
      [
        doneCell(true, 1),
        doneCell(true, 2),
        doneCell(true, 3),
        doneCell(true, null),
        doneCell(true, null),
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.averageRank).toBe(2);
  });

  it('averageRank is null when no done cell has a non-null rank', () => {
    const grid = makeGrid([
      [
        doneCell(false, null),
        doneCell(false, null),
        doneCell(false, null),
        doneCell(false, null),
        doneCell(false, null),
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.averageRank).toBeNull();
  });

  it('averageRank rounds to 1 decimal place', () => {
    // ranks [1, 2] → mean = 1.5
    const grid = makeGrid([
      [
        doneCell(true, 1),
        doneCell(true, 2),
        doneCell(false, null),
        doneCell(false, null),
        doneCell(false, null),
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.averageRank).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// Scenario: Best model is the one with most #1 ranks
// ---------------------------------------------------------------------------

describe('Best model — most #1 ranks', () => {
  it('bestModel.id is llama when llama has rank=1 in 2 cells and qwen has rank=1 in 1 cell', () => {
    // 2 queries × 5 models
    // llama (idx 1): rank=1 in both queries
    // qwen  (idx 2): rank=1 in 1 query
    const grid = makeGrid([
      [
        doneCell(false, null), // gemma
        doneCell(true, 1),    // llama: rank=1
        doneCell(true, 1),    // qwen: rank=1
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
      [
        doneCell(false, null), // gemma
        doneCell(true, 1),    // llama: rank=1 again
        doneCell(true, 2),    // qwen: rank=2
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel).not.toBeNull();
    expect(card.bestModel!.id).toBe('llama');
    expect(card.bestModel!.reason).toBe('ranked #1 in 2 queries');
  });

  it('reason is singular "query" when #1 rank count is exactly 1', () => {
    const grid = makeGrid([
      [
        doneCell(true, 1),    // gemma: rank=1
        doneCell(true, 2),    // llama
        doneCell(false, null), // qwen
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel!.reason).toBe('ranked #1 in 1 query');
  });
});

// ---------------------------------------------------------------------------
// Scenario: Best model tiebreak by mention count
// ---------------------------------------------------------------------------

describe('Best model tiebreak by mention count', () => {
  it('when two models tie at zero #1 ranks, picks the one with higher mention count', () => {
    // gemma (idx 0): mentioned=true, rank=2
    // llama (idx 1): mentioned=true, rank=2 AND mentioned=true, rank=3 (2 mentions)
    // qwen-nemotron-gptoss: no mentions
    const grid = makeGrid([
      [
        doneCell(true, 2),    // gemma: 1 mention, 0 first-ranks
        doneCell(true, 2),    // llama: 1st mention, 0 first-ranks
        doneCell(false, null), // qwen
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
      [
        doneCell(false, null), // gemma: no 2nd mention
        doneCell(true, 3),    // llama: 2nd mention
        doneCell(false, null), // qwen
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel!.id).toBe('llama');
    expect(card.bestModel!.reason).toBe('mentioned in 2/2 cells');
  });

  it('when all models tie at zero #1 ranks and zero mentions, earliest in array wins', () => {
    const grid = makeGrid([
      [
        doneCell(false, null), // gemma
        doneCell(false, null), // llama
        doneCell(false, null), // qwen
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel!.id).toBe('gemma');
    expect(card.bestModel!.reason).toBe('no mentions recorded');
  });

  it('reason uses mention/cell format when no #1 ranks but has mentions', () => {
    const grid = makeGrid([
      [
        doneCell(true, 2),    // gemma: mentioned
        doneCell(false, null), // llama
        doneCell(false, null), // qwen
        doneCell(false, null), // gpt-oss
        doneCell(false, null), // nemotron
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel!.id).toBe('gemma');
    expect(card.bestModel!.reason).toBe('mentioned in 1/1 cells');
  });
});

// ---------------------------------------------------------------------------
// Scenario: Worst model is the one with fewest mentions
// ---------------------------------------------------------------------------

describe('Worst model — fewest mentions', () => {
  it('worstModel.id is nemotron when nemotron has 0 mentions and others have ≥1', () => {
    // 1 query × 5 models
    const grid = makeGrid([
      [
        doneCell(true, 1),  // gemma: 1 mention
        doneCell(true, 2),  // llama: 1 mention
        doneCell(true, 3),  // qwen: 1 mention
        doneCell(true, 4),  // gpt-oss: 1 mention
        doneCell(false, null), // nemotron: 0 mentions
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.worstModel).not.toBeNull();
    expect(card.worstModel!.id).toBe('nemotron');
    expect(card.worstModel!.reason).toBe('never mentioned');
  });

  it('worstModel reason uses "mentioned in M/N cells" when it has some mentions', () => {
    // gemma: 1 mention, llama: 2 mentions, rest: 2 mentions each
    const grid = makeGrid([
      [
        doneCell(true, 1),  // gemma
        doneCell(true, 1),  // llama
        doneCell(true, 1),  // qwen
        doneCell(true, 1),  // gpt-oss
        doneCell(true, 1),  // nemotron
      ],
      [
        doneCell(false, null), // gemma: only 1 total mention
        doneCell(true, 2),    // llama
        doneCell(true, 2),    // qwen
        doneCell(true, 2),    // gpt-oss
        doneCell(true, 2),    // nemotron
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.worstModel!.id).toBe('gemma');
    expect(card.worstModel!.reason).toBe('mentioned in 1/2 cells');
  });

  it('worstModel tiebreak: when two models tie at same mention count, higher average rank (worse) loses', () => {
    // All 5 models have exactly 1 mention, so tiebreak by avg rank
    // gemma: rank=5 (worst position), llama: rank=2, qwen: rank=3, gpt-oss: rank=1, nemotron: rank=4
    // → gemma is "worst" because its avg rank is the highest (5)
    const grid = makeGrid([
      [
        doneCell(true, 5),  // gemma: mentioned, rank=5 → worst avg rank
        doneCell(true, 2),  // llama: mentioned, rank=2
        doneCell(true, 3),  // qwen: mentioned, rank=3
        doneCell(true, 1),  // gpt-oss: mentioned, rank=1
        doneCell(true, 4),  // nemotron: mentioned, rank=4
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    // All tied at 1 mention; gemma has the highest avg rank (5) → worst
    expect(card.worstModel!.id).toBe('gemma');
  });
});

// ---------------------------------------------------------------------------
// Scenario: bestModel / worstModel null when no done cells
// ---------------------------------------------------------------------------

describe('bestModel and worstModel null when no done cells', () => {
  it('returns null for bestModel and worstModel when grid has only pending cells', () => {
    const grid = makeGrid([
      [pendingCell(), pendingCell(), pendingCell(), pendingCell(), pendingCell()],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel).toBeNull();
    expect(card.worstModel).toBeNull();
    expect(card.doneCells).toBe(0);
  });

  it('returns null for bestModel and worstModel when grid has only error cells', () => {
    const grid = makeGrid([
      [errorCell(), errorCell(), errorCell(), errorCell(), errorCell()],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.bestModel).toBeNull();
    expect(card.worstModel).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Scenario: Top competitors deduped via normalized names
// ---------------------------------------------------------------------------

describe('Top competitors deduped via normalized names', () => {
  it("'Calm Inc', 'CALM INC.', 'calm inc' → calm:3; \"Doctor's Best LLC\"→1; 'Natural Vitality'→1", () => {
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(false, null, ['Calm Inc', 'CALM INC.', 'calm inc', "Doctor's Best LLC", 'Natural Vitality'])],
    ]);
    const card = buildReportCard(grid, 'Brand', singleModel);
    const calm = card.topCompetitors.find((c) => c.name === 'calm');
    const doctorsBest = card.topCompetitors.find((c) => c.name === "doctor's best");
    const naturalVitality = card.topCompetitors.find((c) => c.name === 'natural vitality');

    expect(calm).toBeDefined();
    expect(calm!.count).toBe(3);
    expect(doctorsBest).toBeDefined();
    expect(doctorsBest!.count).toBe(1);
    expect(naturalVitality).toBeDefined();
    expect(naturalVitality!.count).toBe(1);
  });

  it('top 3 are sorted by count descending', () => {
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(false, null, ['Calm Inc', 'CALM INC.', 'calm inc', "Doctor's Best LLC", 'Natural Vitality'])],
    ]);
    const card = buildReportCard(grid, 'Brand', singleModel);
    expect(card.topCompetitors[0].name).toBe('calm');
    expect(card.topCompetitors[0].count).toBe(3);
  });

  it('topCompetitors has at most 3 entries', () => {
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(false, null, ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'])],
    ]);
    const card = buildReportCard(grid, 'Brand', singleModel);
    expect(card.topCompetitors.length).toBeLessThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Scenario: Top competitors excludes the user brand (after normalization)
// ---------------------------------------------------------------------------

describe('Top competitors excludes the user brand', () => {
  it('drops Sleepwell from competitor list when brand is Sleepwell', () => {
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(true, 1, ['Sleepwell', 'Calm', 'Natural Vitality'])],
    ]);
    const card = buildReportCard(grid, 'Sleepwell', singleModel);
    const names = card.topCompetitors.map((c) => c.name);
    expect(names).not.toContain('sleepwell');
    expect(names).toContain('calm');
    expect(names).toContain('natural vitality');
  });

  it('brand normalization: "Sleepwell Inc" brand drops "sleepwell" competitor', () => {
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(false, null, ['Sleepwell', 'Calm'])],
    ]);
    // brand with suffix — normalizeCompetitor('Sleepwell Inc') === 'sleepwell'
    // normalizeCompetitor('Sleepwell') === 'sleepwell' → should be dropped
    const card = buildReportCard(grid, 'Sleepwell Inc', singleModel);
    const names = card.topCompetitors.map((c) => c.name);
    expect(names).not.toContain('sleepwell');
    expect(names).toContain('calm');
  });
});

// ---------------------------------------------------------------------------
// Scenario: avgRank for competitors uses 1-indexed position in competitors array
// ---------------------------------------------------------------------------

describe('Top competitors avgRank', () => {
  it('avgRank is the mean of original list ranks across appearances', () => {
    // cell1: Calm at original rank 1; cell2: Calm at original rank 3 → avg = 2.0
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(false, null, [{ name: 'Calm', rank: 1 }, { name: 'Alpha', rank: 2 }, { name: 'Beta', rank: 3 }])],
      [doneCell(false, null, [{ name: 'Alpha', rank: 1 }, { name: 'Beta', rank: 2 }, { name: 'Calm', rank: 3 }])],
    ]);
    const card = buildReportCard(grid, 'Brand', singleModel);
    const calm = card.topCompetitors.find((c) => c.name === 'calm');
    expect(calm).toBeDefined();
    expect(calm!.avgRank).toBe(2.0);
  });

  it('regression: brand-removed list preserves original rank for competitors', () => {
    // Model returned "1. Sleepwell, 2. Calm, 3. Doctor's Best"
    // analyze() emits competitors=[{name:'Calm',rank:2}, {name:"Doctor's Best",rank:3}]
    // Calm's avgRank must be 2.0, NOT 1.0 (the old buggy index+1 calc)
    const singleModel: Model[] = [MODELS[0]];
    const grid = makeGrid([
      [doneCell(true, 1, [{ name: 'Calm', rank: 2 }, { name: "Doctor's Best", rank: 3 }])],
    ]);
    const card = buildReportCard(grid, 'Sleepwell', singleModel);
    const calm = card.topCompetitors.find((c) => c.name === 'calm');
    expect(calm).toBeDefined();
    expect(calm!.avgRank).toBe(2.0);
  });
});

// ---------------------------------------------------------------------------
// Scenario: Pure function — same input → same output; mixed cell statuses
// ---------------------------------------------------------------------------

describe('Pure function', () => {
  it('same input produces the same output (deterministic)', () => {
    const grid = makeGrid([
      [
        doneCell(true, 1, ['Calm', 'Natural Vitality']),
        doneCell(false, null),
        doneCell(true, 2),
        doneCell(false, null),
        doneCell(false, null),
      ],
    ]);
    const card1 = buildReportCard(grid, 'Sleepwell', MODELS);
    const card2 = buildReportCard(grid, 'Sleepwell', MODELS);
    expect(card1).toEqual(card2);
  });

  it('pending and error cells do not count as done', () => {
    const grid = makeGrid([
      [
        doneCell(true, 1),
        pendingCell(),
        errorCell(),
        doneCell(false, null),
        pendingCell(),
      ],
    ]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.totalCells).toBe(5);
    expect(card.doneCells).toBe(2);
  });

  it('empty grid returns zero counts and null fields', () => {
    const grid = makeGrid([]);
    const card = buildReportCard(grid, 'Brand', MODELS);
    expect(card.totalCells).toBe(0);
    expect(card.doneCells).toBe(0);
    expect(card.mentionedCount).toBe(0);
    expect(card.averageRank).toBeNull();
    expect(card.bestModel).toBeNull();
    expect(card.worstModel).toBeNull();
    expect(card.topCompetitors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Scenario: totalCells derivation from grid shape
// ---------------------------------------------------------------------------

describe('totalCells', () => {
  it('is queries × models derived from grid shape, not models array length', () => {
    // 3 queries × 5 models
    const threeModels = MODELS.slice(0, 3);
    const grid = makeGrid([
      [doneCell(false, null), doneCell(false, null), doneCell(false, null)],
      [doneCell(false, null), doneCell(false, null), doneCell(false, null)],
      [pendingCell(), pendingCell(), pendingCell()],
    ]);
    const card = buildReportCard(grid, 'Brand', threeModels);
    expect(card.totalCells).toBe(9);
  });
});
