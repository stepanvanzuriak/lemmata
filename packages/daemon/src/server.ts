import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { initWorkspace, MIGRATIONS_FOLDER } from "core";
import { createApp } from "./app.js";
import type { SecurityOptions } from "./security.js";
import { detectToolchain, warmPython } from "./toolchain.js";

export type ServerOptions = {
  workspace: string;
  port?: number;
  token?: string;
  allowedOrigins?: string[];
  staticDir?: string;
  migrationsFolder?: string;
};

export type RunningServer = {
  port: number;
  token: string;
  url: string;
  close: () => Promise<void>;
};

export async function startServer(
  options: ServerOptions,
): Promise<RunningServer> {
  const workspaceDir = resolve(options.workspace);
  const db = await initWorkspace(
    workspaceDir,
    options.migrationsFolder ?? MIGRATIONS_FOLDER,
  );
  const security: SecurityOptions = {
    port: options.port ?? 4317,
    token: options.token ?? randomBytes(24).toString("base64url"),
    allowedOrigins: options.allowedOrigins,
  };
  const toolchain = detectToolchain();
  toolchain.then(warmPython, () => {});

  const app = createApp({
    db,
    security,
    workspaceDir,
    toolchain,
    staticDir: options.staticDir && resolve(options.staticDir),
  });

  const { server, port } = await new Promise<{
    server: ReturnType<typeof serve>;
    port: number;
  }>((done, fail) => {
    const server = serve(
      { fetch: app.fetch, port: security.port, hostname: "127.0.0.1" },
      (info) => done({ server, port: info.port }),
    );

    server.once("error", fail);
  });

  security.port = port;

  return {
    port,
    token: security.token,
    url: `http://127.0.0.1:${port}/#token=${security.token}`,
    close: () =>
      new Promise((done, fail) =>
        server.close((error) => (error ? fail(error) : done())),
      ),
  };
}
