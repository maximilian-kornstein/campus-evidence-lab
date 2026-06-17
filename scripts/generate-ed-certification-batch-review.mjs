import { existsSync } from "node:fs";
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildEdCertificationBatchReview, validateEdCertificationBatchReview } from "./ed-certification-batch-review-lib.mjs";

const [events, certificationBatches, edDatasetProvenanceAudit, existingReview, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.certificationBatches),
  readJson(paths.edDatasetProvenanceAudit),
  existsSync(paths.edCertificationBatchReview) ? readJson(paths.edCertificationBatchReview) : null,
  readJson(paths.manifest)
]);

const review = buildEdCertificationBatchReview({
  events,
  certificationBatches,
  edDatasetProvenanceAudit,
  existingReview,
  manifest
});

const errors = validateEdCertificationBatchReview({ review, events, certificationBatches, manifest });
if (errors.length) {
  throw new Error(`ED certification batch review validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.edCertificationBatchReview, review);

console.log(
  `Generated ED certification Batch 001 review: ${review.totals.records} records, ${review.totals.certified} certified, ${review.totals.not_certified} not certified, ${review.totals.blocked} blocked.`
);
