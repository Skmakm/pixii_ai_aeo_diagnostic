'use client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, ChevronDown } from 'lucide-react';

type Props = {
  brand: string;
  queries: string;
  running: boolean;
  error: string | null;
  onBrandChange: (v: string) => void;
  onQueriesChange: (v: string) => void;
  onRun: () => void;
};

const QUERY_PLACEHOLDER = `top 5 [category] brands for [buyer/use case]
best [product/service] for [budget/location/context]
recommended [tools/products] for [specific need]`;

export function AuditForm({
  brand, queries, running, error,
  onBrandChange, onQueriesChange, onRun,
}: Props) {
  const lineCount = queries.split('\n').map(l => l.trim()).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Run an audit</CardTitle>
        <CardDescription>
          Brand + 1–5 queries. We&rsquo;ll fan out to 6 LLMs and aggregate the results.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="brand-input" className="text-sm font-semibold">
            Brand
          </label>
          <Input
            id="brand-input"
            value={brand}
            onChange={(e) => onBrandChange(e.target.value)}
            maxLength={60}
            readOnly={running}
            placeholder="Your brand"
            className="h-10"
          />
          <p className="text-[11px] text-muted-foreground">
            Max 60 characters. Never sent to the models — used post-hoc for matching.
          </p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label htmlFor="queries-input" className="text-sm font-semibold">
              Queries
            </label>
            <Badge variant={lineCount > 5 ? 'destructive' : 'outline'} className="tabular-nums">
              {lineCount}/5 entered{lineCount === 1 ? ' · runs 3×' : ''}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Write recommendation-style queries (&ldquo;top 5&rdquo;, &ldquo;best brands&rdquo;,
            &ldquo;which products would you recommend&rdquo;). Include product category, buyer
            type, price range, location, or use case when relevant.{' '}
            <strong>Do not include your brand name</strong> — we&rsquo;re testing natural visibility.
          </p>
          <Textarea
            id="queries-input"
            value={queries}
            onChange={(e) => onQueriesChange(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            readOnly={running}
            placeholder={QUERY_PLACEHOLDER}
          />

          <details className="group mt-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-foreground transition-colors">
              <ChevronDown className="size-3 transition-transform group-open:rotate-180" />
              Examples &amp; query checklist
            </summary>
            <div className="mt-2 space-y-3 pl-3 border-l-2 border-muted">
              <div>
                <div className="font-medium text-foreground mb-1">Examples</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>top 5 magnesium glycinate brands for sleep</li>
                  <li>best e-bikes under 1 lakh INR</li>
                  <li>recommended CRM tools for a 10-person startup</li>
                  <li>best project management software for agencies</li>
                </ul>
              </div>
              <div className="space-y-0.5">
                <div className="font-medium text-foreground">Good vs weak</div>
                <div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Good:</span>{' '}
                  top 5 protein powder brands for athletes
                </div>
                <div>
                  <span className="text-amber-700 dark:text-amber-400 font-medium">Weak:</span>{' '}
                  tell me about protein powder
                </div>
              </div>
              <div>
                <div className="font-medium text-foreground mb-1">Checklist</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>asks for recommendations</li>
                  <li>requests a ranked or top-N list</li>
                  <li>includes a category</li>
                  <li>includes a buyer/use case</li>
                  <li>does not include your brand name</li>
                </ul>
              </div>
              <div>
                The Report Card works best when model responses contain ranked lists. Brand
                mentions in prose are detected, but rank and competitor scoring need list-style
                answers.
              </div>
            </div>
          </details>
        </div>

        {error && (
          <p className="text-sm text-destructive font-medium" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            {lineCount === 1
              ? 'Single query → each model called 3× to measure variance.'
              : lineCount > 0
              ? `Each model called once per query (${lineCount * 6} cells total).`
              : 'Enter at least one query to run.'}
          </p>
          <Button onClick={onRun} disabled={running || lineCount === 0 || lineCount > 5} size="lg">
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Running…
              </>
            ) : (
              <>
                <Play className="size-4" />
                Run audit
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
