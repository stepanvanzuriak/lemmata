import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Handler } from "hono";
import { VERSION } from "shared/version";
import { addAttemptEvent } from "core";
import { CANVAS_INSTRUCTIONS } from "./instructions.js";
import { lookupRun } from "./registry.js";
import { registerTools, type ToolDeps } from "./tools/index.js";

export function mcpHandler(deps: ToolDeps): Handler {
  return async (c) => {
    const secret = c.req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const run = secret ? lookupRun(secret) : undefined;

    if (!run) {
      return c.json({ error: "unknown run" }, 401);
    }

    const server = new McpServer(
      { name: "lemmata", version: VERSION },
      { instructions: CANVAS_INSTRUCTIONS },
    );
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    registerTools(server, run, deps);
    await server.connect(transport);

    const attemptId = deps.devMode ? run.attemptId : undefined;
    const record = async (kind: string, data: unknown) => {
      if (attemptId) {
        await addAttemptEvent(deps.db, attemptId, kind, data);
      }
    };
    const request = attemptId
      ? ((await c.req.raw
          .clone()
          .json()
          .catch(() => null)) as unknown)
      : null;
    await record("mcp.request", request);
    try {
      const response = await transport.handleRequest(c.req.raw);
      if (attemptId) {
        const body = await response.clone().text();
        let result: unknown = body;
        try {
          result = JSON.parse(body);
        } catch {
          /* Empty notification response. */
        }
        await record("mcp.response", {
          requestId: (request as { id?: unknown } | null)?.id,
          status: response.status,
          body: result,
        });
      }
      return response;
    } catch (error) {
      await record("mcp.error", { request, message: String(error) });
      throw error;
    }
  };
}
