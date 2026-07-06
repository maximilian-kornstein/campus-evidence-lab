import { readdir } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";
import { buildEdCampusSafetyWaveCandidates } from "./ed-campus-safety-candidate-export-lib.mjs";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function readJsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => path.join(dir, entry.name));
    return Promise.all(files.map((file) => readJson(file)));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function usedCandidateIds() {
  const ids = new Set();
  const [candidateFiles, waveFiles] = await Promise.all([
    readJsonFiles(path.join(rootDir, "data", "import-candidates")),
    readJsonFiles(paths.importWavesDir)
  ]);

  for (const candidates of candidateFiles) {
    for (const candidate of candidates ?? []) {
      if (candidate?.candidate_id) ids.add(candidate.candidate_id);
    }
  }

  for (const wave of waveFiles) {
    for (const candidateId of wave.accepted_candidate_ids ?? []) {
      ids.add(candidateId);
    }
  }

  return ids;
}

const waveId = readArg("--wave-id", "ed-campus-safety-wave-002");
const outPath = readArg("--out", `data/import-candidates/${waveId}.json`);
const limit = Number.parseInt(readArg("--limit", "250"), 10);

if (!waveId || !outPath || !Number.isInteger(limit) || limit <= 0) {
  console.error(
    "Usage: node scripts/export-ed-campus-safety-wave-candidates.mjs --wave-id <wave-id> --limit <positive integer> --out <path>"
  );
  process.exit(1);
}

const [events, schools, sources, edDatasetProvenanceAudit, priorIds] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.edDatasetProvenanceAudit),
  usedCandidateIds()
]);

const candidates = buildEdCampusSafetyWaveCandidates({
  waveId,
  limit,
  events,
  schools,
  sources,
  edDatasetProvenanceAudit,
  usedCandidateIds: priorIds
});

await writeJson(path.resolve(rootDir, outPath), candidates);
console.log(`Exported ${candidates.length} ED Campus Safety candidates to ${outPath}.`);
