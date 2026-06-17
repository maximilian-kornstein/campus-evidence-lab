import { paths, readJson, writeJson } from "./lib.mjs";
import { buildCertificationBatches, validateCertificationBatches } from "./certification-batches-lib.mjs";

const certificationLedger = await readJson(paths.certificationLedger);
const batches = buildCertificationBatches({ certificationLedger, batchSize: 250 });
const errors = validateCertificationBatches({ batches, certificationLedger });
if (errors.length) {
  throw new Error(`Certification batch manifest validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.certificationBatches, batches);

console.log(
  `Generated certification batches: ${batches.totals.records} records, ${batches.totals.lanes} lanes, ${batches.totals.batches} batches.`
);
