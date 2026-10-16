# Lemmata

A local research canvas where AI agents work on problems with you. A problem is a **goal** on a canvas; a **Prover**
agent splits it into **hypotheses** and proves or refutes them; a **Referee** checks the proofs. Everything lands on
the canvas as cards: proofs, counterexamples, Python/Lean checks, plots and animations. It runs locally, in the browser
or as a desktop app, using the Claude Code CLI for the agents.

Early rebuild: see `docs/tickets/README.md` for the plan and the state of each part.

## Layout

| Path              | Role                                                            |
| ----------------- | --------------------------------------------------------------- |
| `apps/web`        | React UI (Vite, HeroUI, Tailwind)                               |
| `packages/daemon` | local HTTP API (Hono), bound to `127.0.0.1` and token-protected |
| `packages/core`   | SQLite data model and migrations (Drizzle ORM)                  |
| `packages/shared` | types shared by the daemon and the web app                      |

## Development

Requires Node 22 or newer. Yarn 4 is committed in `.yarn/releases`, so any `yarn` on your PATH will use it.

```sh
yarn install
yarn dev
```

`yarn dev` starts the daemon on `127.0.0.1:4317` (workspace in `packages/daemon/.dev-workspace`, token `dev-token`)
and Vite on http://localhost:5173, which proxies `/api` to the daemon and adds the token.

| Command                        | Does                                                              |
| ------------------------------ | ----------------------------------------------------------------- |
| `yarn check`                   | Prettier check, ESLint, typecheck every workspace                 |
| `yarn test`                    | Vitest across all workspaces (`yarn test --project core` for one) |
| `yarn test:watch`              | Vitest in watch mode                                              |
| `yarn lint:fix`, `yarn format` | fix lint and formatting                                           |
| `yarn workspace core generate` | generate a migration after changing the schema                    |

A pre-commit hook runs lint-staged and the typecheck.

## License

MIT
