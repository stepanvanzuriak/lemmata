import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Handler } from "hono";
import { VERSION } from "shared/version";
import { CANVAS_INSTRUCTIONS } from "./instructions.js";
import { lookupRun } from "./registry.js";
import { registerTools, type ToolDeps } from "./tools.js";

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

    return transport.handleRequest(c.req.raw);
  };
}
