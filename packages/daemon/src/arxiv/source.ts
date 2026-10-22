import { gunzipSync } from "node:zlib";
import { parseTar } from "nanotar";

export type SourceFile = { name: string; data: Uint8Array };

const SINGLE_FILE = "main.tex";

const isTar = (bytes: Uint8Array) =>
  bytes.length >= 512 &&
  new TextDecoder().decode(bytes.subarray(257, 262)) === "ustar";

export function unpackSource(gzipped: Uint8Array): SourceFile[] {
  const bytes = new Uint8Array(gunzipSync(gzipped));

  if (!isTar(bytes)) {
    return [{ name: SINGLE_FILE, data: bytes }];
  }

  return parseTar(bytes, { filter: (entry) => entry.type === "file" }).map(
    ({ name, data }) => ({ name, data: data ?? new Uint8Array() }),
  );
}
