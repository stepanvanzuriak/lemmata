import { useState } from "react";
import clsx from "clsx";
import { Button } from "@heroui/react";
import {
  ArrowRight,
  ArrowRotateLeft,
  Check,
  ChevronDown,
  CircleCheck,
  CircleCheckFill,
  CircleDashed,
  Play,
} from "@gravity-ui/icons";
import type { CanvasNode, CardProgress } from "shared";
import { Markdown } from "../common/Markdown";
import { fieldsOf } from "./kinds";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** A short name for an evidence card: its label, else its title. */
function evidenceName(id: string, nodes: CanvasNode[]) {
  const card = nodes.find((n) => n.id === id);
  if (!card) {
    return id.slice(-6);
  }
  const { label, title } = fieldsOf(card);
  return label ?? title ?? id.slice(-6);
}

/** Asks the prover to work on one step; absent when no chat is connected. */
function WorkButton({
  step,
  onWork,
}: {
  step: string;
  onWork?: (step: string) => void;
}) {
  if (!onWork) {
    return null;
  }
  return (
    <Button
      isIconOnly
      size="sm"
      variant="tertiary"
      className="size-6 min-w-0 shrink-0"
      aria-label={`Ask the prover to work on: ${step}`}
      onPress={() => onWork(step)}
    >
      <Play width={12} height={12} aria-hidden="true" />
    </Button>
  );
}

/** Marks a step done, or undoes the mark; absent when the card cannot be changed. */
function DoneButton({
  step,
  done,
  onDone,
}: {
  step: string;
  done: boolean;
  onDone?: (step: string, done: boolean) => void;
}) {
  if (!onDone) {
    return null;
  }
  const Icon = done ? ArrowRotateLeft : Check;
  return (
    <Button
      isIconOnly
      size="sm"
      variant="tertiary"
      className="size-6 min-w-0 shrink-0"
      aria-label={done ? `Mark not done: ${step}` : `Mark done: ${step}`}
      onPress={() => onDone(step, !done)}
    >
      <Icon width={12} height={12} aria-hidden="true" />
    </Button>
  );
}

/** Where work on a hypothesis or attack stands, as recorded by agents and marked by the user. */
export function ProgressSection({
  progress,
  nodes,
  onWork,
  onDone,
}: {
  progress: CardProgress;
  nodes: CanvasNode[];
  /** Starts a prover run on the given remaining or next step. */
  onWork?: (step: string) => void;
  /** Marks a remaining or next step done (true), or undoes that (false). */
  onDone?: (step: string, done: boolean) => void;
}) {
  const done = progress.done ?? [];
  const [open, setOpen] = useState(true);

  return (
    <section
      aria-label="Card progress"
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-lm-line bg-lm-surface p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="tertiary"
          className="h-6 min-w-0 justify-start gap-1.5 px-0 font-mono text-[11px] tracking-wide text-lm-muted uppercase"
          aria-expanded={open}
          onPress={() => setOpen(!open)}
        >
          <ChevronDown
            width={12}
            height={12}
            aria-hidden="true"
            className={clsx("transition-transform", !open && "-rotate-90")}
          />
          Progress
        </Button>
        <span className="text-[11px] text-lm-muted">
          {open ? (
            when(progress.updatedAt)
          ) : (
            <ProgressSummary progress={progress} />
          )}
        </span>
      </div>

      {open && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-lm-ok-ink">
              Established · {progress.established.length}
            </span>
            {progress.established.length === 0 && (
              <span className="text-xs text-lm-muted">Nothing yet.</span>
            )}
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {progress.established.map((item) => (
                <li key={item.text} className="flex min-w-0 gap-2 text-sm">
                  <CircleCheck
                    width={14}
                    height={14}
                    className="mt-0.5 shrink-0 text-lm-ok"
                    aria-hidden="true"
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Markdown inline>{item.text}</Markdown>
                    <div className="flex flex-wrap gap-1">
                      {item.evidence.map((id) => (
                        <span
                          key={id}
                          title={id}
                          className="max-w-full truncate rounded bg-lm-chip px-1.5 py-0.5 font-mono text-[10px] text-lm-muted"
                        >
                          {evidenceName(id, nodes)}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {progress.remaining.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-lm-ink2">
                Remaining · {progress.remaining.length}
              </span>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {progress.remaining.map((step) => (
                  <li key={step} className="flex min-w-0 gap-2 text-sm">
                    <CircleDashed
                      width={14}
                      height={14}
                      className="mt-0.5 shrink-0 text-lm-muted"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <Markdown inline>{step}</Markdown>
                    </div>
                    <WorkButton step={step} onWork={onWork} />
                    <DoneButton step={step} done={false} onDone={onDone} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progress.next && (
            <div className="flex min-w-0 gap-2 rounded-md bg-lm-chip px-2.5 py-2 text-sm">
              <ArrowRight
                width={14}
                height={14}
                className="mt-0.5 shrink-0 text-lm-accent-ink"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <span className="font-medium">Next: </span>
                <Markdown inline>{progress.next}</Markdown>
              </div>
              <WorkButton step={progress.next} onWork={onWork} />
              <DoneButton step={progress.next} done={false} onDone={onDone} />
            </div>
          )}

          {done.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-lm-ink2">
                Marked done · {done.length}
              </span>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {done.map((step) => (
                  <li
                    key={step.text}
                    className="flex min-w-0 gap-2 text-sm text-lm-muted"
                  >
                    <CircleCheckFill
                      width={14}
                      height={14}
                      className="mt-0.5 shrink-0 text-lm-ok"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 line-through">
                      <Markdown inline>{step.text}</Markdown>
                    </div>
                    <DoneButton step={step.text} done onDone={onDone} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** One line for the card on the canvas: how much is established and what is open. */
export function ProgressSummary({ progress }: { progress?: CardProgress }) {
  if (!progress) {
    return null;
  }
  return (
    <div
      aria-label="Progress summary"
      className="flex items-center gap-2 text-[11px] text-lm-muted"
    >
      <span className="flex items-center gap-1 text-lm-ok-ink">
        <CircleCheck width={12} height={12} aria-hidden="true" />
        {progress.established.length} established
      </span>
      {progress.done?.length ? (
        <>
          <span>·</span>
          <span>{progress.done.length} done</span>
        </>
      ) : null}
      <span>·</span>
      <span>{progress.remaining.length} remaining</span>
    </div>
  );
}
