import { MIGRATIONS_FOLDER, openDb } from "core";
import type { AgentAdapter } from "runner";
import { createApp } from "../../app.js";
import type { ArxivClient } from "../../arxiv/arxiv.js";
import { TOKEN_HEADER } from "../../security.js";

export const TOKEN = "test-token";
export const HOST = "127.0.0.1:4317";

export async function testApp(
  staticDir?: string,
  workspaceDir = "/tmp/ws",
  adapter?: () => AgentAdapter,
  arxiv: ArxivClient = offlineArxiv,
  devMode = false,
) {
  return createApp({
    db: await openDb(":memory:", MIGRATIONS_FOLDER),
    security: { port: 4317, token: TOKEN },
    workspaceDir,
    toolchain: Promise.resolve({
      claude: "2.1.0 (Claude Code)",
      uv: null,
      python: "Python 3.12.4",
      lean: null,
    }),
    staticDir,
    adapter,
    arxiv,
    devMode,
  });
}

export const offlineArxiv: ArxivClient = {
  search: async () => [],
  byIds: async () => [],
  fetchSource: async () => {
    throw new Error("offline");
  },
};

export const authed = (headers: Record<string, string> = {}) => ({
  host: HOST,
  [TOKEN_HEADER]: TOKEN,
  ...headers,
});
