export type DebugAttempt = {
  id: string;
  title: string;
  status: "running" | "done" | "error" | "aborted" | "stopped_budget";
  model: string | null;
  sessionId: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type DebugEvent = {
  id: number;
  attemptId: string;
  kind: string;
  data: unknown;
  createdAt: string;
};

export type DebugEventPage = {
  events: DebugEvent[];
  nextCursor: number | null;
};
