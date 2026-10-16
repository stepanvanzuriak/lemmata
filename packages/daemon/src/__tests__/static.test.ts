import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, expect, it } from "vitest";
import { HOST, testApp } from "./helpers/app.js";

let web: string;

beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), "lemmata-static-"));
  web = join(root, "dist");
  await mkdir(join(web, "assets"), { recursive: true });
  await writeFile(
    join(web, "index.html"),
    "<!doctype html><title>Lemmata</title>",
  );
  await writeFile(join(web, "assets", "app-abc.js"), "console.log(1)");
  await writeFile(join(root, "secret.txt"), "secret");
});

const get = async (path: string) =>
  (await testApp(web)).request(path, { headers: { host: HOST } });

it("serves index.html at the root without a token", async () => {
  const res = await get("/");

  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toContain("text/html");
  expect(res.headers.get("cache-control")).toBe("no-cache");
  expect(await res.text()).toContain("<title>Lemmata</title>");
});

it("serves fingerprinted assets with a long cache", async () => {
  const res = await get("/assets/app-abc.js");

  expect(res.headers.get("content-type")).toContain("text/javascript");
  expect(res.headers.get("cache-control")).toContain("immutable");
});

it("falls back to index.html for client routes", async () => {
  const res = await get("/canvas/123");

  expect(await res.text()).toContain("<title>Lemmata</title>");
});

it("answers missing files with 404", async () => {
  expect((await get("/missing.js")).status).toBe(404);
});

it("never serves files outside the folder", async () => {
  for (const path of [
    "/../secret.txt",
    "/%2e%2e/secret.txt",
    "/..%2fsecret.txt",
    "/assets/%2e%2e%2f%2e%2e%2fsecret.txt",
  ]) {
    const res = await get(path);

    expect(await res.text()).not.toContain("secret");
  }
});

it("still guards the API", async () => {
  expect((await get("/api/health")).status).toBe(401);
});
