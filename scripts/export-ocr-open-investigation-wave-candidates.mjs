import { readdir } from "node:fs/promises";
import path from "node:path";
import { buildOcrOpenInvestigationCandidates } from "./ocr-open-investigations-lib.mjs";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function readJsonFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => path.join(dir, entry.name));
    return Promise.all(files.map(async (file) => ({ file, data: await readJson(file) })));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

async function usedCandidateIds({ ignoreCandidatePath = "", ignoreWaveId = "" } = {}) {
  const ids = new Set();
  const ignoreResolved = ignoreCandidatePath ? path.resolve(rootDir, ignoreCandidatePath) : "";
  const [candidateFiles, waveFiles] = await Promise.all([
    readJsonFiles(path.join(rootDir, "data", "import-candidates")),
    readJsonFiles(paths.importWavesDir)
  ]);

  for (const { file, data: candidates } of candidateFiles) {
    if (ignoreResolved && path.resolve(file) === ignoreResolved) continue;
    for (const candidate of candidates ?? []) {
      if (candidate?.candidate_id) ids.add(candidate.candidate_id);
    }
  }

  for (const { data: wave } of waveFiles) {
    if (ignoreWaveId && wave?.id === ignoreWaveId) continue;
    for (const candidateId of wave.accepted_candidate_ids ?? []) {
      ids.add(candidateId);
    }
  }

  return ids;
}

const waveId = readArg("--wave-id", "ocr-open-investigations-wave-001");
const discoveryPath = readArg("--discovery", "data/ocr-open-investigations-discovery.json");
const outPath = readArg("--out", `data/import-candidates/${waveId}.json`);
const exclusionsPath = readArg("--exclusions", `data/import-exclusions/${waveId}.json`);
const mappingQuarantinePath = readArg("--mapping-quarantine", `data/import-quarantine/${waveId}-mapping.json`);
const limit = Number.parseInt(readArg("--limit", "1000"), 10);
const offset = Number.parseInt(readArg("--offset", "0"), 10);
const mappedOnly = hasFlag("--mapped-only");
const skipExclusions = hasFlag("--skip-exclusions");
const skipMappingQuarantine = hasFlag("--skip-mapping-quarantine");

if (!waveId || !discoveryPath || !outPath || !exclusionsPath || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0) {
  console.error(
    "Usage: node scripts/export-ocr-open-investigation-wave-candidates.mjs --wave-id <wave-id> --limit <positive integer> --offset <non-negative integer>"
  );
  process.exit(1);
}

const [discovery, schools, priorIds] = await Promise.all([
  readJson(path.resolve(rootDir, discoveryPath)),
  readJson(paths.schools),
  usedCandidateIds({ ignoreCandidatePath: outPath, ignoreWaveId: waveId })
]);

const sourceRows = (discovery.rows ?? []).map((row) => ({
  state: row.state,
  institution: row.institution,
  institution_type: row.institution_type,
  discrimination_type: row.discrimination_type,
  open_investigation_date: row.open_investigation_date,
  source_page_url: row.source_page_url,
  source_locator: row.source_locator
}));

const result = buildOcrOpenInvestigationCandidates({
  rows: sourceRows,
  schools,
  waveId,
  sourcePageUrl: discovery.source_url,
  limit,
  offset,
  usedCandidateIds: priorIds,
  requireKnownSchool: mappedOnly
});

const exclusionArtifact = {
  id: `${waveId}-exclusions`,
  wave_id: waveId,
  source_family: discovery.source_family,
  generated_at: new Date().toISOString().slice(0, 10),
  source_discovery: discoveryPath,
  rows: result.excluded,
  reason_counts: result.excluded.reduce((acc, row) => {
    acc[row.reason_code] = (acc[row.reason_code] ?? 0) + 1;
    return acc;
  }, {}),
  public_claim_limit: "Excluded OCR source rows are preserved for auditability. Exclusion is not a public event record."
};

const mappingQuarantineArtifact = {
  id: `${waveId}-mapping-quarantine`,
  wave_id: waveId,
  source_family: discovery.source_family,
  generated_at: new Date().toISOString().slice(0, 10),
  source_discovery: discoveryPath,
  rows: result.mapping_quarantine,
  reason_counts: result.mapping_quarantine.reduce((acc, row) => {
    for (const reason of row.reason_codes ?? []) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {}),
  public_claim_limit: "Mapping-quarantine rows identify postsecondary OCR source rows blocked before wave QA because institution identity did not resolve to a known school."
};

await Promise.all([
  writeJson(path.resolve(rootDir, outPath), result.candidates),
  skipExclusions ? Promise.resolve() : writeJson(path.resolve(rootDir, exclusionsPath), exclusionArtifact),
  mappedOnly && !skipMappingQuarantine ? writeJson(path.resolve(rootDir, mappingQuarantinePath), mappingQuarantineArtifact) : Promise.resolve()
]);

console.log(
  `Exported ${result.candidates.length} OCR open-investigation candidates to ${outPath}` +
    (skipExclusions ? "" : `; preserved ${result.excluded.length} exclusions in ${exclusionsPath}`) +
    (mappedOnly && !skipMappingQuarantine ? ` and ${result.mapping_quarantine.length} mapping quarantines in ${mappingQuarantinePath}.` : ".")
);
