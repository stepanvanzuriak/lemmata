import {
  addAttemptUsage,
  addAttemptEvent,
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
  RunHandle,
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
  onStart?: (attempt: Attempt) => void | Promise<void>;
  /** Present only for development runs. Never include credentials here. */
  transcript?: Record<string, unknown>;
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
    onStart,
    transcript,
  }: RunAttemptOptions,
  onEvent: (event: RunEvent) => void | Promise<void> = () => {},
): Promise<Attempt> {
  const row = await startAttempt(db, {
    projectId,
    canvasId,
    title,
    model: `${adapter.name}:${options.model?.id ?? ""}`,
  });
  let handle: RunHandle | undefined;
  let spent = 0;
  let reason: DoneReason = "completed";
  let overBudget = false;

  const abort = () => {
    handle?.abort().catch(() => {});
  };

  const record = async (kind: string, data: unknown) => {
    if (transcript) {
      await addAttemptEvent(db, row.id, kind, data);
    }
  };
  const emit = async (event: RunEvent) => {
    await record(`agent.${event.type}`, event);
    if (event.type !== "provider") {
      await onEvent(event);
    }
  };

  try {
    await onStart?.(row);
    await record("run.start", {
      ...transcript,
      prompt: options.prompt,
      systemPromptAddendum: options.systemPromptAddendum,
      resumeSessionId: options.resumeSessionId,
      model: row.model,
      cwd: options.cwd,
      maxTokens,
      maxTurns: options.maxTurns,
    });
    handle = adapter.start(
      transcript ? { ...options, captureRawEvents: true } : options,
    );
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
    }
    for await (const event of handle.events) {
      if (event.type === "done") {
        reason = overBudget ? "budget" : event.reason;
        await emit({ type: "done", reason });
        break;
      }

      await emit(event);

      if (event.type === "session") {
        await setAttemptSession(db, row.id, event.sessionId);
      }
      if (event.type === "usage") {
        await addAttemptUsage(db, row.id, event.usage);
        const { input, output, cacheRead, cacheWrite } = event.usage;
        spent += input + output + cacheRead + cacheWrite;

        if (spent > maxTokens && !overBudget && !event.final) {
          overBudget = true;
          await handle.abort();
        }
      }
    }
  } catch (error) {
    reason = "error";
    await emit({ type: "error", message: String(error) });
  } finally {
    signal?.removeEventListener("abort", abort);
  }

  const finished = await finishAttempt(db, row.id, STATUS[reason]);
  await record("run.finish", {
    status: finished.status,
    finishedAt: finished.finishedAt,
  });
  return finished;
}
