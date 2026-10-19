import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LeanDiagnostic, RunOutput } from "shared";

export const MAX_OUTPUT = 200 * 1024;
const TRUNCATED = "\n… [output truncated]";

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
      if (stream === "out") stdout += text;
      else stderr += text;
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
runpy.run_path(card, run_name="__main__")
`;

const WRAPPER_FRAME = /^ {2}File "<(string|frozen runpy)>".*\n(?: {4}.*\n)*/gm;

function cleanTraceback(stderr: string, card: string) {
  return stderr.replaceAll(card, "<card>").replace(WRAPPER_FRAME, "");
}

export type PythonCommand = { cmd: string; args: string[] };

export async function runPython(
  source: string,
  python: PythonCommand,
  options: RunOptions = {},
): Promise<RunOutput> {
  const dir = await mkdtemp(join(tmpdir(), "lemmata-py-"));
  const card = join(dir, "card.py");

  try {
    await writeFile(card, source);
    const output = await runProcess(
      python.cmd,
      [...python.args, "-u", "-c", PYTHON_WRAPPER, dir, card],
      {
        timeoutMs: 60_000,
        ...options,
        env: {
          PYTHONDONTWRITEBYTECODE: "1",
          MPLBACKEND: "Agg",
          PYTHONWARNINGS: "ignore::SyntaxWarning",
          ...options.env,
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
        if (name.trim()) axioms.add(name.trim());
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

const THEOREM = /^\s*(?:theorem|lemma)\s+([^\s:({[]+)/m;

export async function runLean(
  source: string,
  leanDir: string,
  options: RunOptions = {},
): Promise<{ output: RunOutput; report: LeanReport; found: boolean }> {
  const name = source.match(THEOREM)?.[1];
  const hash = createHash("sha1").update(source).digest("hex");
  const file = join(leanDir, `check-${hash}.lean`);

  await mkdir(leanDir, { recursive: true });
  await writeFile(file, name ? `${source}\n\n#print axioms ${name}\n` : source);

  const output = await runProcess("lean", [file], {
    timeoutMs: 120_000,
    ...options,
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
