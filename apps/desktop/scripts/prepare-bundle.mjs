// Builds everything the Tauri app ships: the web app, the daemon as one file, the native
// database driver, the migrations and a Node binary to run it all.
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(desktop, "../..");
const tauri = join(desktop, "src-tauri");
const resources = join(tauri, "resources");
const daemon = join(resources, "daemon");
const windows = process.platform === "win32";

/** Packages that cannot be bundled (native code); copied with their dependencies. */
const NATIVE = ["@libsql/client"];

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", cwd: root, ...options });

const hostTuple = execFileSync("rustc", ["--print", "host-tuple"], {
  encoding: "utf8",
}).trim();

console.log("Cleaning…");
rmSync(resources, { recursive: true, force: true });
rmSync(join(tauri, "binaries"), { recursive: true, force: true });
mkdirSync(join(daemon, "dist"), { recursive: true });
mkdirSync(join(tauri, "binaries"), { recursive: true });

console.log("Building the web app…");
run("yarn", ["workspace", "web", "build"], { shell: windows });
cpSync(join(root, "apps/web/dist"), join(resources, "web"), {
  recursive: true,
});

console.log("Bundling the daemon…");
const bundle = await rolldown({
  input: join(root, "packages/daemon/src/cli.ts"),
  platform: "node",
  external: [/^node:/, ...NATIVE, ...NATIVE.map((name) => `${name}/`)].map(
    (entry) => (typeof entry === "string" ? new RegExp(`^${entry}`) : entry),
  ),
});
await bundle.write({
  file: join(daemon, "dist/daemon.mjs"),
  format: "esm",
  codeSplitting: false,
});
await bundle.close();

cpSync(join(root, "packages/core/migrations"), join(daemon, "migrations"), {
  recursive: true,
});

const musl =
  process.platform === "linux" &&
  !process.report.getReport().header.glibcVersionRuntime;

/** Whether a package applies to this machine (`os`/`cpu` fields, `-gnu`/`-musl` suffixes). */
function fitsHost(name, { os, cpu }) {
  if (name.startsWith("@types/")) {
    return false;
  }
  if (name.endsWith("-musl") !== musl && /-(gnu|musl)$/.test(name)) {
    return false;
  }
  return (
    (!os || os.includes(process.platform)) &&
    (!cpu || cpu.includes(process.arch))
  );
}

console.log("Copying the native database driver…");
const copied = new Set();

function copyPackage(name) {
  const source = join(root, "node_modules", name);

  if (copied.has(name) || !existsSync(source)) {
    return;
  }
  const manifest = JSON.parse(readFileSync(join(source, "package.json")));

  if (!fitsHost(name, manifest)) {
    return;
  }
  copied.add(name);
  cpSync(source, join(daemon, "node_modules", name), { recursive: true });

  for (const dependency of Object.keys({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
  })) {
    copyPackage(dependency);
  }
}
NATIVE.forEach(copyPackage);

console.log("Copying Node…");
const node = join(
  tauri,
  "binaries",
  `lemmata-node-${hostTuple}${windows ? ".exe" : ""}`,
);
copyFileSync(process.execPath, node);
chmodSync(node, 0o755);

console.log(`Bundle ready for ${hostTuple}.`);
