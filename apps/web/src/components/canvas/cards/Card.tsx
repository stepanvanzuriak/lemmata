import clsx from "clsx";
import {
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { Chip } from "@heroui/react";
import type { CanvasNode, CardStatus } from "shared";
import { TONES } from "../../../lib/status";
import { Markdown } from "../../common/Markdown";

export type CardProps = {
  node: CanvasNode;
  status?: CardStatus | null;
};

export function Card({
  children,
  className,
  status,
}: PropsWithChildren<{ className: string; status?: CardStatus | null }>) {
  const tint = status ? TONES[status.tone].tint : "bg-lm-surface";

  return (
    <article
      className={clsx(
        "box-border flex flex-col gap-2 rounded-xl border",
        tint,
        className,
      )}
    >
      {children}
    </article>
  );
}

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");

  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${s}`
    : `${m}:${s}`;
}

function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="tabular-nums">{formatElapsed(now - since)}</span>;
}

export function StatusChip({ status }: { status?: CardStatus | null }) {
  if (!status) {
    return null;
  }

  const { chipColor, Icon } = TONES[status.tone];

  return (
    <Chip size="sm" variant="soft" color={chipColor} className="self-start">
      <Icon width={12} height={12} aria-hidden="true" />
      {status.detail ? `${status.label} · ${status.detail}` : status.label}
      {status.since != null && (
        <>
          {" · "}
          <Elapsed since={status.since} />
        </>
      )}
    </Chip>
  );
}

export function Header({
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

export function Secondary({ children }: { children?: string }) {
  if (!children) {
    return null;
  }

  return (
    <Markdown className="line-clamp-3 text-xs leading-normal text-lm-muted">
      {children}
    </Markdown>
  );
}
