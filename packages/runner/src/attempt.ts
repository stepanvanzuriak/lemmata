import {
  addAttemptUsage,
  finishAttempt,
  setAttemptSession,
  startAttempt,
  type Attempt,
  type AttemptStatus,
  type Db,
} from "core";
import type {
  DoneReason,
  RunEvent,
  AgentAdapter,
  StartOptions,
} from "./runner.js";

export type RunAttemptOptions = {
  db: Db;
  adapter: AgentAdapter;
  projectId: string;
  canvasId?: string | null;
  title: string;
  options: StartOptions;
  maxTokens: number;
  signal?: AbortSignal;
};

const STATUS: Record<DoneReason, Exclude<AttemptStatus, "running">> = {
  completed: "done",
  aborted: "aborted",
  budget: "stopped_budget",
  error: "error",
};

export async function runAttempt(
  {
    db,
    adapter,
    projectId,
    canvasId,
    title,
    options,
    maxTokens,
    signal,
  }: RunAttemptOptions,
  onEvent: (event: RunEvent) => void = () => {},
): Promise<Attempt> {
  const row = await startAttempt(db, {
    projectId,
    canvasId,
    title,
    model: options.model?.id,
  });
  const handle = adapter.start(options);
  let spent = 0;
  let reason: DoneReason = "completed";
  let overBudget = false;

  const abort = () => {
    handle.abort().catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();

  try {
    for await (const event of handle.events) {
      if (event.type === "done") {
        reason = overBudget ? "budget" : event.reason;
        onEvent({ type: "done", reason });
        break;
      }

      onEvent(event);

      if (event.type === "session") {
        await setAttemptSession(db, row.id, event.sessionId);
      }
      if (event.type === "usage") {
        await addAttemptUsage(db, row.id, event.usage);
        const { input, output, cacheRead, cacheWrite } = event.usage;
        spent += input + output + cacheRead + cacheWrite;

        if (spent > maxTokens && !overBudget) {
          overBudget = true;
          await handle.abort();
        }
      }
    }
  } catch (error) {
    onEvent({ type: "error", message: String(error) });
    reason = "error";
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  return finishAttempt(db, row.id, STATUS[reason]);
}
