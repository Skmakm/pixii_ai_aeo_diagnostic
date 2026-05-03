'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress, ProgressLabel } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { buildReportCard } from '@/lib/reportCard';
import { getModelIcon } from '@/lib/modelIcons';
import type { ResultsGrid, Model, CellState } from '@/lib/types';

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

type Props = {
  grid: ResultsGrid;
  brand: string;
  models: readonly Model[];
};

type ModelRow = {
  id: string;
  label: string;
  done: number;
  total: number;
  mentions: number;
  firstRanks: number;
  avgRank: number | null;
};

function buildModelRows(grid: ResultsGrid, models: readonly Model[]): ModelRow[] {
  return models.map((m, mi) => {
    let done = 0;
    let mentions = 0;
    let firstRanks = 0;
    const ranks: number[] = [];
    for (const row of grid) {
      const cell: CellState | undefined = row[mi];
      if (!cell) continue;
      if (cell.status === 'done') {
        done += 1;
        if (cell.analysis.mentioned) mentions += 1;
        if (cell.analysis.rank !== null) {
          ranks.push(cell.analysis.rank);
          if (cell.analysis.rank === 1) firstRanks += 1;
        }
      }
    }
    const avgRank = ranks.length > 0 ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null;
    return { id: m.id, label: m.label, done, total: grid.length, mentions, firstRanks, avgRank };
  });
}

export function ReportCard({ grid, brand, models }: Props) {
  if (grid.length === 0) return null;
  const r = buildReportCard(grid, brand, models);
  if (r.doneCells === 0) return null;

  const pct = r.totalCells === 0 ? 0 : Math.round((r.mentionedCount / r.totalCells) * 100);
  const modelRows = buildModelRows(grid, models);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{brand ? `${brand} — AEO Report Card` : 'AEO Report Card'}</CardTitle>
        <CardDescription>
          Live aggregate across {r.doneCells}/{r.totalCells} settled cells.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Progress value={pct}>
            <ProgressLabel>Brand mention rate</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">
              {r.mentionedCount} / {r.totalCells} cells &middot; {pct}%
            </span>
          </Progress>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              Average rank when mentioned:{' '}
              {r.averageRank !== null ? (
                <Badge variant="secondary">{r.averageRank.toFixed(1)}</Badge>
              ) : (
                <Badge variant="outline">—</Badge>
              )}
            </span>
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <h4 className="text-sm font-semibold">Per-model breakdown</h4>
            {(r.bestModel || r.worstModel) && (
              <p className="text-xs text-muted-foreground">
                {r.bestModel && (
                  <>
                    Best:{' '}
                    <span className="text-foreground font-medium">
                      {models.find((m) => m.id === r.bestModel?.id)?.label ?? r.bestModel.id}
                    </span>{' '}
                    — {r.bestModel.reason}
                  </>
                )}
                {r.bestModel && r.worstModel && <span className="mx-2">·</span>}
                {r.worstModel && (
                  <>
                    Worst:{' '}
                    <span className="text-foreground font-medium">
                      {models.find((m) => m.id === r.worstModel?.id)?.label ?? r.worstModel.id}
                    </span>{' '}
                    — {r.worstModel.reason}
                  </>
                )}
              </p>
            )}
          </div>
          <Table>
            <TableCaption className="text-left">
              How each model handled this run. &ldquo;#1 ranks&rdquo; counts queries where the brand
              was the first item in a ranked list.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Cells</TableHead>
                <TableHead className="text-right">Mentions</TableHead>
                <TableHead className="text-right">#1 ranks</TableHead>
                <TableHead className="text-right">Avg rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelRows.map((row) => {
                const icon = getModelIcon(row.id);
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {icon && (
                          <icon.Icon
                            className="size-3.5 shrink-0"
                            style={{ color: icon.color }}
                            aria-hidden
                          />
                        )}
                        <span>{row.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.done}/{row.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.mentions}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.firstRanks}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.avgRank !== null ? row.avgRank.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-semibold mb-2">Top competitors that outranked you</h4>
          {r.topCompetitors.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No competitors detected yet. Make sure your queries ask for ranked recommendations
              (&ldquo;top 5&rdquo;, &ldquo;best brands&rdquo;).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Competitor</TableHead>
                  <TableHead className="text-right">Mentions</TableHead>
                  <TableHead className="text-right">Avg rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.topCompetitors.map((c, i) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium tabular-nums">{i + 1}</TableCell>
                    <TableCell>{titleCase(c.name)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.avgRank !== null ? c.avgRank.toFixed(1) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
