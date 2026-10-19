import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { HOST, authed, testApp } from "../helpers/app.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lemmata-fs-"));
  await mkdir(join(dir, "beta"));
  await mkdir(join(dir, "alpha"));
  await mkdir(join(dir, ".hidden"));
  await writeFile(join(dir, "file.txt"), "x");
});

afterEach(() => rm(dir, { recursive: true, force: true }));

const list = async (
  path?: string,
  headers: Record<string, string> = authed(),
) =>
  (await testApp()).request(
    `/api/fs${path === undefined ? "" : `?path=${encodeURIComponent(path)}`}`,
    { headers },
  );

it("lists only visible directories, sorted", async () => {
  const res = await list(dir);

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({
    path: dir,
    entries: [
      { name: "alpha", path: join(dir, "alpha") },
      { name: "beta", path: join(dir, "beta") },
    ],
  });
});

it("defaults to the home folder", async () => {
  const res = await list();

  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ path: homedir() });
});

it("answers 400 for a bad path", async () => {
  const res = await list(join(dir, "nope"));

  expect(res.status).toBe(400);
  expect(await res.json()).toHaveProperty("error");
});

it("creates a folder", async () => {
  const app = await testApp();
  const path = join(dir, "new");
  const res = await app.request("/api/fs/mkdir", {
    method: "POST",
    headers: authed({ "content-type": "application/json" }),
    body: JSON.stringify({ path }),
  });

  expect(res.status).toBe(201);
  expect(await res.json()).toEqual({ name: "new", path });
  expect((await list(dir)).status).toBe(200);
});

it("refuses to create a folder under a missing parent", async () => {
  const app = await testApp();
  const res = await app.request("/api/fs/mkdir", {
    method: "POST",
    headers: authed({ "content-type": "application/json" }),
    body: JSON.stringify({ path: join(dir, "a", "b") }),
  });

  expect(res.status).toBe(400);
});

it("rejects requests without a token", async () => {
  const res = await list(dir, { host: HOST });

  expect(res.status).toBe(401);
});
