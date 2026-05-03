import { describe, it, expect } from 'vitest';
import { analyze } from '../analyze';
import { normalizeCompetitor } from '../normalizeCompetitor';

describe('analyze', () => {
  it('brand mentioned in free text returns mentioned=true, rank=null, competitors=[]', () => {
    const result = analyze('Sleepwell', 'I really like Sleepwell, it works for me.');
    expect(result).toEqual({ mentioned: true, rank: null, competitors: [] });
  });

  it('brand at numbered-list position 3 returns rank=3 and correct competitors', () => {
    const response = "1. Calm\n2. Natural Vitality\n3. Sleepwell - good for sleep\n4. Doctor's Best";
    const result = analyze('Sleepwell', response);
    expect(result.mentioned).toBe(true);
    expect(result.rank).toBe(3);
    expect(result.competitors).toEqual([
      { name: 'Calm', rank: 1 },
      { name: 'Natural Vitality', rank: 2 },
      { name: "Doctor's Best", rank: 4 },
    ]);
  });

  it('preserves original list rank for competitors after brand line removed', () => {
    // Regression: brand at position 1, competitor "Calm" must report rank 2 (not index 0 + 1)
    const response = '1. Sleepwell\n2. Calm\n3. Doctor\'s Best';
    const result = analyze('Sleepwell', response);
    expect(result.competitors).toEqual([
      { name: 'Calm', rank: 2 },
      { name: "Doctor's Best", rank: 3 },
    ]);
  });

  it('brand absent returns mentioned=false, rank=null, competitors=[]', () => {
    const result = analyze('Sleepwell', "Top picks: Calm, Natural Vitality, Doctor's Best.");
    expect(result).toEqual({ mentioned: false, rank: null, competitors: [] });
  });

  it('case-insensitive brand match sets mentioned=true', () => {
    const result = analyze('SLEEPWELL', 'i recommend sleepwell daily');
    expect(result.mentioned).toBe(true);
  });

  it('brand with regex metacharacters does not crash', () => {
    const result = analyze('A.B+C*', 'I use A.B+C* every morning');
    expect(result).toEqual({ mentioned: true, rank: null, competitors: [] });
  });

  it('numbered-list with parens delimiter is recognized, rank=2', () => {
    const response = "1) Calm\n2) Sleepwell\n3) Doctor's Best";
    const result = analyze('Sleepwell', response);
    expect(result.mentioned).toBe(true);
    expect(result.rank).toBe(2);
    expect(result.competitors).toEqual([
      { name: 'Calm', rank: 1 },
      { name: "Doctor's Best", rank: 3 },
    ]);
  });

  it('markdown bold markers stripped from competitor names', () => {
    const response = '1. **Calm Magnesium** — best for sleep\n2. Sleepwell';
    const result = analyze('Sleepwell', response);
    expect(result.competitors).toEqual([{ name: 'Calm Magnesium', rank: 1 }]);
  });

  it('competitors capped at 5 when list has 8 non-brand entries', () => {
    const lines = [
      '1. Alpha',
      '2. Beta',
      '3. Gamma',
      '4. Delta',
      '5. Epsilon',
      '6. Zeta',
      '7. Eta',
      '8. Theta',
    ].join('\n');
    const result = analyze('Sleepwell', lines);
    expect(result.competitors).toHaveLength(5);
    expect(result.competitors).toEqual([
      { name: 'Alpha', rank: 1 },
      { name: 'Beta', rank: 2 },
      { name: 'Gamma', rank: 3 },
      { name: 'Delta', rank: 4 },
      { name: 'Epsilon', rank: 5 },
    ]);
  });

  it('empty response returns all false/null/empty', () => {
    const result = analyze('Sleepwell', '');
    expect(result).toEqual({ mentioned: false, rank: null, competitors: [] });
  });

  it('case-insensitive brand match in numbered list', () => {
    const response = '1. Calm\n2. SLEEPWELL\n3. Natural Vitality';
    const result = analyze('sleepwell', response);
    expect(result.mentioned).toBe(true);
    expect(result.rank).toBe(2);
    expect(result.competitors).toEqual([
      { name: 'Calm', rank: 1 },
      { name: 'Natural Vitality', rank: 3 },
    ]);
  });

  it('indented sub-bullets (>3 leading spaces) are ignored', () => {
    const response = '1. Calm\n    1. SubItem\n2. Sleepwell\n3. Natural Vitality';
    const result = analyze('Sleepwell', response);
    expect(result.rank).toBe(2);
    expect(result.competitors.find(c => c.name === 'SubItem')).toBeUndefined();
  });

  it('first brand match wins for rank', () => {
    const response = '1. Sleepwell first\n2. Other\n3. Sleepwell again';
    const result = analyze('Sleepwell', response);
    expect(result.rank).toBe(1);
  });

  it('markdown italic markers stripped from competitor names', () => {
    const response = '1. __NaturalVit__ - something\n2. Sleepwell';
    const result = analyze('Sleepwell', response);
    expect(result.competitors).toEqual([{ name: 'NaturalVit', rank: 1 }]);
  });

  it('competitor name truncated at colon', () => {
    const response = '1. BrandX: best supplement\n2. Sleepwell';
    const result = analyze('Sleepwell', response);
    expect(result.competitors).toEqual([{ name: 'BrandX', rank: 1 }]);
  });

  it('competitor name truncated at opening paren', () => {
    const response = '1. BrandY (highly rated)\n2. Sleepwell';
    const result = analyze('Sleepwell', response);
    expect(result.competitors).toEqual([{ name: 'BrandY', rank: 1 }]);
  });

  it('competitor name truncated at 60 chars', () => {
    const longName = 'A'.repeat(70);
    const response = `1. ${longName}\n2. Sleepwell`;
    const result = analyze('Sleepwell', response);
    expect(result.competitors[0].name).toHaveLength(60);
  });
});

