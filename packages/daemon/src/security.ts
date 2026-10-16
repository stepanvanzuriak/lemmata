import type { MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";

export const TOKEN_HEADER = "x-lemmata-token";

export type SecurityOptions = {
  port: number;
  token: string;
  allowedOrigins?: string[];
};

/** Characters `bearerAuth` accepts in a token. Generated tokens (base64url) always match. */
export const TOKEN_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/;

export function hostAndOrigin(options: SecurityOptions): MiddlewareHandler {
  return async (c, next) => {
    const hosts = [`127.0.0.1:${options.port}`, `localhost:${options.port}`];

    if (!hosts.includes(c.req.header("host") ?? "")) {
      return c.json({ error: "forbidden host" }, 403);
    }

    const origin = c.req.header("origin");
    const origins = hosts
      .map((h) => `http://${h}`)
      .concat(options.allowedOrigins ?? []);

    if (origin !== undefined && !origins.includes(origin)) {
      return c.json({ error: "forbidden origin" }, 403);
    }

    await next();
  };
}

export function requireToken(options: SecurityOptions): MiddlewareHandler {
  const unauthorized = { message: { error: "unauthorized" } };

  return bearerAuth({
    token: options.token,
    headerName: TOKEN_HEADER,
    prefix: "",
    noAuthenticationHeader: unauthorized,
    invalidToken: unauthorized,
    invalidAuthenticationHeader: { message: { error: "malformed token" } },
  });
}
