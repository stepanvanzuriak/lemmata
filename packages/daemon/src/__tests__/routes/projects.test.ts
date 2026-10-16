import { expect, it } from "vitest";
import { authed, testApp } from "../helpers/app.js";

const post = (body: unknown) => ({
  method: "POST",
  headers: authed({ "content-type": "application/json" }),
  body: JSON.stringify(body),
});

it("creates a project from a valid body", async () => {
  const app = await testApp();
  const res = await app.request(
    "/api/projects",
    post({ title: "  Collatz ", dir: "" }),
  );

  expect(res.status).toBe(201);
  expect(await res.json()).toMatchObject({ title: "Collatz", dir: null });
});

it("rejects a project without a title", async () => {
  const app = await testApp();
  const res = await app.request("/api/projects", post({ title: "   " }));

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "title: title is required" });
});

it("rejects a body with the wrong types", async () => {
  const app = await testApp();
  const res = await app.request("/api/projects", post({ title: 42 }));

  expect(res.status).toBe(400);
});

it("answers 404 for a missing project", async () => {
  const app = await testApp();

  for (const method of ["GET", "DELETE"]) {
    const res = await app.request("/api/projects/missing", {
      method,
      headers: authed(),
    });

    expect(res.status).toBe(404);
  }
});
