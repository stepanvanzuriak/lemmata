import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
};

export function runProcess(
  cmd: string,
  args: string[],
  { cwd, timeoutMs = 60_000, env = {}, isolated = false }: RunOptions = {},
): Promise<RunOutput> {
  const started = Date.now();

  return new Promise((done) => {
    let stdout = "";
    let stderr = "";
    let size = 0;
    let truncated = false;
    let timedOut = false;

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

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    const finish = (exitCode: number | null, error?: Error) => {
      clearTimeout(timer);
      done({
        stdout,
        stderr: error ? `${stderr}${error.message}` : stderr,
        exitCode,
        timedOut,
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

const LEAN_IMPORT = /^import\s+\S+(?:\s+import\s+\S+)*\s*$/;
const TOOLBOX_IMPORT = /^import\s+Toolbox\s*$/m;

/**
 * Lean has no local modules here, so `import Toolbox` inlines the toolbox's
 * source ahead of the card. Imports are hoisted to line 1 and the card's own
 * import lines are blanked, which keeps the card's lines at a fixed offset.
 */
export function inlineLeanToolbox(source: string, toolbox: string) {
  if (!TOOLBOX_IMPORT.test(source)) {
    return { source, offset: 0 };
  }

  const imports = new Set<string>();
  const body: string[] = [];

  for (const line of toolbox.split("\n")) {
    if (LEAN_IMPORT.test(line.trim())) {
      imports.add(line.trim().replace(/\s+/g, " "));
    } else {
      body.push(line);
    }
  }

  const card = source.split("\n").map((line) => {
    if (!LEAN_IMPORT.test(line.trim())) {
      return line;
    }
    for (const part of line.trim().split(/\s+/).slice(1)) {
      if (part !== "Toolbox" && part !== "import") {
        imports.add(`import ${part}`);
      }
    }
    return "";
  });
  const head = [...imports].join(" ").replace(/ import import /g, " import ");

  return {
    source: [head, ...body, ...card].join("\n"),
    offset: body.length + 1,
  };
}

/** Maps diagnostics back to card lines; those inside the inlined toolbox are tagged. */
function shiftReport(report: LeanReport, offset: number): LeanReport {
  if (!offset) {
    return report;
  }

  return {
    ...report,
    diagnostics: report.diagnostics.map((d) =>
      d.line > offset
        ? { ...d, line: d.line - offset }
        : { ...d, line: 1, message: `[toolbox] ${d.message}` },
    ),
  };
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
  const inlined = toolbox
    ? inlineLeanToolbox(source, toolbox)
    : { source, offset: 0 };
  const hash = createHash("sha1").update(inlined.source).digest("hex");
  const file = join(leanDir, `check-${hash}.lean`);

  await mkdir(leanDir, { recursive: true });
  await writeFile(
    file,
    name ? `${inlined.source}\n\n#print axioms ${name}\n` : inlined.source,
  );

  const output = await runProcess(lean.cmd, [...lean.args, file], {
    timeoutMs: 1200000,
    ...options,
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
    report: shiftReport(parseLeanOutput(text), inlined.offset),
    found,
  };
}
