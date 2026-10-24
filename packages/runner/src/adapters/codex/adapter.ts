import { runCliProcess } from "../../cli-process.js";
import type { AgentAdapter, RunHandle, StartOptions } from "../../runner.js";
import { codexArgs } from "./args.js";
import { mapCodexLine } from "./messages.js";

export class CodexAdapter implements AgentAdapter {
  readonly name = "codex";
  readonly models = [
    { id: "gpt-6-luna", label: "GPT-6 Luna" },
    { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    { id: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
  ];
  constructor(private readonly command = "codex") {}
  start(options: StartOptions): RunHandle {
    return runCliProcess({
      command: this.command,
      args: codexArgs(options),
      cwd: options.cwd,
      parseLine: mapCodexLine,
    });
  }
}
