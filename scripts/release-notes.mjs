// Prints the CHANGELOG.md section of a version: node scripts/release-notes.mjs 0.2.0
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2]?.replace(/^v/, "");

if (!version) {
  console.error("Usage: node scripts/release-notes.mjs <version>");
  process.exit(1);
}

const lines = readFileSync(join(root, "CHANGELOG.md"), "utf8").split("\n");
const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));

if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}.`);
  process.exit(1);
}

const rest = lines.slice(start + 1);
const end = rest.findIndex((line) => /^(## |\[[^\]]+\]: )/.test(line));
const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();

if (!body) {
  console.error(`The ${version} section of CHANGELOG.md is empty.`);
  process.exit(1);
}

console.log(body);
