import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import type { LeanDiagnostic, RunOutput } from "shared";

export const MAX_OUTPUT = 200 * 1024;
const TRUNCATED = "\n... [output truncated]";

const ENV_ALLOW = new Set([
  "PATH",
  "HOME",
  "USER",
  "LANG",
  "TMPDIR",
  "ELAN_HOME",
  "TERM",
]);
const ENV_ALLOW_PREFIXES = ["LC_", "XDG_", "UV_", "LEAN_"];

export function isolatedEnv(env: NodeJS.ProcessEnv = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(
      ([key]) =>
        ENV_ALLOW.has(key) ||
        ENV_ALLOW_PREFIXES.some((prefix) => key.startsWith(prefix)),
    ),
  );
}

export type RunOptions = {
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string>;
  isolated?: boolean;
  outDir?: string;
  /** Aborting it stops the process; the output comes back with `stopped`. */
  signal?: AbortSignal;
  /** Sent before the kill on a timeout or stop, so the process can report where it was. */
  dumpSignal?: NodeJS.Signals;
};

/** How long a process gets to print its stack after `dumpSignal` before it is killed. */
export const DUMP_GRACE_MS = 2000;

export function runProcess(
  cmd: string,
  args: string[],
  {
    cwd,
    timeoutMs = 60_000,
    env = {},
    isolated = false,
    signal,
    dumpSignal,
  }: RunOptions = {},
): Promise<RunOutput> {
  const started = Date.now();

  return new Promise((done) => {
    let stdout = "";
    let stderr = "";
    let size = 0;
    let truncated = false;
    let timedOut = false;
    let stopped = false;

    const child = spawn(cmd, args, {
      cwd,
      env: { ...(isolated ? isolatedEnv() : process.env), ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const collect = (stream: "out" | "err") => (chunk: Buffer) => {
      if (truncated) {
        return;
      }
      let text = chunk.toString();
      if (size + text.length > MAX_OUTPUT) {
        text = text.slice(0, MAX_OUTPUT - size) + TRUNCATED;
        truncated = true;
      }
      size += text.length;
      if (stream === "out") {
        stdout += text;
      } else {
        stderr += text;
      }
    };

    child.stdout.on("data", collect("out"));
    child.stderr.on("data", collect("err"));

    let killing = false;
    let killTimer: NodeJS.Timeout | undefined;
    const kill = () => {
      if (killing) {
        return;
      }
      killing = true;
      if (dumpSignal && child.kill(dumpSignal)) {
        killTimer = setTimeout(() => child.kill("SIGKILL"), DUMP_GRACE_MS);
      } else {
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      kill();
    }, timeoutMs);
    const onAbort = () => {
      if (!timedOut) {
        stopped = true;
      }
      kill();
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
    }

    const finish = (exitCode: number | null, error?: Error) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", onAbort);
      done({
        stdout,
        stderr: error ? `${stderr}${error.message}` : stderr,
        exitCode,
        timedOut,
        ...(stopped ? { stopped } : {}),
        durationMs: Date.now() - started,
      });
    };

    child.on("error", (error) => finish(null, error));
    child.on("close", (code) => finish(code));
  });
}

const PYTHON_WRAPPER = `
import runpy, sys
outdir, card = sys.argv[1], sys.argv[2]
sys.argv = [card]

import faulthandler, signal
if hasattr(signal, "SIGUSR1"):
    # The daemon sends SIGUSR1 before killing a card that timed out or was stopped.
    faulthandler.register(signal.SIGUSR1, all_threads=True)

MAX_FIGURES = 8
AZIMUTHS = (-60, 30, 120, 210)

def _title(fig):
    sup = getattr(fig, "_suptitle", None)
    text = sup.get_text() if sup is not None else ""
    for ax in fig.axes:
        if text:
            break
        text = ax.get_title() if hasattr(ax, "get_title") else ""
    return text or None

def _views(fig, axes3d, path):
    import io
    from PIL import Image
    start = [(ax, ax.azim) for ax in axes3d]
    tiles = []
    try:
        for azim in AZIMUTHS:
            for ax in axes3d:
                ax.view_init(elev=ax.elev, azim=azim)
            buf = io.BytesIO()
            fig.savefig(buf, format="png", dpi=110, bbox_inches="tight", facecolor="white")
            buf.seek(0)
            image = Image.open(buf)
            image.load()
            tiles.append(image.convert("RGB"))
    finally:
        for ax, azim in start:
            ax.view_init(elev=ax.elev, azim=azim)
    width = max(1, max(t.width for t in tiles) // 2)
    height = max(1, max(t.height for t in tiles) // 2)
    strip = Image.new("RGB", (width * len(tiles), height), "white")
    for i, tile in enumerate(tiles):
        strip.paste(tile.resize((width, height)), (i * width, 0))
    strip.save(path)

def _save_figures(outdir):
    import json, os
    plt = sys.modules["matplotlib.pyplot"]
    numbers = list(plt.get_fignums())
    if len(numbers) > MAX_FIGURES:
        print(f"only the first {MAX_FIGURES} figures were saved", file=sys.stderr)
    figures = []
    for n in numbers[:MAX_FIGURES]:
        try:
            fig = plt.figure(n)
            name = f"fig-{n}.png"
            fig.savefig(os.path.join(outdir, name), dpi=110, bbox_inches="tight", facecolor="white")
            axes3d = [ax for ax in fig.axes if getattr(ax, "name", None) == "3d"]
            views = None
            if axes3d:
                views = f"fig-{n}-views.png"
                try:
                    _views(fig, axes3d, os.path.join(outdir, views))
                except ImportError:
                    views = None
                    print("3D figures are saved from one angle only: install Pillow for four", file=sys.stderr)
            figures.append({"name": name, "title": _title(fig), "is3d": bool(axes3d), "views": views})
        except Exception as error:
            print(f"could not save figure {n}: {error}", file=sys.stderr)
    with open(os.path.join(outdir, "figures.json"), "w") as f:
        json.dump(figures, f)

try:
    runpy.run_path(card, run_name="__main__")
finally:
    if sys.modules.get("matplotlib.pyplot") is not None:
        try:
            _save_figures(outdir)
        except Exception as error:
            print(f"could not save figures: {error}", file=sys.stderr)
`;

const WRAPPER_FRAME = /^ {2}File "<(string|frozen runpy)>".*\n(?: {4}.*\n)*/gm;

function cleanTraceback(stderr: string, card: string) {
  return stderr.replaceAll(card, "<card>").replace(WRAPPER_FRAME, "");
}

export type RunCommand = { cmd: string; args: string[]; cwd?: string };
export type PythonCommand = RunCommand;

export async function runPython(
  source: string,
  python: PythonCommand,
  options: RunOptions = {},
  toolbox?: string,
): Promise<RunOutput> {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-py-"));
  const card = join(dir, "card.py");
  const { outDir = dir, ...processOptions } = options;

  try {
    await writeFile(card, source);
    if (toolbox) {
      await writeFile(join(dir, "toolbox.py"), toolbox);
    }
    const output = await runProcess(
      python.cmd,
      [...python.args, "-u", "-c", PYTHON_WRAPPER, outDir, card],
      {
        timeoutMs: 600000,
        ...(process.platform === "win32" ? {} : { dumpSignal: "SIGUSR1" }),
        ...processOptions,
        env: {
          PYTHONDONTWRITEBYTECODE: "1",
          MPLBACKEND: "Agg",
          PYTHONWARNINGS: "ignore::SyntaxWarning",
          ...(toolbox ? { PYTHONPATH: dir } : {}),
          ...processOptions.env,
        },
      },
    );

    return { ...output, stderr: cleanTraceback(output.stderr, card) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type LeanReport = {
  diagnostics: LeanDiagnostic[];
  axioms: string[];
  hasSorry: boolean;
  extraAxioms: string[];
};

const STANDARD_AXIOMS = new Set([
  "propext",
  "Classical.choice",
  "Quot.sound",
  "sorryAx",
]);

const DIAGNOSTIC = /^[^:\n]+:(\d+):(\d+): (error|warning|info): (.*)$/;
const AXIOMS = /^'[^']+' depends on axioms: \[(.*)\]$/;
const NO_AXIOMS = /^'[^']+' does not depend on any axioms$/;

export function parseLeanOutput(output: string): LeanReport {
  const diagnostics: LeanDiagnostic[] = [];
  const axioms = new Set<string>();
  let current: LeanDiagnostic | null = null;

  for (const line of output.split("\n")) {
    const diagnostic = line.match(DIAGNOSTIC);
    const axiomList = line.match(AXIOMS);

    if (diagnostic) {
      current = {
        line: Number(diagnostic[1]),
        column: Number(diagnostic[2]),
        severity: diagnostic[3] as LeanDiagnostic["severity"],
        message: diagnostic[4]!,
      };
      diagnostics.push(current);
    } else if (axiomList) {
      current = null;
      for (const name of axiomList[1]!.split(",")) {
        if (name.trim()) {
          axioms.add(name.trim());
        }
      }
    } else if (NO_AXIOMS.test(line)) {
      current = null;
    } else if (current && line.trim()) {
      current.message += `\n${line}`;
    }
  }

  const all = [...axioms];

  return {
    diagnostics,
    axioms: all,
    hasSorry:
      axioms.has("sorryAx") ||
      diagnostics.some((d) => /declaration uses .sorry./.test(d.message)),
    extraAxioms: all.filter((name) => !STANDARD_AXIOMS.has(name)),
  };
}

const TOOLBOX_IMPORT = /(?:^|\s)import\s+Toolbox(?:\s|$)/m;

export const importsToolbox = (source: string) => TOOLBOX_IMPORT.test(source);

export type ToolboxBuild =
  | { ok: true; dir: string }
  | { ok: false; output: RunOutput; report: LeanReport };

const toolboxBuilds = new Map<string, Promise<ToolboxBuild>>();

const readOptional = (path: string) => readFile(path, "utf8").catch(() => "");

/**
 * Compiles the toolbox to `Toolbox.olean` once per source and toolchain, so
 * cards import it instead of re-elaborating it on every check. Builds land in
 * `<leanDir>/toolbox/<hash>`; a finished folder is reused across restarts.
 */
export function buildLeanToolbox(
  toolbox: string,
  leanDir: string,
  options: RunOptions = {},
  lean: RunCommand = { cmd: "lean", args: [] },
): Promise<ToolboxBuild> {
  const cwd = lean.cwd ?? options.cwd;
  const key = Promise.all([
    readOptional(join(cwd ?? ".", "lean-toolchain")),
    readOptional(join(cwd ?? ".", "lake-manifest.json")),
  ]).then(([toolchain, manifest]) =>
    createHash("sha1")
      .update(
        JSON.stringify([
          toolbox,
          lean.cmd,
          lean.args,
          cwd,
          toolchain,
          manifest,
        ]),
      )
      .digest("hex"),
  );

  return key.then((hash) => {
    const pending = toolboxBuilds.get(hash);
    if (pending) {
      return pending;
    }
    const build = compileToolbox(toolbox, join(leanDir, "toolbox", hash), {
      ...options,
      cwd,
      lean,
    });
    toolboxBuilds.set(hash, build);
    // Successes are found on disk next time (which keeps their folder fresh);
    // failures stay cached unless the build never ran or timed out.
    build.then(
      (result) => {
        if (
          result.ok ||
          result.output.timedOut ||
          result.output.exitCode === null
        ) {
          toolboxBuilds.delete(hash);
        }
      },
      () => toolboxBuilds.delete(hash),
    );
    return build;
  });
}

const TOOLBOX_BUILD_TTL = 7 * 24 * 60 * 60 * 1000;

/** Drops toolbox builds no check has used for a week; each canvas has its own. */
async function pruneToolboxBuilds(root: string, keep: string) {
  const cutoff = Date.now() - TOOLBOX_BUILD_TTL;
  const names = await readdir(root).catch(() => [] as string[]);

  await Promise.all(
    names.map(async (name) => {
      const path = join(root, name);
      if (path === keep) {
        return;
      }
      const info = await stat(path).catch(() => null);
      if (info && info.mtimeMs < cutoff) {
        await rm(path, { recursive: true, force: true });
      }
    }),
  );
}

async function compileToolbox(
  toolbox: string,
  dir: string,
  { lean, ...options }: RunOptions & { lean: RunCommand },
): Promise<ToolboxBuild> {
  if (existsSync(join(dir, "Toolbox.olean"))) {
    await utimes(dir, new Date(), new Date()).catch(() => undefined);
    return { ok: true, dir };
  }

  await mkdir(dirname(dir), { recursive: true });
  const tmp = await mkdtemp(`${dir}.tmp-`);

  try {
    const file = join(tmp, "Toolbox.lean");
    await writeFile(file, toolbox);
    const output = await runProcess(
      lean.cmd,
      [...lean.args, `--root=${tmp}`, "-o", join(tmp, "Toolbox.olean"), file],
      { timeoutMs: 1200000, ...options },
    );
    const text = `${output.stdout}\n${output.stderr}`.replaceAll(
      file,
      "<toolbox>",
    );
    const report = parseLeanOutput(text);

    if (
      output.exitCode !== 0 ||
      report.diagnostics.some((d) => d.severity === "error")
    ) {
      return {
        ok: false,
        output: {
          ...output,
          stdout: output.stdout.replaceAll(file, "<toolbox>"),
          stderr: output.stderr.replaceAll(file, "<toolbox>"),
        },
        report: {
          ...report,
          diagnostics: report.diagnostics.length
            ? report.diagnostics.map((d) => ({
                ...d,
                line: 1,
                column: 0,
                message: `[toolbox ${d.line}:${d.column}] ${d.message}`,
              }))
            : [
                {
                  line: 1,
                  column: 0,
                  severity: "error",
                  message: `[toolbox] ${
                    output.timedOut
                      ? "build timed out"
                      : output.stderr.replaceAll(file, "<toolbox>").trim() ||
                        `build exited with ${output.exitCode}`
                  }`,
                },
              ],
        },
      };
    }

    await rename(tmp, dir).catch(async (error) => {
      // Another process finished the same build first; its copy is identical.
      if (!existsSync(join(dir, "Toolbox.olean"))) {
        throw error;
      }
    });
    await pruneToolboxBuilds(dirname(dir), dir);
    return { ok: true, dir };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}

const THEOREM = /^\s*(?:theorem|lemma)\s+([^\s:({[]+)/m;

export async function runLean(
  source: string,
  leanDir: string,
  options: RunOptions = {},
  lean: RunCommand = { cmd: "lean", args: [] },
  toolbox?: string,
): Promise<{ output: RunOutput; report: LeanReport; found: boolean }> {
  const name = source.match(THEOREM)?.[1];
  let env = options.env;

  if (toolbox && importsToolbox(source)) {
    // The build is shared by every card on the canvas, so stopping one card leaves it running.
    const { signal: _signal, ...buildOptions } = options;
    const build = await buildLeanToolbox(toolbox, leanDir, buildOptions, lean);
    if (!build.ok) {
      const found = !(
        build.output.exitCode === null && build.output.stderr.includes("ENOENT")
      );
      return {
        output: found
          ? build.output
          : { ...build.output, stderr: "Lean not found" },
        report: build.report,
        found,
      };
    }
    const inherited = options.env?.LEAN_PATH ?? process.env.LEAN_PATH;
    env = {
      ...options.env,
      LEAN_PATH: inherited ? `${build.dir}${delimiter}${inherited}` : build.dir,
    };
  }

  const hash = createHash("sha1").update(source).digest("hex");
  const file = join(leanDir, `check-${hash}.lean`);

  await mkdir(leanDir, { recursive: true });
  await writeFile(file, name ? `${source}\n\n#print axioms ${name}\n` : source);

  const output = await runProcess(lean.cmd, [...lean.args, file], {
    timeoutMs: 1200000,
    ...options,
    env,
    cwd: lean.cwd ?? options.cwd,
  });
  const found = !(output.exitCode === null && output.stderr.includes("ENOENT"));
  const text = `${output.stdout}\n${output.stderr}`.replaceAll(file, "<card>");

  return {
    output: {
      ...output,
      stdout: output.stdout.replaceAll(file, "<card>"),
      stderr: found
        ? output.stderr.replaceAll(file, "<card>")
        : "Lean not found",
    },
    report: parseLeanOutput(text),
    found,
  };
}
