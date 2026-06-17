import { existsSync } from "node:fs";
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildCertificationLedger, validateCertificationLedger } from "./certification-ledger-lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "./ed-certification-review-registry.mjs";

const [events, sources, reviewDebtLedger, goldV1CertificationStatus, ...edCertificationBatchReviewsAndManifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.sources),
  readJson(paths.reviewDebtLedger),
  readJson(paths.goldV1CertificationStatus),
  ...ED_CERTIFICATION_REVIEW_SPECS.map((spec) => (existsSync(paths[spec.dataPathKey]) ? readJson(paths[spec.dataPathKey]) : { records: [] })),
  readJson(paths.manifest)
]);
const manifest = edCertificationBatchReviewsAndManifest.at(-1);
const edCertificationBatchReviews = edCertificationBatchReviewsAndManifest.slice(0, -1);

const certificationLedger = buildCertificationLedger({
  events,
  sources,
  reviewDebtLedger,
  goldV1CertificationStatus,
  edCertificationBatchReviews,
  manifest,
  batchLimit: 100
});

const errors = validateCertificationLedger({ ledger: certificationLedger, events, manifest });
if (errors.length) {
  throw new Error(`Certification ledger validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.certificationLedger, certificationLedger);

console.log(
  `Generated certification ledger: ${certificationLedger.totals.records} records, ${certificationLedger.totals.certified} certified, ${certificationLedger.totals.not_certified} not certified, ${certificationLedger.totals.blocked} blocked, ${certificationLedger.totals.awaiting_review} awaiting review, ${certificationLedger.batch_001.records.length} Batch 001 records.`
);
