import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { expect, it } from "vitest";
import { projectExportFileName, type Canvas } from "shared";
import { figuresDir } from "../../runCard.js";
import { authed, testApp } from "../helpers/app.js";

const json = (method: string, body?: unknown) => ({
  method,
  headers: authed({ "content-type": "application/json" }),
  body: body === undefined ? undefined : JSON.stringify(body),
});

it("exports a project as a .lemmata zip with its data and figures", async () => {
  const workspaceDir = await mkdtemp(join(tmpdir(), "lemmata-ws-"));
  const app = await testApp(undefined, workspaceDir);
  const project = await (
    await app.request(
      "/api/projects",
      json("POST", { title: "Collatz conjecture", statement: "3n+1" }),
    )
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
  await writeFile(join(dir, "stray.txt"), "ignored");

  const res = await app.request(`/api/projects/${project.id}/export`, {
    headers: authed(),
  });

  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/zip");
  expect(res.headers.get("content-disposition")).toContain(
    'filename="Collatz-conjecture.lemmata"',
  );

  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const read = (name: string) => JSON.parse(strFromU8(files[name]!));

  expect(read("manifest.json")).toMatchObject({
    format: "lemmata-project",
    version: 1,
  });
  expect(read("project.json")).toMatchObject({
    id: project.id,
    title: "Collatz conjecture",
    statement: "3n+1",
  });

  const canvases = read("canvases.json");

  expect(canvases).toHaveLength(1);
  expect(canvases[0].nodes.map((n: { id: string }) => n.id)).toContain(node.id);
  expect(read("attempts.json")).toEqual([]);
  expect(read("memory.json")).toEqual([]);
  expect(strFromU8(files[`figures/${node.id}/fig-1.png`]!)).toBe("png-bytes");
  expect(files[`figures/${node.id}/stray.txt`]).toBeUndefined();
});

it("404s an unknown project", async () => {
  const app = await testApp();
  const res = await app.request("/api/projects/nope/export", {
    headers: authed(),
  });

  expect(res.status).toBe(404);
});

it("names exports after the title, keeping non-Latin letters", () => {
  expect(projectExportFileName("Гіпотеза: a/b?")).toBe("Гіпотеза-ab.lemmata");
  expect(projectExportFileName("  ..  ")).toBe("project.lemmata");
});

it("sends a UTF-8 file name alongside an ASCII fallback", async () => {
  const app = await testApp();
  const project = await (
    await app.request("/api/projects", json("POST", { title: "Гіпотеза" }))
  ).json();
  const res = await app.request(`/api/projects/${project.id}/export`, {
    headers: authed(),
  });

  expect(res.headers.get("content-disposition")).toBe(
    `attachment; filename="________.lemmata"; filename*=UTF-8''${encodeURIComponent("Гіпотеза.lemmata")}`,
  );
});
