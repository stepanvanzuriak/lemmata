import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { Canvas } from "shared";
import { figuresDir } from "../../runCard.js";
import { authed, testApp } from "../helpers/app.js";

const json = (method: string, body?: unknown) => ({
  method,
  headers: authed({ "content-type": "application/json" }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup() {
  const workspaceDir = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  const app = await testApp(undefined, workspaceDir);
  const project = await (
    await app.request("/api/projects", json("POST", { title: "P" }))
  ).json();
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, json("GET"))
  ).json()) as Canvas[];
  const node = await (
    await app.request(
      `/api/canvases/${canvas!.id}/nodes`,
      json("POST", {
        kind: "python",
        x: 0,
        y: 0,
        payload: { title: "plot", source: "" },
      }),
    )
  ).json();
  const dir = figuresDir(workspaceDir, node.id);

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "fig-1.png"), "png-bytes");

  return { app, node, dir, workspaceDir, canvas: canvas! };
}

const get = (app: Awaited<ReturnType<typeof setup>>["app"], path: string) =>
  app.request(path, { headers: authed() });

it("serves a figure as image/png", async () => {
  const { app, node } = await setup();
  const res = await get(app, `/api/nodes/${node.id}/figures/fig-1.png`);

  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("image/png");
  expect(res.headers.get("cache-control")).toBe("no-cache");
  expect(await res.text()).toBe("png-bytes");
});

it("rejects bad names and unknown nodes or files", async () => {
  const { app, node } = await setup();

  expect((await get(app, `/api/nodes/${node.id}/figures/..%2Fx`)).status).toBe(
    400,
  );
  expect(
    (await get(app, `/api/nodes/${node.id}/figures/fig-1.svg`)).status,
  ).toBe(400);
  expect((await get(app, `/api/nodes/nope/figures/fig-1.png`)).status).toBe(
    404,
  );
  expect(
    (await get(app, `/api/nodes/${node.id}/figures/fig-2.png`)).status,
  ).toBe(404);
});

it("removes the figures folder when the node is deleted", async () => {
  const { app, node, workspaceDir } = await setup();
  const res = await app.request(`/api/nodes/${node.id}`, json("DELETE"));

  expect(res.status).toBe(200);
  expect(await readdir(join(workspaceDir, ".lemmata", "figures"))).toEqual([]);
});
