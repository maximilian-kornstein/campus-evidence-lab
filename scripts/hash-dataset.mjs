import { existsSync } from "node:fs";
import { eventForHash, paths, readJson, sha256, writeJson } from "./lib.mjs";

const checkOnly = process.argv.includes("--check");

const [
  events,
  schools,
  sources,
  briefs,
  corrections,
  reviewLog,
  reviewSamples,
  reviewLedger,
  methodologyExamples,
  workflows,
  releases,
  releaseVerification,
  credibilityStatus,
  robustnessMetrics,
  evidenceDepthQueues,
  goldRecordSet,
  reviewerChallengePack,
  evidenceCapsules,
  sourceProvenanceQueues,
  challengeStandards,
  challengeQueues,
  challengeLedger,
  flagshipReport,
  goldRecordV1,
  recordQualityAudit,
  recordQualityReviewerPacket,
  goldV1CertificationStatus,
  reviewDebtLedger,
  externalReviewPacket,
  certificationLedger,
  edDatasetProvenanceAudit,
  certificationBatches
] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs),
  readJson(paths.corrections),
  readJson(paths.reviewLog),
  readJson(paths.reviewSamples),
  readJson(paths.reviewLedger),
  readJson(paths.methodologyExamples),
  readJson(paths.workflows),
  readJson(paths.releases),
  readJson(paths.releaseVerification),
  readJson(paths.credibilityStatus),
  readJson(paths.robustnessMetrics),
  readJson(paths.evidenceDepthQueues),
  readJson(paths.goldRecordSet),
  readJson(paths.reviewerChallengePack),
  readJson(paths.evidenceCapsules),
  readJson(paths.sourceProvenanceQueues),
  readJson(paths.challengeStandards),
  readJson(paths.challengeQueues),
  readJson(paths.challengeLedger),
  readJson(paths.flagshipReport),
  readJson(paths.goldRecordV1),
  readJson(paths.recordQualityAudit),
  readJson(paths.recordQualityReviewerPacket),
  readJson(paths.goldV1CertificationStatus),
  readJson(paths.reviewDebtLedger),
  readJson(paths.externalReviewPacket),
  readJson(paths.certificationLedger),
  readJson(paths.edDatasetProvenanceAudit),
  readJson(paths.certificationBatches)
]);

const hashedEvents = events.map((event) => ({
  ...event,
  record_hash: sha256(eventForHash(event))
}));

const eventsHash = sha256(hashedEvents);
const schoolsHash = sha256(schools);
const sourcesHash = sha256(sources);
const stampedBriefs = briefs.map((brief) => ({
  ...brief,
  snapshot_hash: eventsHash
}));
const briefsHash = sha256(stampedBriefs);
const correctionsHash = sha256(corrections);
const reviewLogHash = sha256(reviewLog);
const reviewSamplesHash = sha256(reviewSamples);
const reviewLedgerHash = sha256(reviewLedger);
const methodologyExamplesHash = sha256(methodologyExamples);
const workflowsHash = sha256(workflows);
const releasesHash = sha256(releases);
const releaseVerificationHash = sha256(releaseVerification);
const credibilityStatusHash = sha256(credibilityStatus);
const robustnessMetricsHash = sha256(robustnessMetrics);
const evidenceDepthQueuesHash = sha256(evidenceDepthQueues);
const goldRecordSetHash = sha256(goldRecordSet);
const reviewerChallengePackHash = sha256(reviewerChallengePack);
const evidenceCapsulesHash = sha256(evidenceCapsules);
const sourceProvenanceQueuesHash = sha256(sourceProvenanceQueues);
const challengeStandardsHash = sha256(challengeStandards);
const challengeQueuesHash = sha256(challengeQueues);
const challengeLedgerHash = sha256(challengeLedger);
const flagshipReportHash = sha256(flagshipReport);
const goldRecordV1Hash = sha256(goldRecordV1);
const recordQualityAuditHash = sha256(recordQualityAudit);
const recordQualityReviewerPacketHash = sha256(recordQualityReviewerPacket);
const goldV1CertificationStatusHash = sha256(goldV1CertificationStatus);
const reviewDebtLedgerHash = sha256(reviewDebtLedger);
const externalReviewPacketHash = sha256(externalReviewPacket);
const certificationLedgerHash = sha256(certificationLedger);
const edDatasetProvenanceAuditHash = sha256(edDatasetProvenanceAudit);
const certificationBatchesHash = sha256(certificationBatches);

