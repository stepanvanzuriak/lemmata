import { Chip, Typography } from "@heroui/react";
import { CircleFill } from "@gravity-ui/icons";
import type { Toolchain } from "shared";
import { useWorkspace } from "../../api/workspace";

const toolNames: Record<keyof Toolchain, string> = {
  claude: "Claude Code",
  lean: "Lean",
  python: "Python",
  uv: "uv",
};

const shortVersion = (version: string) =>
  version.match(/\d+(\.\d+)+/)?.[0] ?? version;

function describeTools(toolchain: Toolchain) {
  const found = Object.entries(toolNames).flatMap(([key, name]) => {
    const version = toolchain[key as keyof Toolchain];

    return version ? [`${name} ${shortVersion(version)}`] : [];
  });

  return found.length ? found.join(" · ") : "No tools found";
}

function statusOf(isError: boolean, isPending: boolean) {
  if (isError) {
    return { label: "Daemon unreachable", dot: "text-lm-danger" };
  }
  if (isPending) {
    return { label: "Connecting...", dot: "text-lm-nav-dim" };
  }
  return { label: "Daemon running", dot: "text-lm-ok" };
}

/** `compact` is a dot for the collapsed sidebar; hovering it says the rest. */
export function DaemonStatus({ compact = false }: { compact?: boolean }) {
  const { data, isError, isPending } = useWorkspace();

  if (compact) {
    const { label, dot } = statusOf(isError, isPending);
    const detail =
      data && !isError
        ? `\n${data.address}\n${describeTools(data.toolchain)}`
        : "";

    return (
      <span
        role="status"
        aria-label={label}
        title={`${label}${detail}`}
        className={`flex size-11 items-center justify-center ${dot}`}
      >
        <CircleFill width={8} height={8} aria-hidden="true" />
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1.5 rounded-[10px] border border-lm-nav-card-line bg-lm-nav-card p-3">
      {isError ? (
        <Chip size="sm" color="danger" variant="soft">
          <CircleFill width={6} />
          <Chip.Label>Daemon unreachable</Chip.Label>
        </Chip>
      ) : (
        <Chip
          size="sm"
          color={isPending ? "default" : "success"}
          variant="soft"
        >
          <CircleFill width={6} />
          <Chip.Label>
            {isPending ? "Connecting..." : "Daemon running"}
          </Chip.Label>
        </Chip>
      )}
      {data && !isError && (
        <>
          <Typography type="body-xs" className="font-mono text-lm-nav-dim">
            {data.address}
          </Typography>
          <Typography type="body-xs" className="text-lm-nav-dim">
            {describeTools(data.toolchain)}
          </Typography>
        </>
      )}
      {isError && (
        <Typography type="body-xs" className="text-lm-nav-dim">
          Start it with <span className="font-mono">yarn dev</span> or{" "}
          <span className="font-mono">lemmata serve</span>.
        </Typography>
      )}
    </div>
  );
}
