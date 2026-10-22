import clsx from "clsx";
import { Markdown } from "../../common/Markdown";
import { fieldsOf } from "../kinds";
import { StatusChip, type CardProps } from "./Card";

export function NoteCard({ node, status }: CardProps) {
  const p = fieldsOf(node);
  const isOk = status?.tone === "ok";
  const isResolvedByReferee = p.author === "Referee" && isOk;

  return (
    <div
      className={clsx(
        "box-border flex w-62.5 rotate-[-1.5deg] flex-col gap-2 rounded bg-lm-note px-4 py-3.5 shadow-[0_2px_6px_rgba(20,22,26,0.08)]",
        { "bg-lm-tint-ok": isOk },
      )}
    >
      <div className="text-sm leading-normal text-lm-note-ink">
        <Markdown inline>
          {`${isResolvedByReferee ? "RESOLVED: " : ""}${p.title || "Untitled"}`}
        </Markdown>
      </div>
      {p.text && !isResolvedByReferee && (
        <Markdown className="text-[13px] leading-normal text-lm-note-ink">
          {p.text}
        </Markdown>
      )}
      {p.author && (
        <div className="text-[11px] text-lm-note-muted">{p.author}</div>
      )}
      <StatusChip status={status} />
    </div>
  );
}
