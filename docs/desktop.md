# Desktop app

The desktop app is a [Tauri](https://tauri.app/) window around the same daemon and web app you get from source. On
start it launches the bundled daemon on a bundled Node, waits for it to print its URL, loads the UI from it, and stops
it on exit (also after a crash or `kill -9`, on Linux and macOS).

## Where things live

| What               | Where                                                                      |
| ------------------ | -------------------------------------------------------------------------- |
| Projects and data  | `~/Lemmata` (`.lemmata/` inside holds the SQLite database and settings)    |
| Another folder     | set `LEMMATA_WORKSPACE` before launching                                   |
| Agents, `uv`, Lean | found through your login shell's `PATH`, so a launcher start sees them too |

## Installing

Download the installer for your system from the [releases page](https://github.com/stepanvanzuriak/lemmata/releases).

- **Linux:** `.deb` (Debian, Ubuntu) or `.rpm` (Fedora). Animations need GStreamer's H.264 support
  (`gstreamer1.0-libav` on Debian and Ubuntu, `gst-libav` on Arch).
- **macOS:** `.dmg` for Apple silicon or Intel.
- **Windows:** the `.exe` installer.

### Unsigned builds

The installers are not code signed or notarized yet, so your system warns about them.

- **macOS:** if the app is reported as damaged, run `xattr -dr com.apple.quarantine /Applications/Lemmata.app` once, or
  right-click the app and choose Open.
- **Windows:** SmartScreen shows "Windows protected your PC". Choose More info, then Run anyway.

Only install builds you downloaded from this repository's releases page.

## Building it yourself

Needs Node 22+, Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
yarn install
yarn workspace desktop build:no-bundle   # the app only: apps/desktop/src-tauri/target/release/lemmata-desktop
yarn workspace desktop build             # installers for this platform
yarn workspace desktop start             # tauri dev
```

`yarn workspace desktop prepare-bundle` does the first half on its own. It builds the web app, bundles the daemon into
one file with rolldown, copies the native SQLite driver, the migrations and the running Node binary into
`apps/desktop/src-tauri/resources` and `binaries` (both ignored by git).

## How it works

- `apps/desktop/src-tauri/src/main.rs` opens the window on `splash/index.html`, asks a login shell for `PATH`,
  spawns `node daemon.mjs serve <workspace> --port 0 --no-open --exit-with-parent --static <web>`, and navigates the
  window to the `LEMMATA_URL=` line the daemon prints. If the daemon exits first, the splash shows the last log lines.
- Links to other sites open in the system browser instead of inside the app.
- The UI served by the daemon gets no access to Tauri APIs.

## Limits

Settings stored in the browser, such as the theme, do not persist between launches because the daemon picks a new port
each time. Workspace settings (such as the finished tour) are kept in `.lemmata/settings.json` instead.
