import { existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildEdCertificationBatchReview, validateEdCertificationBatchReview } from "./ed-certification-batch-review-lib.mjs";
import { reviewSpecByBatchId } from "./ed-certification-review-registry.mjs";

export async function generateEdCertificationReview(reviewBatchId) {
  const spec = reviewSpecByBatchId(reviewBatchId);
  const [events, certificationBatches, edDatasetProvenanceAudit, existingReview, manifest] = await Promise.all([
    readJson(paths.events),
    readJson(paths.certificationBatches),
    readJson(paths.edDatasetProvenanceAudit),
    existsSync(paths[spec.dataPathKey]) ? readJson(paths[spec.dataPathKey]) : null,
    readJson(paths.manifest)
  ]);

  const review = buildEdCertificationBatchReview({
    events,
    certificationBatches,
    edDatasetProvenanceAudit,
    existingReview,
    reviewBatchId: spec.reviewBatchId,
    sourceBatchId: spec.sourceBatchId,
    manifest
  });

  const errors = validateEdCertificationBatchReview({
    review,
    events,
    certificationBatches,
    reviewBatchId: spec.reviewBatchId,
    sourceBatchId: spec.sourceBatchId,
    manifest
  });
  if (errors.length) {
    throw new Error(`ED certification review ${spec.reviewBatchId} validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  await writeJson(paths[spec.dataPathKey], review);

  console.log(
    `Generated ${spec.pageKicker}: ${review.totals.records} records, ${review.totals.certified} certified, ${review.totals.not_certified} not certified, ${review.totals.blocked} blocked.`
  );

  return review;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reviewBatchId = process.argv[2];
  if (!reviewBatchId) throw new Error("Usage: node scripts/generate-ed-certification-review.mjs <review_batch_id>");
  await generateEdCertificationReview(reviewBatchId);
}
