import path from "node:path";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";
import { buildEdDatasetProvenanceAudit, validateEdDatasetProvenanceAudit } from "./ed-dataset-provenance-lib.mjs";

const packagePaths = {
  2024: process.env.ED_CAMPUS_SAFETY_2024_ZIP || process.argv[2] || "/tmp/cel-range-2024.bin",
  2025: process.env.ED_CAMPUS_SAFETY_2025_ZIP || process.argv[3] || "/tmp/cel-range-2025.bin"
};

const [events, manifest, sourceVerification] = await Promise.all([
  readJson(paths.events),
  readJson(paths.manifest),
  readJson(path.join(rootDir, "data", "canonical-expansion-source-verification.json")).catch(() => null)
]);

const audit = buildEdDatasetProvenanceAudit({
  events,
  manifest,
  packagePaths,
  sourceVerification
});

const errors = validateEdDatasetProvenanceAudit({ audit, events, manifest });
if (errors.length) {
  throw new Error(`ED dataset provenance audit validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.edDatasetProvenanceAudit, audit);

console.log(
  `Generated ED dataset provenance audit: ${audit.totals.records} records, ${audit.totals.matched} matched, ${audit.totals.unmatched} unmatched, ${audit.totals.workbooks} workbooks.`
);
