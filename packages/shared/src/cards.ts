export type NodeKind =
  | "goal"
  | "hypothesis"
  | "statement"
  | "note"
  | "memory"
  | "arxiv"
  | "literature"
  | "python"
  | "lean";

export type Archived = {
  at: string;
  by?: string;
  reason?: string;
};

export type Resolved = {
  at: string;
  by?: string;
  reason?: string;
};

export type BasePayload = {
  title: string;
  text?: string;
  markdown?: string;
  author?: string;
  archived?: Archived | null;
};

export type GoalPayload = BasePayload & {
  kind: "goal";
  status: "open" | "proved" | "disproved";
};

export type HypothesisPayload = BasePayload & {
  kind: "hypothesis";
  label: string;
  status: "open" | "claimed" | "supported" | "refuted";
  agentId?: string;
  claimedBy?: string;
  claimedByRole?: "prover" | "referee";
  settledBy?: string;
};

export type RunOutput = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  durationMs: number;
};

export type LeanDiagnostic = {
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
};

export type CardFigure = {
  name: string;
  title: string | null;
  is3d: boolean;
  views: string | null;
};

export type CardRun = {
  ok: boolean;
  output: RunOutput;
  badge: string;
  runAt: string;
  diagnostics?: LeanDiagnostic[];
  axioms?: string[];
  hasSorry?: boolean;
  extraAxioms?: string[];
  figures?: CardFigure[];
};

export type CodePayload = BasePayload & {
  kind: "python" | "lean";
  source: string;
  run?: CardRun;
};

export type PlainPayload = BasePayload & {
  kind: "statement" | "note" | "memory";
  resolved?: Resolved | null;
};

export type Paper = {
  id: string;
  title: string;
  authors: string[];
  published: string;
  abstract: string;
  url: string;
  relevance?: string;
  dismissed?: boolean;
};

export type PaperPayload = BasePayload & {
  kind: "arxiv";
  arxivId: string;
  authors?: string[];
  published?: string;
  abstract?: string;
  url?: string;
  source?: {
    fetchedAt: string;
    file: string;
    bytes: number;
    sections: { index: number; title: string }[];
  };
};

export const LITERATURE_VERDICTS = [
  "known",
  "refuted",
  "partial",
  "related",
  "novel",
] as const;

export type LiteratureVerdict = (typeof LITERATURE_VERDICTS)[number];

export type LiteraturePayload = BasePayload & {
  kind: "literature";
  target?: string;
  queries?: string[];
  verdict?: LiteratureVerdict;
  papers?: Paper[];
  suggestions?: string[];
  checkedAt?: string;
};

export type NodePayload =
  | GoalPayload
  | HypothesisPayload
  | CodePayload
  | PlainPayload
  | LiteraturePayload
  | PaperPayload;
