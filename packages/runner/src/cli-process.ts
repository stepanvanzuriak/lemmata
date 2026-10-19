import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { RunEvent, RunHandle } from "./runner.js";

const STDERR_TAIL = 2048;
const KILL_AFTER_MS = 2000;

export type CliProcessOptions = {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  parseLine: (json: unknown) => RunEvent[];
};

function channel<T>() {
  const items: T[] = [];
  let wake: (() => void) | null = null;
  let closed = false;
  const notify = () => {
    wake?.();
    wake = null;
  };

  return {
    push(item: T) {
      items.push(item);
      notify();
    },
    close() {
      closed = true;
      notify();
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (items.length > 0) {
          yield items.shift()!;
          continue;
        }
        if (closed) {
          return;
        }
        await new Promise<void>((resolve) => (wake = resolve));
      }
    },
  };
}

/**
 * Runs an agent CLI that prints one JSON object per line. Shared by every CLI adapter:
 * the adapter supplies the command line and the line parser.
 */
export function runCliProcess({
  command,
  args,
  cwd,
  env = {},
  parseLine,
}: CliProcessOptions): RunHandle {
  const events = channel<RunEvent>();
  let stderr = "";
  let finished = false;
  let aborted = false;

  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const emit = (event: RunEvent) => {
    if (event.type === "done") finished = true;
    events.push(event);
  };

  createInterface({ input: child.stdout }).on("line", (line) => {
    if (aborted || !line.trim()) return;
    try {
      parseLine(JSON.parse(line)).forEach(emit);
    } catch {
      // Not JSON: CLIs sometimes print plain warnings.
    }
  });

  child.stderr.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL);
  });

  const exited = new Promise<void>((resolve) => {
    const end = (code: number | null, error?: Error) => {
      if (aborted) {
        events.push({ type: "done", reason: "aborted" });
      } else if (!finished && (code !== 0 || error)) {
        emit({ type: "error", message: (error?.message ?? stderr).trim() });
        emit({ type: "done", reason: "error" });
      } else if (!finished) {
        emit({ type: "done", reason: "completed" });
      }
      events.close();
      resolve();
    };

    child.on("error", (error) => end(null, error));
    child.on("close", (code) => end(code));
  });

  return {
    events,
    abort: async () => {
      if (finished || aborted) return;
      aborted = true;
      child.kill("SIGTERM");
      const timer = setTimeout(() => child.kill("SIGKILL"), KILL_AFTER_MS);
      await exited;
      clearTimeout(timer);
    },
  };
}
