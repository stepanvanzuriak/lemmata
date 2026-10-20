import { Chip, Typography } from "@heroui/react";
import { CircleCheckFill, CircleDashed } from "@gravity-ui/icons";
import type { Toolchain as ToolchainInfo } from "shared";
import { useWorkspace } from "../../api/workspace";
import { ErrorNote, Loading } from "../common/State";

type Tool = {
  key: keyof ToolchainInfo;
  name: string;
  need: "required" | "recommended" | "optional";
  why: string;
  install: string;
};

const TOOLS: Tool[] = [
  {
    key: "claude",
    name: "Claude Code",
    need: "required",
    why: "Runs the Prover and Referee agents. Sign in once by running claude in a terminal.",
    install: "npm install -g @anthropic-ai/claude-code",
  },
  {
    key: "uv",
    name: "uv",
    need: "recommended",
    why: "Runs Python cards in a clean environment.",
    install: "curl -LsSf https://astral.sh/uv/install.sh | sh",
  },
  {
    key: "python",
    name: "Python",
    need: "recommended",
    why: "Needed for Python check cards (uv can fetch it).",
    install: "uv python install",
  },
  {
    key: "lean",
    name: "Lean 4",
    need: "optional",
    why: "Checks formal proofs on Lean cards.",
    install: "curl https://elan.lean-lang.org/elan-init.sh -sSf | sh",
  },
];

const shortVersion = (version: string) =>
  version.match(/\d+(\.\d+)+/)?.[0] ?? version;

export function Toolchain() {
  const { data, error, isPending, refetch } = useWorkspace();

  if (isPending) {
    return <Loading label="Looking for tools..." />;
  }

  if (error) {
    return <ErrorNote error={error} onRetry={() => refetch()} />;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {TOOLS.map(({ key, name, need, why, install }) => {
        const version = data.toolchain[key];

        return (
          <li
            key={key}
            className="flex items-start gap-3 rounded-xl border border-lm-line px-3.5 py-3"
          >
            {version ? (
              <CircleCheckFill
                width={18}
                height={18}
                aria-label="Found"
                className="mt-0.5 shrink-0 text-lm-accent"
              />
            ) : (
              <CircleDashed
                width={18}
                height={18}
                aria-label="Missing"
                className="mt-0.5 shrink-0 text-lm-muted"
              />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Typography type="body-sm" className="font-semibold">
                  {name}
                </Typography>
                {version ? (
                  <span className="font-mono text-xs text-lm-muted">
                    {shortVersion(version)}
                  </span>
                ) : (
                  <Chip
                    size="sm"
                    variant="soft"
                    color={need === "required" ? "danger" : "default"}
                  >
                    {need === "required" ? "Missing" : `Not found (${need})`}
                  </Chip>
                )}
              </div>
              <Typography type="body-xs" color="muted">
                {why}
              </Typography>
              {!version && (
                <code className="w-fit max-w-full overflow-x-auto rounded-md bg-lm-code px-2 py-1 font-mono text-xs text-lm-code-fg">
                  {install}
                </code>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
