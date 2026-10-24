import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { authed, testApp } from "../helpers/app.js";

const patch = (body: unknown) => ({
  method: "PATCH",
  headers: authed({ "content-type": "application/json" }),
  body: JSON.stringify(body),
});

it("starts not onboarded and remembers the change across restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  const app = await testApp(undefined, dir);

  const initial = await app.request("/api/settings", { headers: authed() });
  expect(await initial.json()).toEqual({ onboarded: false, agent: "claude" });

  const saved = await app.request("/api/settings", patch({ onboarded: true }));
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({ onboarded: true, agent: "claude" });

  const restarted = await testApp(undefined, dir);
  const again = await restarted.request("/api/settings", {
    headers: authed(),
  });
  expect(await again.json()).toEqual({ onboarded: true, agent: "claude" });
});

it("rejects a body with the wrong types", async () => {
  const app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-ws-")),
  );
  const res = await app.request("/api/settings", patch({ onboarded: "yes" }));

  expect(res.status).toBe(400);
});
