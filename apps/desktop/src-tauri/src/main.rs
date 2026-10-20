// Hides the console window on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::VecDeque,
    env, fs,
    path::PathBuf,
    process::{Command, Stdio},
    sync::Mutex,
};

use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

const LOG_LINES: usize = 40;
const URL_PREFIX: &str = "LEMMATA_URL=";

/// `target="_blank"` links would open a second webview; navigating the current one instead
/// lets `on_navigation` hand them to the system browser.
const EXTERNAL_LINKS: &str = r#"
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a[target=_blank]") : null;
  if (link && link.href) {
    event.preventDefault();
    window.location.assign(link.href);
  }
}, true);
"#;

/// The running daemon, killed when the app exits.
struct Daemon(Mutex<Option<CommandChild>>);

/// Where the bundled daemon and web app live: next to the executable, else the resource dir.
fn resource_root(app: &AppHandle) -> Option<PathBuf> {
    let beside_exe = env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(PathBuf::from));
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");

    [beside_exe, app.path().resource_dir().ok(), Some(dev)]
        .into_iter()
        .flatten()
        .find(|dir| dir.join("daemon/dist/daemon.mjs").exists())
}

/// An app launched from a menu does not see the PATH of the user's shell, where `claude` and
/// `uv` usually live, so ask a login shell for it.
fn login_shell_path() -> Option<String> {
    if cfg!(windows) {
        return None;
    }
    let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/sh".into());
    let output = Command::new(shell)
        .args(["-lic", "printf '__P__%s__P__' \"$PATH\""])
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&output.stdout);
    let start = text.find("__P__")? + "__P__".len();
    let end = start + text[start..].find("__P__")?;

    Some(text[start..end].to_string())
}

fn workspace_dir(app: &AppHandle) -> Option<PathBuf> {
    env::var_os("LEMMATA_WORKSPACE")
        .map(PathBuf::from)
        .or_else(|| app.path().home_dir().ok().map(|home| home.join("Lemmata")))
}

fn fail(window: &WebviewWindow, message: &str, log: &VecDeque<String>) {
    let log = log.iter().cloned().collect::<Vec<_>>().join("\n");
    let script = format!(
        "window.lemmataFailed({}, {})",
        js_string(message),
        js_string(&log)
    );
    let _ = window.eval(&script);
}

/// A JavaScript string literal (JSON strings are valid JavaScript).
fn js_string(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => {}
            '\u{2028}' => out.push_str("\\u2028"),
            '\u{2029}' => out.push_str("\\u2029"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn is_internal(url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "ipc" | "asset" | "about" | "data" | "blob" => true,
        _ => matches!(
            url.host_str(),
            Some("127.0.0.1" | "localhost" | "tauri.localhost" | "ipc.localhost")
        ),
    }
}

fn start_daemon(app: &AppHandle, window: WebviewWindow) -> Result<(), String> {
    let root = resource_root(app).ok_or("The bundled daemon was not found.")?;
    let workspace = workspace_dir(app).ok_or("Could not find a home folder for the workspace.")?;
    fs::create_dir_all(&workspace)
        .map_err(|e| format!("Could not create {}: {e}", workspace.display()))?;

    let mut command = app
        .shell()
        .sidecar("lemmata-node")
        .map_err(|e| e.to_string())?
        .args([
            root.join("daemon/dist/daemon.mjs")
                .to_string_lossy()
                .as_ref(),
            "serve",
            workspace.to_string_lossy().as_ref(),
            "--port",
            "0",
            "--no-open",
            "--exit-with-parent",
            "--static",
            root.join("web").to_string_lossy().as_ref(),
        ]);

    if let Some(path) = login_shell_path() {
        command = command.env("PATH", path);
    }

    let (mut events, child) = command.spawn().map_err(|e| e.to_string())?;
    *app.state::<Daemon>().0.lock().unwrap() = Some(child);

    tauri::async_runtime::spawn(async move {
        let mut log: VecDeque<String> = VecDeque::new();
        let mut started = false;

        while let Some(event) = events.recv().await {
            let line = match event {
                CommandEvent::Stdout(bytes) | CommandEvent::Stderr(bytes) => {
                    String::from_utf8_lossy(&bytes).trim_end().to_string()
                }
                CommandEvent::Error(message) => message,
                CommandEvent::Terminated(payload) => {
                    if !started {
                        let code = payload.code.map_or("none".to_string(), |c| c.to_string());
                        fail(
                            &window,
                            &format!(
                                "The Lemmata daemon exited with code {code} before it was ready."
                            ),
                            &log,
                        );
                    }
                    break;
                }
                _ => continue,
            };

            if let Some(url) = line.strip_prefix(URL_PREFIX) {
                if let Ok(url) = url.trim().parse::<Url>() {
                    started = true;
                    let _ = window.navigate(url);
                    continue;
                }
            }

            log.push_back(line);
            if log.len() > LOG_LINES {
                log.pop_front();
            }
        }
    });

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(Daemon(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Lemmata")
                    .inner_size(1360.0, 860.0)
                    .min_inner_size(900.0, 600.0)
                    .initialization_script(EXTERNAL_LINKS)
                    .on_navigation(move |url| {
                        if is_internal(url) {
                            return true;
                        }
                        if matches!(url.scheme(), "http" | "https" | "mailto") {
                            let _ = handle.opener().open_url(url.as_str(), None::<&str>);
                        }
                        false
                    })
                    .build()?;

            if let Err(message) = start_daemon(app.handle(), window.clone()) {
                fail(&window, &message, &VecDeque::new());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Lemmata")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(child) = app.state::<Daemon>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
