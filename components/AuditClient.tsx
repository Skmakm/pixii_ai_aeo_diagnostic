'use client';
import { useState, useRef, useCallback } from 'react';
import { MODELS } from '@/lib/models';
import { AuditForm } from './AuditForm';
import { ResultsGrid } from './ResultsGrid';
import { ReportCard } from './ReportCard';
import type { ResultsGrid as Grid, CellState } from '@/lib/types';

export function AuditClient() {
  const [brand, setBrand] = useState('');
  const [queries, setQueries] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid>([]);
  const [runBrand, setRunBrand] = useState('');
  const [runQueries, setRunQueries] = useState<string[]>([]);
  const [singleQueryMode, setSingleQueryMode] = useState(false);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const onRun = useCallback(async () => {
    const trimmedBrand = brand.trim();
    if (!trimmedBrand) { setError('Brand is required'); return; }
    if (trimmedBrand.length > 60) { setError('Brand must be ≤60 characters'); return; }
    const lines = queries.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0 || lines.length > 5) { setError('Enter 1–5 queries'); return; }
    setError(null);

    // 1 query → run it 3 times for variance check; 2-5 queries → run each once
    const isSingle = lines.length === 1;
    const expandedQueries = isSingle ? [lines[0], lines[0], lines[0]] : lines;

    const initialGrid: Grid = expandedQueries.map(() => MODELS.map(() => ({ status: 'pending' } as CellState)));
    setGrid(initialGrid);
    setRunBrand(trimmedBrand);
    setRunQueries(expandedQueries);
    setSingleQueryMode(isSingle);
    setRunning(true);

    if (readerRef.current) { try { await readerRef.current.cancel(); } catch {} readerRef.current = null; }

    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: trimmedBrand, queries: expandedQueries }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'unknown' }));
        setError(`Run failed: ${j.error ?? res.statusText}`);
        setRunning(false);
        return;
      }
      const reader = res.body!.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const e of events) {
          if (!e.startsWith('data: ')) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let payload: any;
          try { payload = JSON.parse(e.slice(6)); } catch { continue; }
          if (payload?.done) continue;
          const { queryIdx, modelId, status, text, error: errStr, latencyMs, mentioned, rank, competitors } = payload;
          const modelIdx = MODELS.findIndex(m => m.id === modelId);
          if (modelIdx < 0 || queryIdx < 0) continue;
          setGrid(prev => {
            const next = prev.map(row => row.slice());
            if (status === 'done') {
              next[queryIdx][modelIdx] = { status: 'done', text, latencyMs, analysis: { mentioned, rank: rank ?? null, competitors: competitors ?? [] } };
            } else {
              next[queryIdx][modelIdx] = { status: 'error', error: errStr, latencyMs };
            }
            return next;
          });
        }
      }
    } catch {
    } finally {
      setRunning(false);
      readerRef.current = null;
    }
  }, [brand, queries]);

  const onRetry = useCallback(async (queryIdx: number, modelId: string) => {
    const model = MODELS.find(m => m.id === modelId);
    if (!model) return;
    const query = runQueries[queryIdx];
    if (!query) return;
    const modelIdx = MODELS.findIndex(m => m.id === modelId);
    setGrid(prev => {
      const next = prev.map(row => row.slice());
      next[queryIdx][modelIdx] = { status: 'pending' };
      return next;
    });
    try {
      const res = await fetch('/api/cell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand: runBrand, query, modelId }),
      });
      const data = await res.json();
      setGrid(prev => {
        const next = prev.map(row => row.slice());
        if (data.status === 'done') {
          next[queryIdx][modelIdx] = { status: 'done', text: data.text, latencyMs: data.latencyMs, analysis: data.analysis };
        } else {
          next[queryIdx][modelIdx] = { status: 'error', error: data.error, latencyMs: data.latencyMs };
        }
        return next;
      });
    } catch {
      setGrid(prev => {
        const next = prev.map(row => row.slice());
        next[queryIdx][modelIdx] = { status: 'error', error: 'upstream error', latencyMs: 0 };
        return next;
      });
    }
  }, [runBrand, runQueries]);

  const onCopy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  return (
    <div className="space-y-6">
      <AuditForm
        brand={brand} queries={queries} running={running} error={error}
        onBrandChange={setBrand} onQueriesChange={setQueries} onRun={onRun}
      />
      <ReportCard grid={grid} brand={runBrand} models={MODELS} />
      <ResultsGrid grid={grid} brand={runBrand} queries={runQueries} models={MODELS}
                   singleQueryMode={singleQueryMode}
                   onRetry={onRetry} onCopy={onCopy} />
    </div>
  );
}
