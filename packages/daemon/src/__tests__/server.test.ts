import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { startServer } from "../server.js";

it("listens on a free port and answers over HTTP", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  const server = await startServer({ workspace, port: 0, token: "t" });

  try {
    expect(server.port).toBeGreaterThan(0);
    expect(server.url).toBe(`http://127.0.0.1:${server.port}/#token=t`);

    const res = await fetch(`http://127.0.0.1:${server.port}/api/health`, {
      headers: { "x-lemmata-token": "t" },
    });

    expect(res.status).toBe(200);
  } finally {
    await server.close();
  }
});
