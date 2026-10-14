import { randomBytes } from "node:crypto";
import { serve } from "@hono/node-server";
import { initWorkspace, MIGRATIONS_FOLDER } from "core";
import { createApp } from "./app.js";

const port = Number(process.env.LEMMATA_PORT ?? 4317);
const token =
  process.env.LEMMATA_TOKEN ?? randomBytes(24).toString("base64url");
const workspace = process.env.LEMMATA_WORKSPACE ?? ".dev-workspace";
const allowedOrigins = (
  process.env.LEMMATA_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173"
).split(",");

const db = await initWorkspace(workspace, MIGRATIONS_FOLDER);
const app = createApp(db, { port, token, allowedOrigins });

serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
  console.log(`LEMMATA_URL=http://127.0.0.1:${info.port}/#token=${token}`);
});
