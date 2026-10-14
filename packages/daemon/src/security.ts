import { createHash, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

export const TOKEN_HEADER = "x-lemmata-token";

export type SecurityOptions = {
  port: number;
  token: string;
  allowedOrigins?: string[];
};

const digest = (s: string) => createHash("sha256").update(s).digest();

export function tokenMatches(
  given: string | undefined,
  expected: string,
): boolean {
  return given ? timingSafeEqual(digest(given), digest(expected)) : false;
}

export function hostAndOrigin({
  port,
  allowedOrigins = [],
}: SecurityOptions): MiddlewareHandler {
  const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const origins = new Set(
    [...hosts].map((h) => `http://${h}`).concat(allowedOrigins),
  );
  return async (c, next) => {
    if (!hosts.has(c.req.header("host") ?? "")) {
      return c.json({ error: "forbidden host" }, 403);
    }

    const origin = c.req.header("origin");

    if (origin !== undefined && !origins.has(origin)) {
      return c.json({ error: "forbidden origin" }, 403);
    }
    await next();
  };
}

export function requireToken({ token }: SecurityOptions): MiddlewareHandler {
  return async (c, next) => {
    if (!tokenMatches(c.req.header(TOKEN_HEADER), token)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    await next();
  };
}
