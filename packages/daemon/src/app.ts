import { Hono } from "hono";
import type { Db } from "core";
import type { Toolchain } from "shared";
import {
  hostAndOrigin,
  requireToken,
  type SecurityOptions,
} from "./security.js";
import { projectRoutes } from "./routes/projects.js";
import { workspaceRoutes } from "./routes/workspace.js";
import { serveWeb } from "./static.js";
import { fsRoutes } from "./routes/fs.js";
import { searchRoutes } from "./routes/search.js";
import { canvasRoutes } from "./routes/canvases.js";
import { mcpHandler } from "./mcp/server.js";
import { chatRoutes } from "./routes/chat.js";
import { figureRoutes } from "./routes/figures.js";
import { memoryRoutes } from "./routes/memory.js";
import { settingsRoutes } from "./routes/settings.js";
import { debugRoutes } from "./routes/debug.js";
import type { AgentAdapter } from "runner";
import { HttpArxivClient, type ArxivClient } from "./arxiv/arxiv.js";

export type AppOptions = {
  devMode?: boolean;
  db: Db;
  security: SecurityOptions;
  workspaceDir: string;
  toolchain: Promise<Toolchain>;
  staticDir?: string;
  adapter?: () => AgentAdapter;
  arxiv?: ArxivClient;
};

export function createApp({
  db,
  security,
  workspaceDir,
  toolchain,
  staticDir,
  adapter,
  arxiv = new HttpArxivClient(),
  devMode = process.env.NODE_ENV === "development",
}: AppOptions) {
  const app = new Hono()
    .use("*", hostAndOrigin(security))
    .all("/mcp", mcpHandler({ db, workspaceDir, toolchain, arxiv, devMode }))
    .use("/api/*", requireToken(security))
    .get("/api/health", (c) => c.json({ ok: true }))
    .route("/api/projects", projectRoutes(db))
    .route("/api/fs", fsRoutes())
    .route("/api/settings", settingsRoutes(workspaceDir))
    .route("/api/search", searchRoutes(db))
    .route("/api", canvasRoutes(db, { workspaceDir, toolchain, arxiv }))
    .route("/api", figureRoutes({ db, workspaceDir }))
    .route("/api", memoryRoutes(db))
    .route(
      "/api",
      chatRoutes({
        db,
        workspaceDir,
        toolchain,
        arxiv,
        adapter,
        port: () => security.port,
        devMode,
      }),
    )
    .route(
      "/api/workspace",
      workspaceRoutes({
        dir: workspaceDir,
        address: () => `127.0.0.1:${security.port}`,
        toolchain,
      }),
    )
    .notFound((c) => c.json({ error: "not found" }, 404));

  if (devMode) {
    app.route("/api/debug", debugRoutes(db));
  } else {
    app.all("/api/debug/*", (c) => c.json({ error: "not found" }, 404));
  }

  if (staticDir) {
    app.get("*", ...serveWeb(staticDir));
  }

  return app;
}

export type AppType = ReturnType<typeof createApp>;
