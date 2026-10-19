export type NodeKind =
  | "goal"
  | "hypothesis"
  | "statement"
  | "note"
  | "memory"
  | "arxiv"
  | "python"
  | "lean";

export type BasePayload = {
  title: string;
  text?: string;
  markdown?: string;
  author?: string;
};

export type GoalPayload = BasePayload & {
  kind: "goal";
  status: "open" | "proved" | "disproved";
};

export type HypothesisPayload = BasePayload & {
  kind: "hypothesis";
  label: string;
  status: "open" | "supported" | "refuted";
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

export type CardRun = {
  ok: boolean;
  output: RunOutput;
  badge: string;
  runAt: string;
  diagnostics?: LeanDiagnostic[];
  axioms?: string[];
  hasSorry?: boolean;
  extraAxioms?: string[];
};

export type CodePayload = BasePayload & {
  kind: "python" | "lean";
  source: string;
  run?: CardRun;
};

export type PlainPayload = BasePayload & {
  kind: "statement" | "note" | "memory" | "arxiv";
};

export type NodePayload =
  GoalPayload | HypothesisPayload | CodePayload | PlainPayload;
