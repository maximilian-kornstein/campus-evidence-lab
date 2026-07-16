import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import XLSX from "xlsx";
import { CANONICAL_EXPANSION_DATE, CANONICAL_EXPANSION_ID, parseAggregateLocator } from "./canonical-expansion-lib.mjs";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";

const zipPath = process.argv[2] ?? process.env.CEL_CRIME_2025_ZIP;
if (!zipPath) throw new Error("Usage: node scripts/verify-canonical-10k-source.mjs /path/to/Crime2025EXCEL.zip");
const zipBytes = await readFile(zipPath);
const zipHash = createHash("sha256").update(zipBytes).digest("hex");
execFileSync("unzip", ["-tq", zipPath], { stdio: "pipe" });

const events = (await readJson(paths.events)).filter((event) => event.expansion_id === CANONICAL_EXPANSION_ID);
const byWorkbook = new Map();
for (const event of events) {
  const workbook = event.source_locators[0].workbook;
  if (!byWorkbook.has(workbook)) byWorkbook.set(workbook, []);
  byWorkbook.get(workbook).push(event);
}
const errors = [];
const workbookResults = [];
const normalizeSpace = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
for (const [workbookName, records] of [...byWorkbook].sort(([left], [right]) => left.localeCompare(right))) {
  const bytes = execFileSync("unzip", ["-p", zipPath, workbookName], { maxBuffer: 256 * 1024 * 1024 });
  const workbook = XLSX.read(bytes, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, raw: true });
  const headers = rows[0].map((value) => String(value ?? "").trim());
  const institutionColumn = headers.indexOf("INSTNM");
  let matched = 0;
  for (const event of records) {
    const locator = parseAggregateLocator(event.source_locators[0].locator);
    const value = Number(sheet[locator.cell]?.v);
    const row = rows[locator.row - 1] ?? [];
    const headerIndex = headers.indexOf(locator.column);
    if (workbook.SheetNames[0] !== locator.sheet) errors.push(`${event.id}: sheet mismatch`);
    if (headerIndex < 0) errors.push(`${event.id}: semantic column ${locator.column} is absent`);
    if (headers[headerIndex] !== locator.column) errors.push(`${event.id}: semantic header mismatch`);
    if (normalizeSpace(row[institutionColumn]) !== normalizeSpace(locator.institution)) errors.push(`${event.id}: institution row mismatch`);
    if (value !== event.aggregate_value) errors.push(`${event.id}: source value ${value} does not match ${event.aggregate_value}`);
    if (event.aggregate_calculation?.source_cell !== locator.cell) errors.push(`${event.id}: calculation cell mismatch`);
    if (!errors.some((error) => error.startsWith(`${event.id}:`))) matched += 1;
  }
  workbookResults.push({ workbook: workbookName, sheet: workbook.SheetNames[0], checked_records: records.length, exact_matches: matched });
}
if (errors.length) throw new Error(`Official source verification failed (${errors.length} mismatches):\n- ${errors.slice(0, 100).join("\n- ")}`);
const receipt = {
  expansion_id: CANONICAL_EXPANSION_ID,
  verified_at: CANONICAL_EXPANSION_DATE,
  source_file: path.basename(zipPath),
  source_sha256: `sha256:${zipHash}`,
  archive_integrity: "passed",
  checked_records: events.length,
  exact_cell_matches: events.length,
  mismatches: 0,
  checks: ["workbook entry", "sheet identity", "institution row", "semantic column header", "exact cell address", "exact numeric value"],
  claim_boundary: "This receipt proves exact transcription from the identified official workbook cells. It does not certify underlying institutional reporting, incident prevalence, comparative safety, or institutional conduct.",
  workbooks: workbookResults
};
await writeJson(path.join(rootDir, "data", "canonical-expansion-source-verification.json"), receipt);
const manifestPath = path.join(rootDir, "data", "canonical-expansion-10k.json");
const manifest = await readJson(manifestPath);
manifest.source_verification_status = "passed_exact_cell_verification";
manifest.source_verification_receipt = "data/canonical-expansion-source-verification.json";
manifest.source_sha256 = receipt.source_sha256;
await writeJson(manifestPath, manifest);
console.log(JSON.stringify(receipt, null, 2));
