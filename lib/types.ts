export type Model = {
  id: string;
  label: string;
  slug: string;
};

export type Competitor = {
  name: string;
  rank: number;
};

export type Analysis = {
  mentioned: boolean;
  rank: number | null;
  competitors: Competitor[];
};

export type CellState =
  | { status: 'pending' }
  | { status: 'done'; text: string; latencyMs: number; analysis: Analysis }
  | { status: 'error'; error: string; latencyMs: number };

export type ResultsGrid = CellState[][];

export type ReportCard = {
  totalCells: number;
  doneCells: number;
  mentionedCount: number;
  averageRank: number | null;
  bestModel: { id: string; reason: string } | null;
  worstModel: { id: string; reason: string } | null;
  topCompetitors: { name: string; count: number; avgRank: number | null }[];
};

export const SSE_DONE = { done: true } as const;

export type SSEEvent =
  | {
      queryIdx: number;
      modelId: string;
      status: 'done';
      text: string;
      latencyMs: number;
      mentioned: boolean;
      rank: number | null;
      competitors: Competitor[];
    }
  | {
      queryIdx: number;
      modelId: string;
      status: 'error';
      error: string;
      latencyMs: number;
    }
  | { done: true };
