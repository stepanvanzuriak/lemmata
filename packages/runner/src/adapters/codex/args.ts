import { MCP_TOOL_TIMEOUT_MS, type StartOptions } from "../../runner.js";

function tomlInlineTable(value: Record<string, string>) {
  const entries = Object.entries(value).map(
    ([key, item]) => `${JSON.stringify(key)} = ${JSON.stringify(item)}`,
  );
  return `{ ${entries.join(", ")} }`;
}

export function codexArgs(options: StartOptions) {
  const args = options.resumeSessionId
    ? ["exec", "resume", "--json", "--skip-git-repo-check"]
    : [
        "exec",
        "--json",
        "--cd",
        options.cwd,
        "--sandbox",
        "workspace-write",
        "--skip-git-repo-check",
      ];

  if (options.model) {
    args.push("--model", options.model.id);
  }
  const prompt = options.systemPromptAddendum
    ? `${options.prompt}\n\n${options.systemPromptAddendum}`
    : options.prompt;
  for (const [name, server] of Object.entries(options.mcpServers ?? {})) {
    args.push(
      "--config",
      `mcp_servers.${name}.url=${JSON.stringify(server.url)}`,
      "--config",
      `mcp_servers.${name}.default_tools_approval_mode="approve"`,
      "--config",
      `mcp_servers.${name}.tool_timeout_sec=${MCP_TOOL_TIMEOUT_MS / 1000}`,
    );
    if (server.headers) {
      args.push(
        "--config",
        `mcp_servers.${name}.http_headers=${tomlInlineTable(server.headers)}`,
      );
    }
  }
  if (options.resumeSessionId) {
    args.push(options.resumeSessionId);
  }
  args.push(prompt);
  return args;
}
