// Downloads the plugin and plugin base files listed in index.json and checks each against its sha256.
import { createHash } from "node:crypto";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const [sourceArg, indexPath, outputDir] = process.argv.slice(2);
if (!sourceArg || !indexPath || !outputDir) {
  console.error("Usage: node fetch-plugin-snapshot.mjs <source-url> <index.json> <output-dir>");
  process.exit(2);
}

const source = sourceArg.endsWith("/") ? sourceArg : `${sourceArg}/`;
const pluginIdPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const fail = (message) => {
  console.error(`Plugin snapshot: ${message}`);
  process.exit(1);
};

let index;
try {
  index = JSON.parse(readFileSync(indexPath, "utf8"));
} catch (error) {
  fail(`index.json is not valid JSON: ${error.message}`);
}
if (!Array.isArray(index?.plugins)) fail("index.json has no 'plugins' array.");
if (index.bases !== undefined && !Array.isArray(index.bases)) fail("index.json 'bases' is not an array.");

const entries = [
  ...(index.bases ?? []).map((entry) => ({ kind: "base", entry })),
  ...index.plugins.map((entry) => ({ kind: "plugin", entry })),
];
for (const { kind, entry } of entries) {
  const { id, path: filePath, sha256 } = entry ?? {};
  if (typeof id !== "string" || !pluginIdPattern.test(id)) fail(`invalid ${kind} id ${JSON.stringify(id)}.`);
  if (typeof filePath !== "string" || !filePath.endsWith(".yaml") || path.posix.isAbsolute(filePath)
      || filePath.split("/").some((segment) => segment === "" || segment.startsWith(".")))
    fail(`${kind} ${id} has an invalid path ${JSON.stringify(filePath)}.`);
  if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) fail(`${kind} ${id} has an invalid sha256.`);

  const url = new URL(filePath, source);
  const response = await fetch(url);
  if (!response.ok) fail(`GET ${url} returned ${response.status}.`);
  const content = Buffer.from(await response.arrayBuffer());
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual !== sha256) fail(`${filePath} has sha256 ${actual}, but index.json lists ${sha256}.`);

  const target = path.join(outputDir, ...filePath.split("/"));
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content);
  console.log(`Plugin snapshot: ${kind} ${id} ${entry.version} ok`);
}

await mkdir(outputDir, { recursive: true });
await copyFile(indexPath, path.join(outputDir, "index.json"));
console.log(`Plugin snapshot: ${index.plugins.length} plugin(s) and ${(index.bases ?? []).length} base(s) from ${source}`);
