import { describe, expect, it } from "vitest";
import { authed, HOST, testApp } from "./helpers/app.js";

describe("guards", () => {
  it("answers with the token on an allowed host", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", { headers: authed() });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("accepts localhost as the host", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", {
      headers: authed({ host: "localhost:4317" }),
    });

    expect(res.status).toBe(200);
  });

  it("rejects a missing token", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", { headers: { host: HOST } });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects a wrong token", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", {
      headers: authed({ "x-lemmata-token": "nope" }),
    });

    expect(res.status).toBe(401);
  });

  it("rejects a foreign host (DNS rebinding)", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", {
      headers: authed({ host: "evil.example:4317" }),
    });

    expect(res.status).toBe(403);
  });

  it("rejects a foreign origin even with the token", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", {
      headers: authed({ origin: "https://evil.example" }),
    });

    expect(res.status).toBe(403);
  });

  it("accepts the daemon's own origin", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", {
      headers: authed({ origin: `http://${HOST}` }),
    });

    expect(res.status).toBe(200);
  });

  it("answers unknown API routes with JSON 404", async () => {
    const app = await testApp();
    const res = await app.request("/api/nope", { headers: authed() });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not found" });
  });
});

it("answers a malformed token with JSON 400", async () => {
  const app = await testApp();
  const res = await app.request("/api/health", {
    headers: authed({ "x-lemmata-token": "has spaces" }),
  });

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "malformed token" });
});
