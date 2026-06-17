import { paths, readJson, writeJson } from "./lib.mjs";
import { buildCertificationLedger, validateCertificationLedger } from "./certification-ledger-lib.mjs";

const [events, sources, reviewDebtLedger, goldV1CertificationStatus, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.sources),
  readJson(paths.reviewDebtLedger),
  readJson(paths.goldV1CertificationStatus),
  readJson(paths.manifest)
]);

const certificationLedger = buildCertificationLedger({
  events,
  sources,
  reviewDebtLedger,
  goldV1CertificationStatus,
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
