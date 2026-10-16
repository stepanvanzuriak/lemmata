# daemon

The local HTTP API (Hono on `@hono/node-server`). It listens on `127.0.0.1` only and checks every request:

- the `Host` header must be `127.0.0.1:<port>` or `localhost:<port>` (blocks DNS rebinding);
- the `Origin` header, when present, must be the daemon's own or an allowed dev origin;
- `/api/*` requires the `x-lemmata-token` header.

`yarn dev` (repo root) runs it with `tsx watch`. Configuration comes from the environment:

| Variable            | Default                                       |
| ------------------- | --------------------------------------------- |
| `LEMMATA_PORT`      | `4317`                                        |
| `LEMMATA_TOKEN`     | random per launch (`dev-token` in `yarn dev`) |
| `LEMMATA_WORKSPACE` | `.dev-workspace`                              |
| `LEMMATA_ORIGINS`   | `http://localhost:5173,http://127.0.0.1:5173` |

On start it prints `LEMMATA_URL=http://127.0.0.1:<port>/#token=<token>`.
