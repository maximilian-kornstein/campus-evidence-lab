import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import {
  ED_CAMPUS_SAFETY_2025_ZIP_URL,
  ED_CAMPUS_SAFETY_SOURCE_FAMILY,
  buildEdCampusSafetyAggregateCandidates,
  edCampusSafetyAggregateRowsFromSheet
} from "./ed-campus-safety-aggregate-lib.mjs";
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

async function ensureZip(zipPath) {
  if (existsSync(zipPath)) return;
  mkdirSync(path.dirname(zipPath), { recursive: true });
  const response = await fetch(ED_CAMPUS_SAFETY_2025_ZIP_URL);
  if (!response.ok) throw new Error(`Could not download ${ED_CAMPUS_SAFETY_2025_ZIP_URL}: HTTP ${response.status}`);
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
}

function zipEntries(zipPath) {
  return execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function workbookRowsFromZip(zipPath, entry) {
  const buffer = execFileSync("unzip", ["-p", zipPath, entry], { maxBuffer: 240 * 1024 * 1024 });
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "" });
}

function sourceRowsFromZip(zipPath) {
  const entries = zipEntries(zipPath).filter((entry) =>
    /^(Noncampus|Oncampus|Publicproperty|Residencehall)vawa222324\.xls$/i.test(path.basename(entry))
  );
  return entries.flatMap((entry) =>
    edCampusSafetyAggregateRowsFromSheet({
      workbookName: path.basename(entry),
      sheetRows: workbookRowsFromZip(zipPath, entry)
    })
  );
}

const waveId = readArg("--wave-id", "ed-campus-safety-vawa-wave-001");
const zipPath = readArg("--zip", "/tmp/campus-evidence-sources/Crime2025EXCEL.zip");
const outPath = readArg("--out", `data/import-candidates/${waveId}.json`);
const mappingQuarantinePath = readArg("--mapping-quarantine", `data/import-quarantine/${waveId}-mapping.json`);
const limit = Number.parseInt(readArg("--limit", "1000"), 10);
const offset = Number.parseInt(readArg("--offset", "0"), 10);
const writeMappingQuarantine = hasFlag("--write-mapping-quarantine");

if (!waveId || !zipPath || !outPath || !Number.isInteger(limit) || limit <= 0 || !Number.isInteger(offset) || offset < 0) {
  console.error(
    "Usage: node scripts/export-ed-campus-safety-aggregate-wave-candidates.mjs --wave-id <wave-id> --limit <positive integer> [--write-mapping-quarantine]"
  );
  process.exit(1);
}

await ensureZip(zipPath);

const [schools, priorIds] = await Promise.all([
  readJson(paths.schools),
  usedCandidateIds({ ignoreCandidatePath: outPath, ignoreWaveId: waveId })
]);

const sourceRows = sourceRowsFromZip(zipPath);
const result = buildEdCampusSafetyAggregateCandidates({
  waveId,
  sourceRows,
  schools,
  limit,
  offset,
  usedCandidateIds: priorIds
});

const mappingQuarantineArtifact = {
  id: `${waveId}-mapping-quarantine`,
  wave_id: waveId,
  source_family: ED_CAMPUS_SAFETY_SOURCE_FAMILY,
  generated_at: new Date().toISOString().slice(0, 10),
  source_url: ED_CAMPUS_SAFETY_2025_ZIP_URL,
  rows: result.mappingQuarantine,
  reason_counts: result.mappingQuarantine.reduce((acc, row) => {
    for (const reason of row.reason_codes ?? []) acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {}),
  public_claim_limit:
    "Mapping-quarantine rows identify ED aggregate source rows blocked before wave QA because institution identity did not resolve to a known school."
};

await Promise.all([
  writeJson(path.resolve(rootDir, outPath), result.candidates),
  writeMappingQuarantine ? writeJson(path.resolve(rootDir, mappingQuarantinePath), mappingQuarantineArtifact) : Promise.resolve()
]);

console.log(
  `Exported ${result.candidates.length} ED Campus Safety aggregate candidates to ${outPath}` +
    (writeMappingQuarantine ? ` and preserved ${result.mappingQuarantine.length} mapping quarantines in ${mappingQuarantinePath}.` : ".")
);
