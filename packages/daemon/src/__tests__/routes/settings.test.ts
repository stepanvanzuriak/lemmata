import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
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
  expect(await initial.json()).toEqual({
    onboarded: false,
    agent: "claude",
    providers: { claude: true, codex: false },
  });

  const saved = await app.request("/api/settings", patch({ onboarded: true }));
  expect(saved.status).toBe(200);
  expect(await saved.json()).toEqual({
    onboarded: true,
    agent: "claude",
    providers: { claude: true, codex: false },
  });

  const restarted = await testApp(undefined, dir);
  const again = await restarted.request("/api/settings", {
    headers: authed(),
  });
  expect(await again.json()).toEqual({
    onboarded: true,
    agent: "claude",
    providers: { claude: true, codex: false },
  });
});

it("rejects a body with the wrong types", async () => {
  const app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-ws-")),
  );
  const res = await app.request("/api/settings", patch({ onboarded: "yes" }));

  expect(res.status).toBe(400);
});

it("remembers independent provider switches across restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  const app = await testApp(undefined, dir);
  const providers = { claude: true, codex: true };
  const saved = await app.request("/api/settings", patch({ providers }));
  expect(saved.status).toBe(200);
  const restarted = await testApp(undefined, dir);
  expect(
    await (
      await restarted.request("/api/settings", { headers: authed() })
    ).json(),
  ).toMatchObject({ providers });
  const disabled = await app.request(
    "/api/settings",
    patch({ providers: { claude: false, codex: false } }),
  );
  expect(disabled.status).toBe(200);
  expect(
    await (await app.request("/api/models", { headers: authed() })).json(),
  ).toEqual([]);
});

it("migrates the previous provider choice", async () => {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  await mkdir(join(dir, ".lemmata"));
  await writeFile(
    join(dir, ".lemmata/settings.json"),
    JSON.stringify({ onboarded: true, agent: "codex" }),
  );
  const app = await testApp(undefined, dir);
  expect(
    await (await app.request("/api/settings", { headers: authed() })).json(),
  ).toMatchObject({
    onboarded: true,
    providers: { claude: false, codex: true },
  });
});
