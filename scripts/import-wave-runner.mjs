import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readJson, rootDir, writeJson } from "./lib.mjs";
import { runImportWave, validateImportWaveArtifacts } from "./import-wave-lib.mjs";

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

const candidatesPath = readArg("--candidates");
const waveId = readArg("--wave-id");
const exclusionsPath = readArg("--exclusions");

if (!candidatesPath || !waveId) {
  console.error("Usage: node scripts/import-wave-runner.mjs --candidates <path> --wave-id <wave-id> [--exclusions <path>]");
  process.exit(1);
}

const fullCandidatesPath = path.resolve(rootDir, candidatesPath);
const [candidates, manifests, schools, existingEvents, snapshotManifest, exclusions] = await Promise.all([
  readJson(fullCandidatesPath),
  readJson(path.join(rootDir, "data", "import-manifests.json")),
  readJson(path.join(rootDir, "data", "schools.json")),
  readJson(path.join(rootDir, "data", "events.json")),
  readJson(path.join(rootDir, "data", "snapshot-manifest.json")),
  exclusionsPath ? readJson(path.resolve(rootDir, exclusionsPath)) : Promise.resolve(null)
]);

const command = compact([
  "node scripts/import-wave-runner.mjs",
  `--candidates ${candidatesPath}`,
  `--wave-id ${waveId}`,
  exclusionsPath ? `--exclusions ${exclusionsPath}` : ""
]).join(" ");
const artifacts = runImportWave({
  waveId,
  candidates,
  manifests,
  schools,
  existingEvents,
  command,
  datasetHashBefore: snapshotManifest.hashes?.full_snapshot ?? "",
  datasetHashAfter: snapshotManifest.hashes?.full_snapshot ?? "",
  excludedCount: Array.isArray(exclusions?.rows) ? exclusions.rows.length : 0,
  exclusionArtifact: exclusionsPath
});
const errors = validateImportWaveArtifacts(artifacts);

if (errors.length) {
  console.error(`Import wave ${waveId} failed artifact validation:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  process.exit(1);
}

const wavesDir = path.join(rootDir, "data", "import-waves");
const quarantineDir = path.join(rootDir, "data", "import-quarantine");
await mkdir(wavesDir, { recursive: true });
await mkdir(quarantineDir, { recursive: true });
await writeJson(path.join(wavesDir, `${waveId}.json`), artifacts.wave);
await writeJson(path.join(quarantineDir, `${waveId}.json`), artifacts.quarantine);

console.log(
  `Import wave ${waveId}: ${artifacts.wave.accepted_count} accepted, ${artifacts.wave.quarantined_count} quarantined, status ${artifacts.wave.status}.`
);
