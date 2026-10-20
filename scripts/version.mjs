// Keeps every place that carries the app version in step.
//   node scripts/version.mjs                 check that all versions agree
//   node scripts/version.mjs check v0.2.0    check they equal 0.2.0 (a tag works too)
//   node scripts/version.mjs set 0.2.0       write 0.2.0 everywhere
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauri = "apps/desktop/src-tauri";

const json = (file) => ({
  file,
  read: (text) => JSON.parse(text).version,
  write: (text, version) =>
    text.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`),
});

/** Every file with a version, and how to read and rewrite it. */
const targets = [
  json("package.json"),
  json("apps/desktop/package.json"),
  json("apps/site/package.json"),
  json(`${tauri}/tauri.conf.json`),
  {
    file: `${tauri}/Cargo.toml`,
    read: (text) => text.match(/^version = "([^"]+)"/m)?.[1],
    write: (text, version) =>
      text.replace(/^(version = ")[^"]+(")/m, `$1${version}$2`),
  },
  {
    file: `${tauri}/Cargo.lock`,
    read: (text) =>
      text.match(/name = "lemmata-desktop"\nversion = "([^"]+)"/)?.[1],
    write: (text, version) =>
      text.replace(
        /(name = "lemmata-desktop"\nversion = ")[^"]+(")/,
        `$1${version}$2`,
      ),
  },
];

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const [command = "check", argument] = process.argv.slice(2);
const wanted = argument?.replace(/^v/, "");

const read = ({ file, read }) => read(readFileSync(join(root, file), "utf8"));

if (command === "set") {
  if (!wanted || !SEMVER.test(wanted)) {
    console.error("Usage: node scripts/version.mjs set <x.y.z>");
    process.exit(1);
  }
  for (const target of targets) {
    const path = join(root, target.file);
    writeFileSync(path, target.write(readFileSync(path, "utf8"), wanted));
  }
  console.log(`Set ${wanted} in ${targets.length} files.`);
} else if (command === "check") {
  const found = targets.map((target) => [target.file, read(target)]);
  const expected = wanted ?? found[0][1];
  const wrong = found.filter(([, version]) => version !== expected);

  if (wanted && !SEMVER.test(wanted)) {
    console.error(`"${argument}" is not a version.`);
    process.exit(1);
  }
  for (const [file, version] of wrong) {
    console.error(`${file} is ${version ?? "missing"}, expected ${expected}`);
  }
  if (wrong.length > 0) {
    process.exit(1);
  }
  console.log(`All versions are ${expected}.`);
} else {
  console.error(`Unknown command "${command}".`);
  process.exit(1);
}
