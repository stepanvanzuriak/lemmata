import clsx from "clsx";

export function CardTags({
  tags,
  className,
}: {
  tags?: string[];
  className?: string;
}) {
  if (!tags?.length) {
    return null;
  }

  return (
    <div
      aria-label="Topics"
      className={clsx("flex flex-wrap gap-1", className)}
    >
      {Array.from(new Set(tags)).map((tag) => (
        <span
          key={tag}
          className="max-w-full rounded-full bg-lm-chip px-2 py-0.5 text-[10px] text-lm-ink2 [overflow-wrap:anywhere]"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
