# daemon

The local HTTP API (Hono on `@hono/node-server`) and the `lemmata` command line. It listens on `127.0.0.1` only and
checks every request:

- the `Host` header must be `127.0.0.1:<port>` or `localhost:<port>` (blocks DNS rebinding);
- the `Origin` header, when present, must be the daemon's own or one passed with `--origin`;
- `/api/*` requires the `x-lemmata-token` header. The token is random per launch and reaches the browser in the URL
  fragment (`/#token=…`), which the web app moves to `sessionStorage`.

## Command line

```sh
yarn workspace daemon lemmata init [dir]
yarn workspace daemon lemmata serve [dir] [--port <n>] [--token <t>] [--origin <url>]... [--static <dir>] \
  [--no-open] [--exit-with-parent]
```

| Option               | Default                                    | Notes                                                                   |
| -------------------- | ------------------------------------------ | ----------------------------------------------------------------------- |
| `dir`                | `$LEMMATA_WORKSPACE` or the current folder | workspace; data lives in `<dir>/.lemmata/`                              |
| `--port`             | `$LEMMATA_PORT` or `4317`                  | `0` picks a free port                                                   |
| `--token`            | `$LEMMATA_TOKEN` or random                 |                                                                         |
| `--origin`           | none                                       | extra allowed origins (the dev script allows Vite's)                    |
| `--static`           | none                                       | serve a built web app (`apps/web/dist`) with client-side route fallback |
| `--no-open`          |                                            | don't open the browser                                                  |
| `--exit-with-parent` |                                            | exit when the parent process dies (desktop app)                         |

On start it prints `LEMMATA_URL=http://127.0.0.1:<port>/#token=<token>` once.

To try the production setup:

```sh
yarn workspace web build
yarn workspace daemon lemmata serve ~/lemmata-test --static ../../apps/web/dist
```

## Development

`yarn dev` (repo root) runs `serve .dev-workspace` with `tsx watch`, token `dev-token` and Vite's origins allowed;
Vite proxies `/api` and adds the token, so `http://localhost:5173` needs no fragment.

## Layout

- `src/cli.ts`: commander program with `init` and `serve`.
- `src/server.ts`: `startServer()` returning `{ port, token, url, close }`.
- `src/app.ts`: `createApp()`: guards, routes, static files.
- `src/security.ts`: Host/Origin guard and the token check (Hono `bearerAuth`).
- `src/static.ts`: built web app via `serveStatic`, with client-route fallback and cache headers.
- `src/toolchain.ts`, `src/validate.ts` (Zod → `{ error }` 400s; schemas come from `core`).
- `src/routes/<area>.ts`: one Hono router per area.
- `src/__tests__/`: tests mirroring `src/`; `helpers/app.ts` builds an app on an in-memory database.
