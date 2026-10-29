import { execFile } from "node:child_process";
import type { Toolchain } from "shared";
import { pythonCommand } from "../toolchain.js";

export type PythonEntry = {
  name: string;
  kind: "module" | "class" | "function" | "method";
  file: string;
  line: number;
  signature: string;
  doc: string;
};

export const DEFAULT_LIBS = [
  "numpy",
  "sympy",
  "matplotlib",
  "manim",
  "math",
  "cmath",
  "fractions",
  "decimal",
  "itertools",
  "functools",
  "collections",
  "statistics",
  "random",
  "heapq",
  "bisect",
  "operator",
];

// Static scan: reads source and stub files without importing anything, so a
// large library is searched in full and no module code runs.
const INDEX_SCRIPT = `
import ast, importlib.util, json, os, sys

libs = sys.argv[1:]
out = []

def sig(args, returns):
    try:
        text = "(" + ast.unparse(args) + ")"
        if returns is not None:
            text += " -> " + ast.unparse(returns)
        return text[:300]
    except Exception:
        return "(...)"

def first_doc(node):
    doc = ast.get_docstring(node)
    if not doc:
        return ""
    return " ".join(doc.split())[:400]

def scan(path, module):
    try:
        with open(path, encoding="utf-8") as f:
            tree = ast.parse(f.read())
    except Exception:
        return
    out.append(dict(name=module, kind="module", file=path, line=1, signature="", doc=first_doc(tree)))
    def walk(body, prefix, in_class):
        for node in body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                out.append(dict(name=prefix + "." + node.name, kind="method" if in_class else "function",
                    file=path, line=node.lineno, signature=sig(node.args, node.returns), doc=first_doc(node)))
            elif isinstance(node, ast.ClassDef):
                bases = ", ".join(ast.unparse(b) for b in node.bases)
                out.append(dict(name=prefix + "." + node.name, kind="class", file=path, line=node.lineno,
                    signature="(" + bases + ")", doc=first_doc(node)))
                walk(node.body, prefix + "." + node.name, True)
    walk(tree.body, module, False)

for lib in libs:
    try:
        spec = importlib.util.find_spec(lib)
    except Exception:
        spec = None
    if spec is None:
        continue
    if spec.submodule_search_locations:
        root = list(spec.submodule_search_locations)[0]
        for dirpath, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if d not in ("tests", "test", "__pycache__", "testing")]
            for name in sorted(files):
                if not name.endswith((".py", ".pyi")):
                    continue
                rel = os.path.relpath(os.path.join(dirpath, name), root)[: -len(".pyi" if name.endswith("i") else ".py")]
                parts = [p for p in rel.split(os.sep) if p != "__init__"]
                scan(os.path.join(dirpath, name), ".".join([lib] + parts))
    elif spec.origin and spec.origin.endswith(".py"):
        scan(spec.origin, lib)

json.dump(out, sys.stdout)
`;

const DOC_SCRIPT = `
import importlib, inspect, io, sys, contextlib

name = sys.argv[1]
parts = name.split(".")
obj = None
for i in range(len(parts), 0, -1):
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            obj = importlib.import_module(".".join(parts[:i]))
        for attr in parts[i:]:
            obj = getattr(obj, attr)
        break
    except Exception as error:
        last = error
        obj = None
if obj is None:
    print("Cannot import " + name + ": " + repr(last))
    sys.exit(1)
try:
    signature = str(inspect.signature(obj))
except Exception:
    signature = "(signature unavailable)"
print(name + signature)
print()
print(inspect.getdoc(obj) or "(no docstring)")
`;

function run(
  toolchain: Toolchain,
  script: string,
  args: string[],
  max: number,
) {
  const { cmd, args: base } = pythonCommand(toolchain);

  return new Promise<string>((done, fail) => {
    execFile(
      cmd,
      [...base, "-c", script, ...args],
      { timeout: 10 * 60_000, maxBuffer: max },
      (error, stdout, stderr) =>
        error && !stdout
          ? fail(new Error(stderr || error.message))
          : done(stdout),
    );
  });
}

// One scan per library set; callers asking for the same set share it.
const cached = new Map<string, Promise<PythonEntry[]>>();

export function pythonIndex(toolchain: Toolchain, libs: string[]) {
  const key = [...libs].sort().join(",");
  let entries = cached.get(key);

  if (!entries) {
    entries = run(toolchain, INDEX_SCRIPT, libs, 512 * 1024 * 1024).then(
      (out) => JSON.parse(out) as PythonEntry[],
    );
    cached.set(key, entries);
    entries.catch(() => cached.delete(key));
  }
  return entries;
}

/** The live signature and full docstring, from the importable object. */
export const pythonDoc = (toolchain: Toolchain, name: string) =>
  run(toolchain, DOC_SCRIPT, [name], 8 * 1024 * 1024);

const words = (text: string) =>
  text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

export function searchPython(entries: PythonEntry[], query: string) {
  const wanted = words(query);
  const exact = query.trim().toLowerCase();

  if (wanted.length === 0) {
    return [];
  }

  const best = new Map<string, PythonEntry & { score: number }>();

  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    const nameWords = new Set(words(entry.name));
    const rest = `${entry.signature} ${entry.doc}`.toLowerCase();
    let score = 0;

    const matched = wanted.every((word) => {
      if (nameWords.has(word)) {
        score += 10;
      } else if (name.includes(word)) {
        score += 6;
      } else if (rest.includes(word)) {
        score += 3;
      } else {
        return false;
      }
      return true;
    });

    if (!matched) {
      continue;
    }
    if (name === exact) {
      score += 100;
    } else if (name.endsWith(`.${exact}`)) {
      score += 50;
    }
    // Private modules and names rank below the public API.
    if (/(^|\.)_[^_]/.test(entry.name)) {
      score -= 8;
    }
    const known = best.get(entry.name);

    if (!known || (!known.doc && entry.doc)) {
      best.set(entry.name, { ...entry, score });
    }
  }
  return [...best.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.name.length - b.name.length ||
      a.name.localeCompare(b.name),
  );
}
