import { MIGRATIONS_FOLDER, openDb } from "core";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { TOKEN_HEADER } from "./security.js";

const security = { port: 4317, token: "test-token" };
const host = { host: "127.0.0.1:4317" };

async function testApp() {
  return createApp(await openDb(":memory:", MIGRATIONS_FOLDER), security);
}

describe("app", () => {
  it("answers health with the token", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", {
      headers: { ...host, [TOKEN_HEADER]: "test-token" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rejects API calls without the token", async () => {
    const app = await testApp();
    const res = await app.request("/api/health", { headers: host });

    expect(res.status).toBe(401);
  });
});
