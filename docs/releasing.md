# Releasing

Releases are tags. Pushing `vX.Y.Z` runs `.github/workflows/release.yml`, which builds the desktop app for Linux, macOS
(Apple silicon and Intel) and Windows and attaches the installers to a **draft** GitHub release. Nothing is published
until you publish the draft.

## One-time setup

1. In the repository settings, under Pages, set the source to **GitHub Actions**. The website then deploys from `main`
   whenever `apps/site` changes.
2. Under Settings, Actions, General, allow workflows to have read and write permissions (the release workflow needs
   `contents: write`).
3. Turn on private vulnerability reporting (Settings, Code security), which `SECURITY.md` points to.

## Cutting a release

1. Update `CHANGELOG.md`: move the entries from `[Unreleased]` into a new `## [X.Y.Z] - YYYY-MM-DD` section and fix the
   compare links at the bottom.
2. Set the version everywhere and check it:

   ```sh
   node scripts/version.mjs set X.Y.Z
   node scripts/version.mjs
   ```

   This updates the root, desktop and site `package.json`, `tauri.conf.json`, `Cargo.toml` and `Cargo.lock`.

3. Make sure `yarn check` and `yarn test` pass, commit (`Release vX.Y.Z`) and merge to `main`.
4. Tag and push:

   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. Watch the Release workflow. It refuses to build if the tag does not match the versions in the repo or the changelog
   has no section for it. Use the workflow's "Run workflow" button with the tag to retry a failed build.
6. Open the draft release, check that every installer is attached, try one, then publish it. A tag with a hyphen
   (`v0.2.0-rc.1`) makes a pre-release.

## What each platform ships

| Platform             | Installer      |
| -------------------- | -------------- |
| Linux                | `.deb`, `.rpm` |
| macOS, Apple silicon | `.dmg`         |
| macOS, Intel         | `.dmg`         |
| Windows              | NSIS `.exe`    |

The bundle carries its own Node, so users do not need one. Builds are unsigned. To add signing later, give
`tauri-apps/tauri-action` the Apple and Windows signing secrets described in the
[Tauri distribution guides](https://v2.tauri.app/distribute/), and drop the unsigned note from the release notes in the
workflow.

## Before the first release

The release workflow has only run on Linux locally. Run it once on a throwaway tag (for example `v0.1.0-rc.1`) and try
the macOS and Windows installers before announcing anything.
