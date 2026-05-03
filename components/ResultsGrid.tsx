'use client';
import { Cell } from './Cell';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Inbox } from 'lucide-react';
import type { ResultsGrid as Grid, Model } from '@/lib/types';

type Props = {
  grid: Grid;
  brand: string;
  queries: string[];
  models: readonly Model[];
  singleQueryMode?: boolean;
  onRetry: (queryIdx: number, modelId: string) => void;
  onCopy: (text: string) => void;
};

export function ResultsGrid({
  grid, brand, queries, models, singleQueryMode = false, onRetry, onCopy,
}: Props) {
  if (grid.length === 0) {
    return (
      <section
        aria-label="Empty results"
        className="border border-dashed rounded-lg p-10 text-center bg-muted/20"
      >
        <Inbox className="size-8 mx-auto text-muted-foreground/60 mb-2" aria-hidden />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Enter recommendation-style queries to compare how different LLMs rank brands and
          competitors.
        </p>
      </section>
    );
  }

  // Default-open: only the first row to keep the page scannable on long runs.
  const defaultOpen = ['row-0'];

  return (
    <section className="space-y-4" aria-label="Results">
      {singleQueryMode && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 border rounded-md px-3 py-2">
          <Badge variant="secondary">Variance mode</Badge>
          <span className="text-xs">
            Single query — running each model 3 times. Report Card averages across all{' '}
            <span className="tabular-nums font-medium text-foreground">
              {grid.length * models.length}
            </span>{' '}
            cells.
          </span>
        </div>
      )}

      <Accordion multiple defaultValue={defaultOpen} className="space-y-2">
        {grid.map((row, qi) => {
          const allError = row.every((c) => c.status === 'error');
          const doneCount = row.filter((c) => c.status === 'done').length;
          const errorCount = row.filter((c) => c.status === 'error').length;
          const heading = singleQueryMode
            ? `Run ${qi + 1} of ${grid.length}`
            : `Query ${qi + 1}`;

          return (
            <AccordionItem
              key={qi}
              value={`row-${qi}`}
              className="border rounded-lg bg-card overflow-hidden"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30 [&[data-state=open]]:bg-muted/30">
                <div className="flex items-center justify-between gap-3 w-full pr-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold whitespace-nowrap">{heading}</span>
                    <code className="px-1.5 py-0.5 rounded bg-muted text-xs truncate">
                      {queries[qi]}
                    </code>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {errorCount > 0 && (
                      <Badge variant="destructive" className="tabular-nums text-[10px]">
                        {errorCount} err
                      </Badge>
                    )}
                    <Badge variant="outline" className="tabular-nums text-[10px]">
                      {doneCount}/{row.length}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-1">
                {allError && (
                  <Alert variant="destructive" className="mb-3">
                    <AlertTitle>
                      All models failed for {singleQueryMode ? `run ${qi + 1}` : `query ${qi + 1}`}
                    </AlertTitle>
                    <AlertDescription>
                      Check your function logs for the underlying OpenRouter error and confirm
                      your API key + slug status.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 min-[900px]:[grid-template-columns:repeat(auto-fit,minmax(280px,1fr))] gap-3">
                  {row.map((state, mi) => (
                    <Cell
                      key={models[mi].id}
                      state={state}
                      brand={brand}
                      modelId={models[mi].id}
                      modelLabel={models[mi].label}
                      onRetry={() => onRetry(qi, models[mi].id)}
                      onCopy={onCopy}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
