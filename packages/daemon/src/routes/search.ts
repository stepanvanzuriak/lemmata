import { Hono } from "hono";
import { searchProjects, type Db } from "core";
import type { SearchResult } from "shared";

const SNIPPET_LENGTH = 120;

export function searchRoutes(db: Db) {
  return new Hono().get("/", async (c) => {
    const q = c.req.query("q")?.trim() ?? "";

    if (!q) {
      return c.json<SearchResult[]>([]);
    }

    const projects = await searchProjects(db, q);

    return c.json<SearchResult[]>(
      projects.map((p) => ({
        type: "project",
        id: p.id,
        title: p.title,
        snippet: p.statement.slice(0, SNIPPET_LENGTH),
      })),
    );
  });
}
