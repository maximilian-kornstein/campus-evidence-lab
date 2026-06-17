import { existsSync } from "node:fs";
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildEdCertificationBatchReview, validateEdCertificationBatchReview } from "./ed-certification-batch-review-lib.mjs";

const reviewBatchId = "ed_certification_batch_002";
const sourceBatchId = "ed_dataset_batch_001";

const [events, certificationBatches, edDatasetProvenanceAudit, existingReview, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.certificationBatches),
  readJson(paths.edDatasetProvenanceAudit),
  existsSync(paths.edCertificationBatch002Review) ? readJson(paths.edCertificationBatch002Review) : null,
  readJson(paths.manifest)
]);

const review = buildEdCertificationBatchReview({
  events,
  certificationBatches,
  edDatasetProvenanceAudit,
  existingReview,
  reviewBatchId,
  sourceBatchId,
  manifest
});

const errors = validateEdCertificationBatchReview({
  review,
  events,
  certificationBatches,
  reviewBatchId,
  sourceBatchId,
  manifest
});
if (errors.length) {
  throw new Error(`ED certification Batch 002 review validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.edCertificationBatch002Review, review);

console.log(
  `Generated ED certification Batch 002 review: ${review.totals.records} records, ${review.totals.certified} certified, ${review.totals.not_certified} not certified, ${review.totals.blocked} blocked.`
);
