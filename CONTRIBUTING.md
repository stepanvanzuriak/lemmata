# Contributing to Lemmata

Thanks for helping. Lemmata is an early project, so small, focused changes are the easiest to review.

## Before you start

- For a bug, search [existing issues](https://github.com/stepanvanzuriak/lemmata/issues) and open one with steps to
  reproduce.
- For a feature, open an issue first to agree on the shape of it. Open an issue before sending a large pull request.
- Security problems go through [SECURITY.md](SECURITY.md), not a public issue.

## Set up

Needs Node 22 or newer. Yarn 4 is committed in `.yarn/releases`.

```sh
yarn install
yarn dev        # daemon on 127.0.0.1:4317 and the web app on http://localhost:5173
```

Agents need the [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI. Python and Lean checks need `uv` and
`lean`, and the tests do not depend on any of them.

## Before you open a pull request

```sh
yarn check      # Prettier, ESLint and typecheck for every workspace
yarn test       # Vitest (yarn test --project core for one package)
```

CI runs both. A pre-commit hook runs lint-staged and the typecheck.

- Add or update tests next to the code you change (`src/__tests__/` in each package).
- After changing the database schema in `packages/core`, run `yarn workspace core generate` and commit the new
  migration folder. Never edit an existing migration.
- Keep API types in `packages/shared` so the daemon and the web app agree.
- Follow the style of the surrounding code. Prefer early returns and lookup maps to nested ternaries.
- Keep a pull request to one change, and say in the description what you tested.

## Project layout

See the table in the [README](README.md#layout). Package READMEs (`packages/daemon`, `apps/web`) explain their
internals.

## Desktop app

`apps/desktop` is the Tauri wrapper. You need Rust and the
[Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your platform.

```sh
yarn workspace desktop build:no-bundle   # builds the app without an installer
yarn workspace desktop start             # tauri dev
```

## Commit messages

Short, imperative subject lines. Mention the issue number when there is one.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
