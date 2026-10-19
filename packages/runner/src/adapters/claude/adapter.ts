import { runCliProcess } from "../../cli-process.js";
import type { AgentAdapter, RunHandle, StartOptions } from "../../runner.js";
import { claudeArgs } from "./args.js";
import { mapClaudeLine } from "./messages.js";

export type ClaudeAdapterOptions = {
  command?: string;
  commandArgs?: string[];
};

/** Claude Code CLI (`claude -p --output-format stream-json`). */
export class ClaudeAdapter implements AgentAdapter {
  readonly name = "claude";

  constructor(private readonly config: ClaudeAdapterOptions = {}) {}

  start(options: StartOptions): RunHandle {
    const { args, env } = claudeArgs(options);
    const seen = new Set<string>();

    return runCliProcess({
      command: this.config.command ?? "claude",
      args: [...(this.config.commandArgs ?? []), ...args],
      cwd: options.cwd,
      env,
      parseLine: (json) => mapClaudeLine(json, seen),
    });
  }
}
