import { paths, readJson, writeJson } from "./lib.mjs";
import {
  buildGoldV1CertificationStatus,
  buildRecordQualityAudit,
  buildRecordQualityReviewerPacket
} from "./record-quality-audit-lib.mjs";
import { buildReviewDebtLedger, validateReviewDebtLedger } from "./review-debt-ledger-lib.mjs";

const [events, sources, sourceAuditLive, goldRecordV1, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.sources),
  readJson(paths.sourceAuditLive),
  readJson(paths.goldRecordV1),
  readJson(paths.manifest)
]);

const audit = buildRecordQualityAudit({
  events,
  sources,
  liveAudit: sourceAuditLive,
  goldRecordV1,
  manifest,
  priorityLimit: 100
});

const reviewerPacket = buildRecordQualityReviewerPacket({
  audit,
  sources,
  liveAudit: sourceAuditLive,
  manifest,
  limit: 25
});

const goldV1CertificationStatus = buildGoldV1CertificationStatus({
  audit,
  goldRecordV1,
  manifest
});

const reviewDebtLedger = buildReviewDebtLedger({
  events,
  sources,
  audit,
  manifest,
  queueLimit: 100
});
const reviewDebtLedgerErrors = validateReviewDebtLedger({ ledger: reviewDebtLedger, events, manifest });
if (reviewDebtLedgerErrors.length) {
  throw new Error(`Review debt ledger validation failed:\n${reviewDebtLedgerErrors.map((error) => `- ${error}`).join("\n")}`);
}

await Promise.all([
  writeJson(paths.recordQualityAudit, audit),
  writeJson(paths.recordQualityReviewerPacket, reviewerPacket),
  writeJson(paths.goldV1CertificationStatus, goldV1CertificationStatus),
  writeJson(paths.reviewDebtLedger, reviewDebtLedger)
]);

console.log(
  `Generated record quality audit: ${audit.totals.records} records, ${audit.totals.gold_v1_records} gold v1 pre-review rows, ${audit.totals.blocked_before_external_packet} blocked before external packets, ${reviewerPacket.source_link_review.locator_risk_sources.length} source locator risks, ${goldV1CertificationStatus.totals.certified} certified Gold v1 records, ${reviewDebtLedger.totals.records} review-debt ledger rows.`
);