const previousManifest = existsSync(paths.manifest) ? await readJson(paths.manifest) : null;

const snapshotId = `snapshot_2026_06_03_${hashedEvents.length}_records`;
const previousSnapshotHash =
  previousManifest?.snapshot_id === snapshotId
    ? previousManifest.hashes.previous_snapshot ?? null
    : previousManifest?.hashes?.full_snapshot ?? null;

const manifest = {
  snapshot_id: snapshotId,
  created_at: "2026-06-03",
  schema_version: "0.1.0",
  totals: {
    events: hashedEvents.length,
    schools: schools.length,
    sources: sources.length,
    briefs: briefs.length,
    corrections: corrections.length,
    review_queues: reviewLog.queues.length,
    review_samples: reviewSamples.samples.length,
    review_ledger_entries: reviewLedger.entries.length,
    methodology_examples: methodologyExamples.length,
    workflows: workflows.workflows.length,
    releases: releases.releases.length,
    release_verification_commands: releaseVerification.commands.length,
    credibility_entries: credibilityStatus.entries.length,
    evidence_depth_queues: evidenceDepthQueues.queues.length,
    gold_record_candidates: goldRecordSet.records.length,
    reviewer_challenge_records: reviewerChallengePack.records.length,
    evidence_capsules: evidenceCapsules.records.length,
    source_provenance_queues: sourceProvenanceQueues.queues.length,
    challenge_standards: challengeStandards.standards.length,
    challenge_queues: challengeQueues.queues.length,
    challenge_packets: challengeQueues.packets.length,
    challenge_ledger_entries: challengeLedger.entries.length,
    flagship_findings: flagshipReport.findings.length,
    gold_record_v1_packets: goldRecordV1.records.length,
    record_quality_audit_records: recordQualityAudit.records.length,
    record_quality_audit_priority_records: recordQualityAudit.priority_records.length,
    record_quality_reviewer_packet_queues: Object.keys(recordQualityReviewerPacket.priority_queues ?? {}).length,
    gold_v1_certified_records: goldV1CertificationStatus.totals.certified,
    gold_v1_blocked_records: goldV1CertificationStatus.totals.blocked,
    review_debt_ledger_records: reviewDebtLedger.records.length,
    review_debt_ledger_source_families: reviewDebtLedger.totals.source_families,
    review_debt_ledger_blocked_records: reviewDebtLedger.totals.blocked,
    external_review_packet_records: externalReviewPacket.records.length,
    external_review_packet_challenge_templates: externalReviewPacket.challenge_templates.length,
    certification_ledger_records: certificationLedger.records.length,
    certification_ledger_certified_records: certificationLedger.totals.certified,
    certification_ledger_awaiting_review_records: certificationLedger.totals.awaiting_review,
    certification_batch_001_records: certificationLedger.batch_001.records.length,
    ed_dataset_provenance_records: edDatasetProvenanceAudit.records.length,
    ed_dataset_provenance_matched_records: edDatasetProvenanceAudit.totals.matched,
    ed_dataset_provenance_unmatched_records: edDatasetProvenanceAudit.totals.unmatched,
    certification_batches: certificationBatches.totals.batches
  },
  hashes: {
    events: eventsHash,
    schools: schoolsHash,
    sources: sourcesHash,
    briefs: briefsHash,
    corrections: correctionsHash,
    review_log: reviewLogHash,
    review_samples: reviewSamplesHash,
    review_ledger: reviewLedgerHash,
    methodology_examples: methodologyExamplesHash,
    workflows: workflowsHash,
    releases: releasesHash,
    release_verification: releaseVerificationHash,
    credibility_status: credibilityStatusHash,
    robustness_metrics: robustnessMetricsHash,
    evidence_depth_queues: evidenceDepthQueuesHash,
    gold_record_set: goldRecordSetHash,
    reviewer_challenge_pack: reviewerChallengePackHash,
    evidence_capsules: evidenceCapsulesHash,
    source_provenance_queues: sourceProvenanceQueuesHash,
    challenge_standards: challengeStandardsHash,
    challenge_queues: challengeQueuesHash,
    challenge_ledger: challengeLedgerHash,
    flagship_report: flagshipReportHash,
    gold_record_v1: goldRecordV1Hash,
    record_quality_audit: recordQualityAuditHash,
    record_quality_reviewer_packet: recordQualityReviewerPacketHash,
    gold_v1_certification_status: goldV1CertificationStatusHash,
    review_debt_ledger: reviewDebtLedgerHash,
    external_review_packet: externalReviewPacketHash,
    certification_ledger: certificationLedgerHash,
    ed_dataset_provenance_audit: edDatasetProvenanceAuditHash,
    certification_batches: certificationBatchesHash,
    // Review artifacts that cite or evaluate the core snapshot are tracked alongside it rather than folded into it.
    full_snapshot: sha256({
      events: eventsHash,
      schools: schoolsHash,
      sources: sourcesHash,
      briefs: briefsHash,
      corrections: correctionsHash,
      review_log: reviewLogHash,
      review_samples: reviewSamplesHash,
      review_ledger: reviewLedgerHash,
      methodology_examples: methodologyExamplesHash,
      workflows: workflowsHash,
      releases: releasesHash,
      release_verification: releaseVerificationHash,
      credibility_status: credibilityStatusHash,
      robustness_metrics: robustnessMetricsHash,
      evidence_depth_queues: evidenceDepthQueuesHash,
      gold_record_set: goldRecordSetHash,
      reviewer_challenge_pack: reviewerChallengePackHash,
      evidence_capsules: evidenceCapsulesHash,
      source_provenance_queues: sourceProvenanceQueuesHash,
      challenge_standards: challengeStandardsHash,
      challenge_queues: challengeQueuesHash,
      challenge_ledger: challengeLedgerHash
    }),
    previous_snapshot: previousSnapshotHash
  }
};

