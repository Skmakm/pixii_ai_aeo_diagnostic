import type { CellState, Model, ReportCard, ResultsGrid } from './types';
import { normalizeCompetitor } from './normalizeCompetitor';

export function buildReportCard(
  grid: ResultsGrid,
  brand: string,
  models: readonly Model[],
): ReportCard {
  // Step 1: counts
  const totalCells = grid.length * (grid[0]?.length ?? 0);

  const doneCells = grid.flat().filter((c): c is Extract<CellState, { status: 'done' }> =>
    c.status === 'done',
  ).length;

  // Collect done cells per model index
  const modelCount = models.length;
  const doneCellsPerModel: Array<Array<Extract<CellState, { status: 'done' }>>> = Array.from(
    { length: modelCount },
    () => [],
  );

  for (let qi = 0; qi < grid.length; qi++) {
    const row = grid[qi];
    for (let mi = 0; mi < modelCount; mi++) {
      const cell = row[mi];
      if (cell && cell.status === 'done') {
        doneCellsPerModel[mi].push(cell);
      }
    }
  }

  // Step 2: mentionedCount
  let mentionedCount = 0;
  for (const cells of doneCellsPerModel) {
    for (const cell of cells) {
      if (cell.analysis.mentioned) mentionedCount++;
    }
  }

  // Step 3: averageRank
  const ranksWithValues: number[] = [];
  for (const cells of doneCellsPerModel) {
    for (const cell of cells) {
      if (cell.analysis.rank !== null) {
        ranksWithValues.push(cell.analysis.rank);
      }
    }
  }
  const averageRank: number | null =
    ranksWithValues.length > 0
      ? Math.round((ranksWithValues.reduce((a, b) => a + b, 0) / ranksWithValues.length) * 10) / 10
      : null;

  // Step 4: bestModel
  let bestModel: ReportCard['bestModel'] = null;
  if (doneCells > 0) {
    // Per model: count firstRanks (rank === 1) and mentionCount
    const modelFirstRanks: number[] = new Array(modelCount).fill(0);
    const modelMentionCounts: number[] = new Array(modelCount).fill(0);

    for (let mi = 0; mi < modelCount; mi++) {
      for (const cell of doneCellsPerModel[mi]) {
        if (cell.analysis.rank === 1) modelFirstRanks[mi]++;
        if (cell.analysis.mentioned) modelMentionCounts[mi]++;
      }
    }

    let bestIdx = 0;
    for (let mi = 1; mi < modelCount; mi++) {
      const cur = modelFirstRanks[mi];
      const best = modelFirstRanks[bestIdx];
      if (cur > best) {
        bestIdx = mi;
      } else if (cur === best) {
        // Tiebreak: higher mention count
        if (modelMentionCounts[mi] > modelMentionCounts[bestIdx]) {
          bestIdx = mi;
        }
        // Further tie: earlier in models array (bestIdx stays since mi > bestIdx)
      }
    }

    const bestModelObj = models[bestIdx];
    let reason: string;
    if (modelFirstRanks[bestIdx] > 0) {
      reason = `ranked #1 in ${modelFirstRanks[bestIdx]} ${modelFirstRanks[bestIdx] === 1 ? 'query' : 'queries'}`;
    } else if (modelMentionCounts[bestIdx] > 0) {
      const cellCount = doneCellsPerModel[bestIdx].length;
      reason = `mentioned in ${modelMentionCounts[bestIdx]}/${cellCount} cells`;
    } else {
      reason = 'no mentions recorded';
    }

    bestModel = { id: bestModelObj.id, reason };
  }

  // Step 5: worstModel
  let worstModel: ReportCard['worstModel'] = null;
  if (doneCells > 0) {
    const modelMentionCounts: number[] = new Array(modelCount).fill(0);
    const modelRankSums: number[] = new Array(modelCount).fill(0);
    const modelRankCounts: number[] = new Array(modelCount).fill(0);

    for (let mi = 0; mi < modelCount; mi++) {
      for (const cell of doneCellsPerModel[mi]) {
        if (cell.analysis.mentioned) {
          modelMentionCounts[mi]++;
          if (cell.analysis.rank !== null) {
            modelRankSums[mi] += cell.analysis.rank;
            modelRankCounts[mi]++;
          }
        }
      }
    }

    let worstIdx = 0;
    for (let mi = 1; mi < modelCount; mi++) {
      const curMentions = modelMentionCounts[mi];
      const worstMentions = modelMentionCounts[worstIdx];
      if (curMentions < worstMentions) {
        worstIdx = mi;
      } else if (curMentions === worstMentions) {
        // Tiebreak: higher average rank (worse = larger number = ranked lower)
        const curAvgRank =
          modelRankCounts[mi] > 0 ? modelRankSums[mi] / modelRankCounts[mi] : 0;
        const worstAvgRank =
          modelRankCounts[worstIdx] > 0
            ? modelRankSums[worstIdx] / modelRankCounts[worstIdx]
            : 0;
        if (curAvgRank > worstAvgRank) {
          worstIdx = mi;
        }
        // Further tie: earlier in models array (worstIdx stays)
      }
    }

    const worstModelObj = models[worstIdx];
    let reason: string;
    if (modelMentionCounts[worstIdx] === 0) {
      reason = 'never mentioned';
    } else {
      const cellCount = doneCellsPerModel[worstIdx].length;
      reason = `mentioned in ${modelMentionCounts[worstIdx]}/${cellCount} cells`;
    }

    worstModel = { id: worstModelObj.id, reason };
  }

  // Step 6: topCompetitors
  const normalizedBrand = normalizeCompetitor(brand);
  const competitorCounts = new Map<string, number>();
  // Track positions for avgRank: Map<normalizedName, positions[]>
  const competitorPositions = new Map<string, number[]>();

  for (let qi = 0; qi < grid.length; qi++) {
    const row = grid[qi];
    for (let mi = 0; mi < modelCount; mi++) {
      const cell = row[mi];
      if (cell && cell.status === 'done') {
        const competitors = cell.analysis.competitors;
        for (const c of competitors) {
          const normalized = normalizeCompetitor(c.name);
          if (normalized === '' || normalized === normalizedBrand) continue;

          competitorCounts.set(normalized, (competitorCounts.get(normalized) ?? 0) + 1);
          const positions = competitorPositions.get(normalized) ?? [];
          positions.push(c.rank);
          competitorPositions.set(normalized, positions);
        }
      }
    }
  }

  const topCompetitors = Array.from(competitorCounts.entries())
    .map(([name, count]) => {
      const positions = competitorPositions.get(name) ?? [];
      const avgRank =
        positions.length > 0
          ? Math.round(
              (positions.reduce((a, b) => a + b, 0) / positions.length) * 10,
            ) / 10
          : null;
      return { name, count, avgRank };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    totalCells,
    doneCells,
    mentionedCount,
    averageRank,
    bestModel,
    worstModel,
    topCompetitors,
  };
}
