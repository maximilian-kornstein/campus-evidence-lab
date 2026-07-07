import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { buildApiV1Payloads, validateApiV1Payloads } from "./api-v1-lib.mjs";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";

async function readImportWaves() {
  const files = (await readdir(paths.importWavesDir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map((file) => readJson(path.join(paths.importWavesDir, file))));
}

async function writeApiJson(relativePath, value) {
  await writeJson(path.join(paths.apiV1Dir, relativePath), value);
  await writeJson(path.join(rootDir, "api", "v1", relativePath), value);
}

const [manifest, schools, events, sources, importWaves, accountabilitySignals] = await Promise.all([
  readJson(paths.manifest),
  readJson(paths.schools),
  readJson(paths.events),
  readJson(paths.sources),
  readImportWaves(),
  readJson(paths.accountabilitySignals)
]);

const payloads = buildApiV1Payloads({
  manifest,
  schools,
  events,
  sources,
  importWaves,
  accountabilitySignals
});

const errors = validateApiV1Payloads(payloads);
if (errors.length) {
  throw new Error(`API v1 validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await rm(paths.apiV1Dir, { recursive: true, force: true });
await rm(path.join(rootDir, "api", "v1"), { recursive: true, force: true });
await mkdir(paths.apiV1Dir, { recursive: true });
await mkdir(path.join(rootDir, "api", "v1"), { recursive: true });

await writeApiJson("index.json", payloads.index);
await writeApiJson("snapshot.json", payloads.snapshot);
await writeApiJson("source-families.json", payloads.sourceFamilies);
await writeApiJson("import-waves.json", payloads.importWaves);
await writeApiJson(path.join("institutions", "index.json"), payloads.institutionsIndex);

for (const [schoolId, detail] of payloads.institutionDetails.entries()) {
  await writeApiJson(path.join("institutions", `${schoolId}.json`), detail);
}

for (const [schoolId, packet] of payloads.citationPackets.entries()) {
  await writeApiJson(path.join("citation-packets", `${schoolId}.json`), packet);
}

console.log(
  `Generated API v1: ${payloads.institutionDetails.size} institution endpoints, ${payloads.citationPackets.size} citation packets, ${payloads.importWaves.import_waves.length} import waves.`
);
