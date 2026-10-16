import { Chip, Typography } from "@heroui/react";
import { CircleFill } from "@gravity-ui/icons";
import type { Toolchain } from "shared";
import { useWorkspace } from "../api/workspace";

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

export function DaemonStatus() {
  const { data, isError, isPending } = useWorkspace();

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
            {isPending ? "Connecting…" : "Daemon running"}
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
