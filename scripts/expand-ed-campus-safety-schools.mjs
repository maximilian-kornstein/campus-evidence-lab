import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import {
  ED_CAMPUS_SAFETY_PROFILES,
  buildEdCampusSafetySchoolsFromSourceRows,
  edCampusSafetyAggregateRowsFromSheet
} from "./ed-campus-safety-aggregate-lib.mjs";
import { paths, readJson, writeJson } from "./lib.mjs";

function readArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

async function ensureZip(zipPath, sourceUrl) {
  if (existsSync(zipPath)) return;
  mkdirSync(path.dirname(zipPath), { recursive: true });
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Could not download ${sourceUrl}: HTTP ${response.status}`);
  writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()));
}

function zipPathForProfile(profile) {
  const zipName = profile.source_url.match(/fileName=([^&]+)/)?.[1] ?? `${profile.id}.zip`;
  return path.join("/tmp", "campus-evidence-sources", zipName);
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

function sourceRowsFromZip(zipPath, profileId) {
  const profile = ED_CAMPUS_SAFETY_PROFILES[profileId];
  return zipEntries(zipPath)
    .filter((entry) => profile.workbook_pattern.test(path.basename(entry)))
    .flatMap((entry) =>
      edCampusSafetyAggregateRowsFromSheet({
        profileId,
        workbookName: path.basename(entry),
        sheetRows: workbookRowsFromZip(zipPath, entry)
      })
    );
}

const profileIds = readArg("--profiles", "ed_vawa_2025,ed_sex_offense_crime_2025,ed_vawa_2021")
  .split(",")
  .map((profileId) => profileId.trim())
  .filter(Boolean);

for (const profileId of profileIds) {
  if (!ED_CAMPUS_SAFETY_PROFILES[profileId]) {
    console.error(`Unknown profile ${profileId}. Expected one of: ${Object.keys(ED_CAMPUS_SAFETY_PROFILES).join(", ")}`);
    process.exit(1);
  }
}

let sourceRows = [];
for (const profileId of profileIds) {
  const profile = ED_CAMPUS_SAFETY_PROFILES[profileId];
  const zipPath = zipPathForProfile(profile);
  await ensureZip(zipPath, profile.source_url);
  sourceRows = sourceRows.concat(sourceRowsFromZip(zipPath, profileId));
}

const schools = await readJson(paths.schools);
const result = buildEdCampusSafetySchoolsFromSourceRows({ schools, sourceRows });
await writeJson(paths.schools, result.schools);

console.log(
  `Expanded ED Campus Safety school identities from ${sourceRows.length} source rows: ${result.added_count} added, ${result.schools.length} total schools.`
);
