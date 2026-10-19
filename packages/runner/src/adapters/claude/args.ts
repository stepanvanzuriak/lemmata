import type { StartOptions } from "../../runner.js";

const DEFAULT_TOOLS = ["Read", "Glob", "Grep"];

/** `claude -p` flags for one run. */
export function claudeArgs(options: StartOptions) {
  const permissions = options.permissions ?? { mode: "default" };
  const args = [
    "-p",
    options.prompt,
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    permissions.mode,
    "--allowedTools",
    (permissions.allowedTools ?? DEFAULT_TOOLS).join(","),
  ];
  const env: Record<string, string> = {};

  if (options.resumeSessionId) {
    args.push("--resume", options.resumeSessionId);
  }
  if (options.model) {
    args.push("--model", options.model.id);
  }
  if (options.systemPromptAddendum) {
    args.push("--append-system-prompt", options.systemPromptAddendum);
  }
  if (options.mcpServers) {
    // Keeps the user's global MCP servers out: their schemas cost tens of thousands of tokens per turn.
    args.push(
      "--strict-mcp-config",
      "--mcp-config",
      JSON.stringify({ mcpServers: options.mcpServers }),
      "--tools",
      ...DEFAULT_TOOLS,
    );
    // Claude Code otherwise hides MCP tool descriptions behind ToolSearch.
    env.ENABLE_TOOL_SEARCH = "false";
  }

  return { args, env };
}
