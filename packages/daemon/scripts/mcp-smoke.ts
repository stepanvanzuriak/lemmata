// Real agent check, not part of `yarn test`: `yarn workspace daemon mcp-smoke`.
// Starts a daemon on a scratch workspace, gives a Haiku run the canvas tools and their
// server instructions, and prints the canvas afterwards.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdapter } from "runner";
import {
  mcpConfigFor,
  registerRun,
  unregisterRun,
} from "../src/mcp/registry.js";
import { startServer } from "../src/server.js";

const workspace = await mkdtemp(join(tmpdir(), "lemmata-smoke-"));
const server = await startServer({ workspace, port: 0 });
const api = (path: string, init: RequestInit = {}) =>
  fetch(`http://127.0.0.1:${server.port}/api${path}`, {
    ...init,
    headers: {
      "x-lemmata-token": server.token,
      "content-type": "application/json",
    },
  }).then((res) => res.json());

const project = await api("/projects", {
  method: "POST",
  body: JSON.stringify({
    title: "Sums of odd numbers",
    statement: "The sum of the first $n$ odd numbers is $n^2$.",
  }),
});
const [canvas] = await api(`/canvases?projectId=${project.id}`);
const secret = registerRun({
  canvasId: canvas.id,
  author: { role: "assistant", agentId: "smoke" },
});

try {
  const handle = createAdapter("claude").start({
    cwd: workspace,
    prompt:
      "Add one hypothesis that the identity holds for n up to 50, with a python check that verifies it. Run the check, then settle the hypothesis.",
    model: { provider: "anthropic", id: "haiku" },
    permissions: { mode: "default", allowedTools: ["mcp__lemmata"] },
    mcpServers: mcpConfigFor(secret, server.port),
  });

  for await (const event of handle.events) {
    if (event.type === "tool_use") {
      console.log("tool:", event.name);
    }
    if (event.type === "tool_result" && event.isError) {
      console.log("  refused:", event.output);
    }
    if (event.type === "text") {
      console.log("text:", event.text);
    }
    if (event.type === "error") {
      console.error("error:", event.message);
    }
  }

  const detail = await api(`/canvases/${canvas.id}`);
  for (const node of detail.nodes) {
    console.log(
      `${node.kind} ${node.payload.label ?? ""} "${node.payload.title}" status=${node.payload.status ?? "-"} run=${node.payload.run?.badge ?? "-"}`,
    );
  }
} finally {
  unregisterRun(secret);
  await server.close();
}
