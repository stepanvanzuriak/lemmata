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

export type AppOptions = {
  db: Db;
  security: SecurityOptions;
  workspaceDir: string;
  toolchain: Promise<Toolchain>;
  staticDir?: string;
};

export function createApp({
  db,
  security,
  workspaceDir,
  toolchain,
  staticDir,
}: AppOptions) {
  const app = new Hono()
    .use("*", hostAndOrigin(security))
    .use("/api/*", requireToken(security))
    .get("/api/health", (c) => c.json({ ok: true }))
    .route("/api/projects", projectRoutes(db))
    .route("/api/fs", fsRoutes())
    .route("/api/search", searchRoutes(db))
    .route("/api", canvasRoutes(db, { workspaceDir, toolchain }))
    .route(
      "/api/workspace",
      workspaceRoutes({
        dir: workspaceDir,
        address: () => `127.0.0.1:${security.port}`,
        toolchain,
      }),
    )
    .notFound((c) => c.json({ error: "not found" }, 404));

  if (staticDir) {
    app.get("*", ...serveWeb(staticDir));
  }

  return app;
}

export type AppType = ReturnType<typeof createApp>;
