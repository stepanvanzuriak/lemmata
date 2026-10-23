import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { Canvas, CanvasDetail, CanvasEdge, CanvasNode } from "shared";
import type { ArxivClient } from "../../arxiv/arxiv.js";
import { authed, testApp } from "../helpers/app.js";
import { feedArxiv } from "../helpers/arxiv.js";

const send = (method: string, body?: unknown) => ({
  method,
  headers: authed({ "content-type": "application/json" }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup(arxiv?: ArxivClient) {
  const app = await testApp(
    undefined,
    await mkdtemp(join(tmpdir(), "lemmata-ws-")),
    undefined,
    arxiv,
  );
  const project = await (
    await app.request(
      "/api/projects",
      send("POST", { title: "Collatz", statement: "Every orbit reaches 1." }),
    )
  ).json();
  const [canvas] = (await (
    await app.request(`/api/canvases?projectId=${project.id}`, send("GET"))
  ).json()) as Canvas[];
  const detail = async () =>
    (await (
      await app.request(`/api/canvases/${canvas!.id}`, send("GET"))
    ).json()) as CanvasDetail;
  const goal = (await detail()).nodes[0]!;

  return { app, project, canvas: canvas!, goal, detail };
}

it("lists a project's canvases and returns the detail with a parsed goal", async () => {
  const { goal } = await setup();

  expect(goal.kind).toBe("goal");
  expect(goal.payload).toMatchObject({
    title: "Collatz",
    text: "Every orbit reaches 1.",
    status: "open",
  });
});

it("requires projectId when listing", async () => {
  const app = await testApp();
  const res = await app.request("/api/canvases", send("GET"));

  expect(res.status).toBe(400);
});

it("creates a canvas for a project, 404 for a missing one", async () => {
  const { app, project } = await setup();

  const res = await app.request(
    `/api/projects/${project.id}/canvases`,
    send("POST", { title: "Second" }),
  );
  expect(res.status).toBe(201);
  expect(await res.json()).toMatchObject({ title: "Second" });

  const missing = await app.request(
    "/api/projects/missing/canvases",
    send("POST", {}),
  );
  expect(missing.status).toBe(404);
});

it("adds, updates, moves and deletes a node", async () => {
  const { app, canvas, detail } = await setup();

  const added = await app.request(
    `/api/canvases/${canvas.id}/nodes`,
    send("POST", { kind: "note", x: 10, y: 20, payload: { title: "Idea" } }),
  );
  expect(added.status).toBe(201);
  const node = (await added.json()) as CanvasNode;
  expect(node.payload).toEqual({ title: "Idea" });

  const patched = await app.request(
    `/api/nodes/${node.id}`,
    send("PATCH", { text: "More" }),
  );
  expect(patched.status).toBe(200);
  expect((await patched.json()).payload).toEqual({
    title: "Idea",
    text: "More",
  });

  const moved = await app.request(
    `/api/canvases/${canvas.id}/nodes`,
    send("PATCH", { nodes: [{ id: node.id, x: 100, y: 200, w: 300 }] }),
  );
  expect(moved.status).toBe(200);
  expect((await detail()).nodes[1]).toMatchObject({ x: 100, y: 200, w: 300 });

  const deleted = await app.request(`/api/nodes/${node.id}`, send("DELETE"));
  expect(deleted.status).toBe(200);
  expect((await detail()).nodes).toHaveLength(1);
});

it("rejects an unknown node kind", async () => {
  const { app, canvas } = await setup();
  const res = await app.request(
    `/api/canvases/${canvas.id}/nodes`,
    send("POST", { kind: "banana" }),
  );

  expect(res.status).toBe(400);
});

it("answers 409 when deleting the goal node", async () => {
  const { app, goal } = await setup();
  const res = await app.request(`/api/nodes/${goal.id}`, send("DELETE"));

  expect(res.status).toBe(409);
});

it("adds an edge once and deletes it", async () => {
  const { app, canvas, goal, detail } = await setup();
  const node = (await (
    await app.request(
      `/api/canvases/${canvas.id}/nodes`,
      send("POST", { kind: "hypothesis", payload: { title: "H1" } }),
    )
  ).json()) as CanvasNode;
  const body = { fromNode: goal.id, toNode: node.id, kind: "depends-on" };

  const first = await app.request(
    `/api/canvases/${canvas.id}/edges`,
    send("POST", body),
  );
  expect(first.status).toBe(201);
  const edge = (await first.json()) as CanvasEdge;

  const again = (await (
    await app.request(`/api/canvases/${canvas.id}/edges`, send("POST", body))
  ).json()) as CanvasEdge;
  expect(again.id).toBe(edge.id);
  expect((await detail()).edges).toHaveLength(1);

  const deleted = await app.request(`/api/edges/${edge.id}`, send("DELETE"));
  expect(deleted.status).toBe(200);
  expect((await detail()).edges).toHaveLength(0);
});

it("answers 404 for missing canvases, nodes and edges", async () => {
  const { app, goal } = await setup();
  const cases: [string, ReturnType<typeof send>][] = [
    ["/api/canvases/missing", send("GET")],
    ["/api/canvases/missing/nodes", send("POST", { kind: "note" })],
    ["/api/canvases/missing/nodes", send("PATCH", { nodes: [] })],
    [
      "/api/canvases/missing/edges",
      send("POST", { fromNode: goal.id, toNode: goal.id, kind: "used-by" }),
    ],
    ["/api/nodes/missing", send("PATCH", { title: "x" })],
    ["/api/nodes/missing", send("DELETE")],
    ["/api/edges/missing", send("DELETE")],
  ];

  for (const [path, init] of cases) {
    const res = await app.request(path, init);
    expect(res.status, `${init.method} ${path}`).toBe(404);
  }
});

it("runs a python card and clears the run when the source changes", async () => {
  const { app, canvas } = await setup();
  const node = (await (
    await app.request(
      `/api/canvases/${canvas.id}/nodes`,
      send("POST", {
        kind: "python",
        payload: { title: "check", source: "print(6*7)" },
      }),
    )
  ).json()) as CanvasNode;

  const res = await app.request(`/api/nodes/${node.id}/run`, send("POST"));
  expect(res.status).toBe(200);
  expect((await res.json()).payload.run).toMatchObject({
    ok: true,
    output: { stdout: "42\n", exitCode: 0 },
  });

  const edited = await app.request(
    `/api/nodes/${node.id}`,
    send("PATCH", { source: "print(1)" }),
  );
  expect((await edited.json()).payload.run).toBeUndefined();
});

it("refuses to run a card that is not code", async () => {
  const { app, goal } = await setup();
  const res = await app.request(`/api/nodes/${goal.id}/run`, send("POST"));

  expect(res.status).toBe(400);
});

const TEX =
  "\\documentclass{article}\n\\section{Intro}\nHello.\n\\section{Main}\nWorld.";
const sourceArxiv: ArxivClient = {
  ...feedArxiv,
  fetchSource: async () => ({
    file: { name: "main.tex", data: new TextEncoder().encode(TEX) },
    files: ["main.tex"],
  }),
};

it("adds a paper card by link and fetches its source without the text", async () => {
  const { app, canvas, goal, detail } = await setup(sourceArxiv);
  const added = await app.request(
    `/api/canvases/${canvas.id}/papers`,
    send("POST", { arxivId: "https://arxiv.org/abs/1208.0053v2" }),
  );
  const node = (await added.json()) as CanvasNode;

  expect(added.status).toBe(201);
  expect(node).toMatchObject({
    kind: "arxiv",
    createdBy: "user",
    payload: { arxivId: "1208.0053" },
  });
  expect((await detail()).edges).toEqual([
    expect.objectContaining({ fromNode: goal.id, toNode: node.id }),
  ]);

  const fetched = await app.request(
    `/api/nodes/${node.id}/source`,
    send("POST"),
  );
  const body = (await fetched.json()) as CanvasNode;
  const source = (body.payload as { source?: { sections: unknown[] } }).source;

  expect(fetched.status).toBe(200);
  expect(source?.sections).toEqual([
    { index: 0, title: "Intro" },
    { index: 1, title: "Main" },
  ]);
  expect(JSON.stringify(body)).not.toContain("Hello.");
});

it("refuses a bad or unknown paper and a source for another card", async () => {
  const { app, canvas, goal } = await setup(sourceArxiv);
  const add = (arxivId: string, extra = {}) =>
    app.request(
      `/api/canvases/${canvas.id}/papers`,
      send("POST", { arxivId, ...extra }),
    );

  expect((await add("https://evil.test/x")).status).toBe(400);
  expect((await add("2101.99999")).status).toBe(400);
  expect((await add("1208.0053", { connectFrom: "H9" })).status).toBe(400);
  expect(
    (await app.request(`/api/nodes/${goal.id}/source`, send("POST"))).status,
  ).toBe(400);
  expect(
    (await app.request("/api/nodes/nope/source", send("POST"))).status,
  ).toBe(404);
});
