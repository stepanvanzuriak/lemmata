# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [semantic versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-29

### Added

- Direct literature: paper cards from an arXiv id or link, source fetch and cache, and a `read_paper` tool so agents
  read a paper section by section instead of only its abstract.
- Literature cards with a verdict and suggestions on a hypothesis, and a literature check.
- Attack cards for recorded attempts on a hypothesis, and a Toolbox card that collects reusable Python and Lean helpers
  with searchable indexes.
- Codex as a second agent provider, enabled independently of Claude Code, with a model choice per Prover or Referee.
- Plots in Python cards.

### Changed

- Canvas cards split into per-kind components; the canvas MCP tools were refactored and the card payload updated.
- Chat panel and Lean prompt updates, and a fix for resolving notes.

## [0.1.0] - 2026-10-20

First public release.

### Added

- Research canvas with goal, hypothesis, statement, note, Python and Lean cards, and typed edges.
- Local execution of Python and Lean cards.
- Prover and Referee agents on the Claude Code CLI, with a chat panel, `/prover` and `/referee` commands, model choice
  and token caps.
- Progress panel for hypotheses, checks and referee issues.
- Research memory: a `remember` tool for agents, a prompt preamble for later runs, a Memory page and a home panel.
- First-run tour and setup check, replayable from Settings.
- Desktop app (Tauri) for Linux, macOS and Windows that runs its own daemon.
- Landing page on Vercel.

[Unreleased]: https://github.com/stepanvanzuriak/lemmata/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/stepanvanzuriak/lemmata/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/stepanvanzuriak/lemmata/releases/tag/v0.1.0