describe('normalizeCompetitor', () => {
  it("normalizes 'Calm Inc.' to 'calm'", () => {
    expect(normalizeCompetitor('Calm Inc.')).toBe('calm');
  });

  it("normalizes 'CALM INC.' to 'calm'", () => {
    expect(normalizeCompetitor('CALM INC.')).toBe('calm');
  });

  it("normalizes 'calm inc' to 'calm'", () => {
    expect(normalizeCompetitor('calm inc')).toBe('calm');
  });

  it("normalizes 'Doctor's Best LLC' to \"doctor's best\"", () => {
    expect(normalizeCompetitor("Doctor's Best LLC")).toBe("doctor's best");
  });

  it("preserves product noun: 'Calm Magnesium' stays 'calm magnesium'", () => {
    expect(normalizeCompetitor('Calm Magnesium')).toBe('calm magnesium');
  });

  it("normalizes 'Co., Ltd.' suffix", () => {
    expect(normalizeCompetitor('BrandZ Co., Ltd.')).toBe('brandz');
  });

  it("strips ' corp.' suffix", () => {
    expect(normalizeCompetitor('Acme Corp.')).toBe('acme');
  });

  it("strips ' corp' suffix", () => {
    expect(normalizeCompetitor('Acme Corp')).toBe('acme');
  });

  it("strips ' ltd.' suffix", () => {
    expect(normalizeCompetitor('Acme Ltd.')).toBe('acme');
  });

  it("strips ' ltd' suffix", () => {
    expect(normalizeCompetitor('Acme Ltd')).toBe('acme');
  });

  it("strips ' company' suffix", () => {
    expect(normalizeCompetitor('Acme Company')).toBe('acme');
  });

  it("strips ' brands' suffix", () => {
    expect(normalizeCompetitor('Acme Brands')).toBe('acme');
  });

  it("strips ' co.' suffix", () => {
    expect(normalizeCompetitor('Acme Co.')).toBe('acme');
  });

  it("strips ' co' suffix without eating 'co' in middle of name", () => {
    expect(normalizeCompetitor('Acme Co')).toBe('acme');
  });

  it('collapses extra whitespace', () => {
    expect(normalizeCompetitor('Brand   Name   Inc.')).toBe('brand name');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeCompetitor('  Calm  ')).toBe('calm');
  });

  it('deduplication scenario from spec: calm inc, CALM INC., calm inc all normalize to calm', () => {
    const results = ['Calm Inc', 'CALM INC.', 'calm inc'].map(normalizeCompetitor);
    expect(results.every((r) => r === 'calm')).toBe(true);
  });

  it("spec dedup: \"Doctor's Best LLC\" normalizes to \"doctor's best\"", () => {
    expect(normalizeCompetitor("Doctor's Best LLC")).toBe("doctor's best");
  });

  it("'Natural Vitality' normalizes to 'natural vitality'", () => {
    expect(normalizeCompetitor('Natural Vitality')).toBe('natural vitality');
  });
});
