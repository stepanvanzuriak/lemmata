import { extname, resolve } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { MiddlewareHandler } from "hono";

export function serveWeb(
  dir: string,
): [MiddlewareHandler, MiddlewareHandler, MiddlewareHandler] {
  const root = resolve(dir);
  const files = serveStatic({ root });
  const index = serveStatic({ root, path: "index.html" });

  const cacheControl: MiddlewareHandler = async (c, next) => {
    c.header(
      "cache-control",
      c.req.path.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );
    await next();
  };

  const clientRoutes: MiddlewareHandler = (c, next) =>
    extname(c.req.path) || c.req.path.startsWith("/api/")
      ? next()
      : index(c, next);

  return [cacheControl, files, clientRoutes];
}
