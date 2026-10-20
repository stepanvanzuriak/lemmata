# Security policy

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please do not open a public issue. Report it privately through
[GitHub security advisories](https://github.com/stepanvanzuriak/lemmata/security/advisories/new) with steps to reproduce
and the version you tested. You can expect an answer within a few days.

## Security model

Lemmata is a local app, and the parts that matter are:

- The daemon binds to `127.0.0.1` only. It checks the `Host` header (against DNS rebinding) and the `Origin` header,
  and every `/api/*` request needs a random per-launch token.
- Agent tool calls reach the canvas through an MCP endpoint that needs a per-run secret, which stops existing when the
  run ends.
- Python and Lean cards run code on your machine as your user. Agents can write those cards, so review code before
  running it when you do not trust the source of the project.
- Agents run through the Claude Code CLI with your account, and its permissions and data handling apply.

Reports about any of these, or about ways to get around them, are in scope.
