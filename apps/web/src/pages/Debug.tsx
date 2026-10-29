import { Link, useParams, useSearchParams } from "react-router";
import { Button } from "@heroui/react";
import clsx from "clsx";
import type { DebugEvent } from "shared";
import { useDebugAttempts, useDebugEvents } from "../api/debug";
import { Empty, ErrorNote, Loading } from "../components/common/State";

function preview(event: DebugEvent) {
  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") {
    return "";
  }
  for (const key of [
    "request",
    "name",
    "text",
    "message",
    "reason",
    "status",
    "sessionId",
  ]) {
    if (typeof data[key] === "string") {
      return data[key];
    }
  }
  if (event.kind === "mcp.request") {
    const params = data.params as { name?: string } | undefined;
    return `${data.method ?? ""} ${params?.name ?? ""}`;
  }
  return "";
}

function TranscriptEvent({ event }: { event: DebugEvent }) {
  return (
    <details className="min-w-0 rounded-lg border border-lm-line bg-lm-surface p-3">
      <summary className="cursor-pointer text-sm">
        <span className="mr-2 font-mono text-xs text-lm-muted">
          #{event.id} · {event.createdAt}
        </span>
        <span className="font-semibold">{event.kind}</span>
        <span className="mt-1 block truncate text-lm-muted">
          {preview(event)}
        </span>
      </summary>
      <pre className="mt-3 max-h-160 overflow-auto rounded bg-lm-paper p-3 font-mono text-xs break-all whitespace-pre-wrap">
        {JSON.stringify(event.data, null, 2)}
      </pre>
    </details>
  );
}

export function DebugPage() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const attempts = useDebugAttempts(id);
  const attemptId = params.get("attempt") ?? attempts.data?.[0]?.id;
  const selected = attempts.data?.find((attempt) => attempt.id === attemptId);
  const transcript = useDebugEvents(id, selected?.id);
  const events = transcript.data?.pages.flatMap((page) => page.events) ?? [];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div>
        <Link to={`/canvas/${id}`} className="text-sm text-lm-accent-ink">
          ← Back to canvas
        </Link>
        <h1 className="mt-3 mb-1 text-2xl font-semibold">Agent transcripts</h1>
        <p className="m-0 text-sm text-lm-muted">
          Development only · Saved per canvas · Refreshes every two seconds.
          Expand an event to read its full payload.
        </p>
      </div>
      {attempts.error ? (
        <ErrorNote error={attempts.error} onRetry={() => attempts.refetch()} />
      ) : attempts.isPending ? (
        <Loading label="Loading runs..." />
      ) : attempts.data.length === 0 ? (
        <Empty
          title="No runs yet"
          description="Start an agent task on this canvas to record a transcript."
        />
      ) : (
        <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav
            aria-label="Agent runs"
            className="flex max-h-160 flex-col gap-2 overflow-y-auto"
          >
            {attempts.data.map((attempt) => (
              <button
                key={attempt.id}
                type="button"
                onClick={() => setParams({ attempt: attempt.id })}
                aria-current={attempt.id === selected?.id ? "true" : undefined}
                className={clsx(
                  "min-w-0 cursor-pointer rounded-lg border p-3 text-left",
                  attempt.id === selected?.id
                    ? "border-lm-accent bg-lm-accent-soft"
                    : "border-lm-line bg-lm-surface",
                )}
              >
                <span
                  className="block truncate text-sm font-semibold"
                  title={attempt.title}
                >
                  {attempt.title}
                </span>
                <span className="mt-1 block text-xs text-lm-muted">
                  {attempt.status} · {attempt.startedAt}
                </span>
                <span className="block truncate font-mono text-xs text-lm-muted">
                  {attempt.model}
                </span>
              </button>
            ))}
          </nav>
          <section
            aria-label="Run transcript"
            className="flex min-w-0 flex-col gap-2"
          >
            {selected ? (
              <>
                <div className="text-sm text-lm-muted">
                  {selected.status} · {events.length} events loaded ·{" "}
                  <span className="font-mono break-all">{selected.id}</span>
                </div>
                {transcript.error ? (
                  <ErrorNote
                    error={transcript.error}
                    onRetry={() => transcript.refetch()}
                  />
                ) : transcript.isPending ? (
                  <Loading label="Loading transcript..." />
                ) : events.length === 0 ? (
                  <Empty
                    title="No recorded events"
                    description="Runs started before development recording was enabled have no transcript."
                  />
                ) : (
                  events.map((event) => (
                    <TranscriptEvent key={event.id} event={event} />
                  ))
                )}
                {transcript.hasNextPage && (
                  <Button
                    variant="secondary"
                    isPending={transcript.isFetchingNextPage}
                    onPress={() => {
                      transcript.fetchNextPage();
                    }}
                  >
                    Load more events
                  </Button>
                )}
              </>
            ) : (
              <Empty
                title="Select a run"
                description="Choose a run from this canvas to inspect its transcript."
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
