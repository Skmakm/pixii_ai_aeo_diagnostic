'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Copy as CopyIcon, RotateCcw, Check, Trophy, CircleCheck, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlightBrand from '@/lib/rehypeHighlightBrand';
import { getModelIcon } from '@/lib/modelIcons';
import type { CellState } from '@/lib/types';

type Props = {
  state: CellState;
  brand: string;
  modelId: string;
  modelLabel: string;
  onRetry: () => void;
  onCopy: (text: string) => void;
};

export function Cell({ state, brand, modelId, modelLabel, onRetry, onCopy }: Props) {
  const iconInfo = getModelIcon(modelId);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    onCopy(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const isError = state.status === 'error';
  const isPending = state.status === 'pending';
  const isDone = state.status === 'done';
  const isMentioned = isDone && state.analysis.mentioned;
  const isFirst = isDone && state.analysis.rank === 1;

  // Color scheme based on cell outcome
  const cardClasses = [
    'min-w-0 overflow-hidden flex flex-col gap-0 py-0 transition-all',
    isError && 'border-rose-300 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20',
    isFirst && 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-200 dark:border-amber-700/60 dark:bg-amber-950/20 dark:ring-amber-800/40',
    isMentioned && !isFirst && 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-800/50 dark:bg-emerald-950/15',
    isDone && !isMentioned && 'border-border hover:border-foreground/20',
    isPending && 'border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/40 dark:bg-indigo-950/15',
  ].filter(Boolean).join(' ');

  const headerClasses = [
    'px-4 py-2.5 border-b',
    isError && 'bg-rose-100/60 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50',
    isFirst && 'bg-amber-100/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800/40',
    isMentioned && !isFirst && 'bg-emerald-100/60 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40',
    isDone && !isMentioned && 'bg-muted/40',
    isPending && 'bg-indigo-100/50 border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-900/40',
  ].filter(Boolean).join(' ');

  return (
    <Card className={cardClasses}>
      <CardHeader className={headerClasses}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {iconInfo && (
              <iconInfo.Icon
                className="size-4 shrink-0"
                style={{ color: iconInfo.color }}
                aria-label={iconInfo.provider}
              />
            )}
            <span className="text-xs font-semibold tracking-wide text-foreground/80 truncate">
              {modelLabel}
            </span>
          </div>
          {isPending && (
            <Badge variant="outline" className="text-[10px] py-0 border-indigo-300 text-indigo-700 bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:bg-indigo-950/40">
              <Loader2 className="size-2.5 animate-spin" />
              running
            </Badge>
          )}
          {isError && (
            <Badge className="text-[10px] py-0 bg-rose-600 text-white hover:bg-rose-600">error</Badge>
          )}
          {isFirst && (
            <Badge className="text-[10px] py-0 bg-amber-500 text-white hover:bg-amber-500">
              <Trophy className="size-2.5" />
              #1
            </Badge>
          )}
          {isMentioned && !isFirst && (
            <Badge className="text-[10px] py-0 bg-emerald-600 text-white hover:bg-emerald-600">
              <CircleCheck className="size-2.5" />
              {state.analysis.rank ? `#${state.analysis.rank}` : 'mentioned'}
            </Badge>
          )}
          {isDone && !isMentioned && (
            <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">not mentioned</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-3 flex-1">
        {isPending && (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        )}
        {isDone && (
          <div className="text-sm leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_p]:my-2 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-muted [&_code]:text-xs [&_mark]:bg-yellow-200 [&_mark]:text-yellow-950 [&_mark]:dark:bg-yellow-600/70 [&_mark]:dark:text-yellow-50 [&_mark]:px-1 [&_mark]:py-0.5 [&_mark]:rounded [&_mark]:font-semibold">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlightBrand, { brand }]]}
            >
              {state.text}
            </ReactMarkdown>
          </div>
        )}
        {isError && (
          <div role="alert" className="text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1">
              <div className="font-medium">{state.error}</div>
              <Button variant="ghost" size="sm" onClick={onRetry} className="mt-1 -ml-2 h-7 text-rose-700 hover:text-rose-800 hover:bg-rose-100/60 dark:text-rose-300 dark:hover:text-rose-200 dark:hover:bg-rose-950/40">
                <RotateCcw className="size-3" />
                Retry
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="px-4 py-2 border-t bg-muted/30 text-[11px] text-muted-foreground flex items-center justify-between">
        <span className="tabular-nums">
          {isPending ? '…' : `${state.latencyMs} ms`}
        </span>
        {isDone && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleCopy(state.text)}
            className="h-6 px-2 text-[11px]"
            aria-label="Copy response"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <CopyIcon className="size-3" />
                Copy
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
