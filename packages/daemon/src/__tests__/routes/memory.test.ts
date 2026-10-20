import type { MemoryEntry, Project } from "shared";
import { expect, it } from "vitest";
import { authed, testApp } from "../helpers/app.js";

const send = (method: string, body?: unknown) => ({
  method,
  headers: authed({ "content-type": "application/json" }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

async function setup() {
  const app = await testApp();
  const create = async (title: string) =>
    (await (
      await app.request("/api/projects", send("POST", { title }))
    ).json()) as Project;
  return { app, project: await create("Collatz"), create };
}

it("adds, lists, edits, pins and deletes entries", async () => {
  const { app, project } = await setup();
  const add = (kind: string, text: string) =>
    app.request(
      `/api/projects/${project.id}/memory`,
      send("POST", { kind, text }),
    );

  const res = await add("idea", "  Try a potential function.  ");
  expect(res.status).toBe(201);
  const entry = (await res.json()) as MemoryEntry;
  expect(entry).toMatchObject({
    kind: "idea",
    text: "Try a potential function.",
    pinned: false,
    canvasId: null,
  });

  expect((await add("fact", "try a potential FUNCTION.")).status).toBe(409);
  await add("dead-end", "Induction fails.");

  const list = async (query = "") =>
    (await (
      await app.request(`/api/memory${query}`, { headers: authed() })
    ).json()) as MemoryEntry[];
  expect(await list()).toHaveLength(2);
  expect(
    (await list(`?projectId=${project.id}&kind=dead-end`)).map((e) => e.text),
  ).toEqual(["Induction fails."]);
  expect(await list("?projectId=other")).toEqual([]);

  const patched = await app.request(
    `/api/memory/${entry.id}`,
    send("PATCH", { pinned: true, kind: "fact", text: "Potential works." }),
  );
  expect(patched.status).toBe(200);
  expect(await patched.json()).toMatchObject({
    pinned: true,
    kind: "fact",
    text: "Potential works.",
  });

  const clash = await app.request(
    `/api/memory/${entry.id}`,
    send("PATCH", { text: "induction FAILS." }),
  );
  expect(clash.status).toBe(409);

  const del = await app.request(`/api/memory/${entry.id}`, send("DELETE"));
  expect(del.status).toBe(204);
  expect(await list()).toHaveLength(1);
});

it("rejects bad input and unknown targets", async () => {
  const { app, project } = await setup();
  const url = `/api/projects/${project.id}/memory`;

  expect(
    (await app.request(url, send("POST", { kind: "fact", text: " " }))).status,
  ).toBe(400);
  expect(
    (await app.request(url, send("POST", { kind: "nope", text: "x" }))).status,
  ).toBe(400);
  expect(
    (
      await app.request(
        "/api/projects/missing/memory",
        send("POST", { kind: "fact", text: "x" }),
      )
    ).status,
  ).toBe(404);
  expect(
    (await app.request("/api/memory/missing", send("PATCH", { pinned: true })))
      .status,
  ).toBe(404);
  expect(
    (await app.request("/api/memory/missing", send("DELETE"))).status,
  ).toBe(404);
});
