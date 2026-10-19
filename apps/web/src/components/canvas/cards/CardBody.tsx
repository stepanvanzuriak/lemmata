import type { ReactNode } from "react";
import clsx from "clsx";
import { Chip } from "@heroui/react";
import type { CanvasNode, CardStatus } from "shared";
import { TONES } from "../../../lib/status";
import { Markdown } from "../../common/Markdown";
import { fieldsOf, KIND_LABELS } from "../kinds";

const card = "box-border flex flex-col gap-2 rounded-xl border";

const tintOf = (status?: CardStatus | null) =>
  status ? TONES[status.tone].tint : "bg-lm-surface";

export function StatusChip({ status }: { status?: CardStatus | null }) {
  if (!status) {
    return null;
  }

  const { chipColor, Icon } = TONES[status.tone];

  return (
    <Chip size="sm" variant="soft" color={chipColor} className="self-start">
      <Icon width={12} height={12} aria-hidden="true" />
      {status.detail ? `${status.label} · ${status.detail}` : status.label}
    </Chip>
  );
}

function Header({
  children,
  meta,
  className,
}: {
  children: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 text-[11px] font-semibold tracking-[0.06em] uppercase",
        className,
      )}
    >
      {children}
      {meta && (
        <span className="ml-auto truncate font-normal tracking-normal text-lm-muted normal-case">
          {meta}
        </span>
      )}
    </div>
  );
}

function Secondary({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return (
    <Markdown className="line-clamp-3 text-xs leading-normal text-lm-muted">
      {children}
    </Markdown>
  );
}

function CodeCard({
  node,
  status,
}: {
  node: CanvasNode;
  status?: CardStatus | null;
}) {
  const p = fieldsOf(node);
  const lastLine = (p.run?.output.stdout || p.run?.output.stderr || "")
    .trim()
    .split("\n")
    .at(-1);
  const isPython = node.kind === "python";

  return (
    <article
      className={clsx(
        card,
        tintOf(status),
        "w-72.5 gap-0 overflow-hidden border-lm-line",
      )}
    >
      <Header
        className={clsx(
          "border-b border-lm-hair px-3.5 py-2.5",
          isPython ? "text-lm-teal-ink" : "text-lm-muted",
        )}
        meta={
          <Markdown inline className="font-mono">
            {p.title || ""}
          </Markdown>
        }
      >
        {isPython ? "Python" : "Lean check"}
      </Header>
      <pre className="m-0 max-h-40 overflow-hidden bg-lm-code px-3.5 py-2.5 font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap text-lm-code-fg">
        {p.source || " "}
      </pre>
      <div className="flex min-w-0 items-center gap-2 px-3.5 py-2">
        <StatusChip status={status} />
        {lastLine && (
          <span className="min-w-0 truncate font-mono text-[11px] text-lm-muted">
            {lastLine}
          </span>
        )}
      </div>
    </article>
  );
}

export function CardBody({
  node,
  status,
}: {
  node: CanvasNode;
  status?: CardStatus | null;
}) {
  const tint = tintOf(status);
  const chip = <StatusChip status={status} />;
  const p = fieldsOf(node);
  const title = p.title || "Untitled";

  switch (node.kind) {
    case "goal":
      return (
        <article
          className={clsx(
            card,
            tint,
            "w-80 border-[1.5px] border-lm-ink px-4 py-3.5",
          )}
        >
          <Header
            className="text-lm-ink"
            meta={p.author && `pinned by ${p.author}`}
          >
            Goal
          </Header>
          <div className="font-serif text-base leading-normal font-semibold">
            <Markdown inline>{title}</Markdown>
          </div>
          {p.text && (
            <Markdown className="line-clamp-5 font-serif text-[15px] leading-normal italic">
              {p.text}
            </Markdown>
          )}
          {chip}
        </article>
      );
    case "hypothesis":
      return (
        <article
          className={clsx(card, tint, "w-85 border-lm-line px-4 py-3.5")}
        >
          <Header className="text-lm-accent-ink">
            {p.label ? `${p.label} · hypothesis` : "Hypothesis"}
          </Header>
          <div className="text-sm leading-normal">
            <Markdown inline>{title}</Markdown>
          </div>
          <Secondary>{p.text}</Secondary>
          {chip}
        </article>
      );
    case "python":
    case "lean":
      return <CodeCard node={node} status={status} />;
    case "note":
      return (
        <div className="box-border flex w-62.5 rotate-[-1.5deg] flex-col gap-2 rounded bg-lm-note px-4 py-3.5 shadow-[0_2px_6px_rgba(20,22,26,0.08)]">
          <div className="text-sm leading-normal text-lm-note-ink">
            <Markdown inline>{title}</Markdown>
          </div>
          {p.text && (
            <Markdown className="text-[13px] leading-normal text-lm-note-ink">
              {p.text}
            </Markdown>
          )}
          {p.author && (
            <div className="text-[11px] text-lm-note-muted">{p.author}</div>
          )}
          {chip}
        </div>
      );
    case "memory":
      return (
        <article
          className={clsx(card, tint, "w-80 gap-1.5 border-lm-line px-4 py-3")}
        >
          <Header className="text-lm-warn-ink">{KIND_LABELS.memory}</Header>
          <div className="text-[13px] leading-[1.45]">
            <Markdown inline>{title}</Markdown>
          </div>
        </article>
      );
    case "arxiv":
      return (
        <article
          className={clsx(
            card,
            tint,
            "w-72.5 gap-1.5 border-lm-line px-3.5 py-3",
          )}
        >
          <Header className="text-lm-warn-ink">{KIND_LABELS.arxiv}</Header>
          <div className="text-[13px] leading-[1.4] font-medium">
            <Markdown inline>{title}</Markdown>
          </div>
          <Secondary>{p.text}</Secondary>
          {chip}
        </article>
      );
    default:
      return (
        <article
          className={clsx(card, tint, "w-75 border-lm-line px-4 py-3.5")}
        >
          <Header className="text-lm-muted">{KIND_LABELS[node.kind]}</Header>
          <div className="font-serif text-[15px] leading-normal">
            <Markdown inline>{title}</Markdown>
          </div>
          <Secondary>{p.text}</Secondary>
          {chip}
        </article>
      );
  }
}
