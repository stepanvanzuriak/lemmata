import { runCliProcess } from "../../cli-process.js";
import type { AgentAdapter, RunHandle, StartOptions } from "../../runner.js";
import { codexArgs } from "./args.js";
import { mapCodexLine } from "./messages.js";
import { listCodexModels } from "./models.js";

export class CodexAdapter implements AgentAdapter {
  readonly name = "codex";
  constructor(private readonly command = "codex") {}

  get models() {
    return listCodexModels({ command: this.command });
  }

  start(options: StartOptions): RunHandle {
    return runCliProcess({
      command: this.command,
      args: codexArgs(options),
      cwd: options.cwd,
      parseLine: mapCodexLine,
    });
  }
}
