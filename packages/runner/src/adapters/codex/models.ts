import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { ModelOption } from "../../runner.js";

type ModelPage = {
  data: { model: string; displayName: string; hidden?: boolean }[];
  nextCursor?: string | null;
};

/** Discover the installed CLI's picker catalog without starting an inference turn. */
export function listCodexModels({
  command = "codex",
  commandArgs = [],
  timeoutMs = 10_000,
}: {
  command?: string;
  commandArgs?: string[];
  timeoutMs?: number;
} = {}): Promise<ModelOption[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...commandArgs, "app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const lines = createInterface({ input: child.stdout });
    const models: ModelOption[] = [];
    const cursors = new Set<string>();
    let requestId = 0;
    let finished = false;
    let stderr = "";
    let killTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (error?: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      lines.close();
      child.stdin.end();
      child.kill("SIGTERM");
      // A misbehaving CLI must not leave a process behind after discovery.
      if (child.pid && child.exitCode === null && child.signalCode === null) {
        killTimer = setTimeout(() => child.kill("SIGKILL"), 2000);
        killTimer.unref();
      }
      if (error) {
        reject(error);
      } else {
        resolve(models);
      }
    };
    const timer = setTimeout(
      () => finish(new Error("Timed out discovering Codex models")),
      timeoutMs,
    );
    const send = (message: unknown) => {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    const list = (cursor?: string) => {
      send({
        id: ++requestId,
        method: "model/list",
        params: {
          limit: 100,
          includeHidden: false,
          ...(cursor ? { cursor } : {}),
        },
      });
    };

    child.on("error", finish);
    child.stdin.on("error", finish);
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2048);
    });
    child.on("close", () => {
      clearTimeout(killTimer);
      finish(new Error(`Codex model discovery exited early: ${stderr.trim()}`));
    });
    lines.on("line", (line) => {
      if (finished) {
        return;
      }
      let message;
      try {
        message = JSON.parse(line);
      } catch {
        // Ignore plain CLI warnings on stdout.
        return;
      }
      if (!message || message.id !== requestId) {
        return;
      }
      if (message.error) {
        finish(
          new Error(`Codex model discovery failed: ${message.error.message}`),
        );
        return;
      }
      if (requestId === 0) {
        send({ method: "initialized", params: {} });
        list();
        return;
      }
      const page = message.result as ModelPage | undefined;
      if (
        !Array.isArray(page?.data) ||
        page.data.some(
          (model) =>
            !model ||
            typeof model.model !== "string" ||
            typeof model.displayName !== "string",
        ) ||
        (page.nextCursor != null && typeof page.nextCursor !== "string")
      ) {
        finish(new Error("Invalid Codex model/list response"));
        return;
      }
      for (const model of page.data) {
        if (!model.hidden) {
          models.push({ id: model.model, label: model.displayName });
        }
      }
      if (page.nextCursor) {
        if (cursors.has(page.nextCursor)) {
          finish(new Error("Codex model/list returned a repeated cursor"));
          return;
        }
        cursors.add(page.nextCursor);
        list(page.nextCursor);
      } else {
        finish();
      }
    });
    send({
      id: requestId,
      method: "initialize",
      params: {
        clientInfo: { name: "lemmata", title: "Lemmata", version: "0.1.0" },
      },
    });
  });
}