const currentEventsMatch = JSON.stringify(events) === JSON.stringify(hashedEvents);
const currentBriefsMatch = JSON.stringify(briefs) === JSON.stringify(stampedBriefs);
let currentManifestMatch = false;

if (previousManifest) {
  const comparablePrevious = structuredClone(previousManifest);
  const comparableManifest = structuredClone(manifest);
  currentManifestMatch = JSON.stringify(comparablePrevious) === JSON.stringify(comparableManifest);
}

if (checkOnly) {
  if (!currentEventsMatch) {
    console.error("Event hashes are stale. Run npm run hash:data.");
    process.exit(1);
  }
  if (!currentBriefsMatch) {
    console.error("Brief snapshot hashes are stale. Run npm run hash:data.");
    process.exit(1);
  }
  if (!previousManifest || !currentManifestMatch) {
    console.error("Snapshot manifest is missing or stale. Run npm run hash:data.");
    process.exit(1);
  }
  console.log(`Integrity check passed: ${manifest.hashes.full_snapshot}`);
  process.exit(0);
}

await writeJson(paths.events, hashedEvents);
await writeJson(paths.briefs, stampedBriefs);
await writeJson(paths.manifest, manifest);
await writeJson(`${paths.snapshotsDir}/${snapshotId}.json`, manifest);

console.log(`Wrote record hashes, brief snapshot hashes, and snapshot manifests.`);
console.log(manifest.hashes.full_snapshot);
