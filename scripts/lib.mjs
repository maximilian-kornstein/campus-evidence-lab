import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const paths = {
  events: path.join(rootDir, "data", "events.json"),
  schools: path.join(rootDir, "data", "schools.json"),
  sources: path.join(rootDir, "data", "sources.json"),
  briefs: path.join(rootDir, "data", "briefs.json"),
  corrections: path.join(rootDir, "data", "corrections.json"),
  importManifests: path.join(rootDir, "data", "import-manifests.json"),
  importWavesDir: path.join(rootDir, "data", "import-waves"),
  importQuarantineDir: path.join(rootDir, "data", "import-quarantine"),
  reviewLog: path.join(rootDir, "data", "review-log.json"),
  reviewSamples: path.join(rootDir, "data", "review-samples.json"),
  reviewLedger: path.join(rootDir, "data", "review-ledger.json"),
  methodologyExamples: path.join(rootDir, "data", "methodology-examples.json"),
  workflows: path.join(rootDir, "data", "workflows.json"),
  releases: path.join(rootDir, "data", "releases.json"),
  releaseVerification: path.join(rootDir, "data", "release-verification.json"),
  credibilityStatus: path.join(rootDir, "data", "credibility-status.json"),
  robustnessMetrics: path.join(rootDir, "data", "robustness-metrics.json"),
  evidenceDepthQueues: path.join(rootDir, "data", "evidence-depth-queues.json"),
  goldRecordSet: path.join(rootDir, "data", "gold-record-set.json"),
  reviewerChallengePack: path.join(rootDir, "data", "reviewer-challenge-pack.json"),
  evidenceCapsules: path.join(rootDir, "data", "evidence-capsules.json"),
  sourceProvenanceQueues: path.join(rootDir, "data", "source-provenance-queues.json"),
  challengeStandards: path.join(rootDir, "data", "challenge-standards.json"),
  challengeQueues: path.join(rootDir, "data", "challenge-queues.json"),
  challengeLedger: path.join(rootDir, "data", "challenge-ledger.json"),
  flagshipReport: path.join(rootDir, "data", "flagship-report.json"),
  goldRecordV1: path.join(rootDir, "data", "gold-record-v1.json"),
  recordQualityAudit: path.join(rootDir, "data", "record-quality-audit.json"),
  recordQualityReviewerPacket: path.join(rootDir, "data", "record-quality-reviewer-packet.json"),
  goldV1CertificationStatus: path.join(rootDir, "data", "gold-v1-certification-status.json"),
  reviewDebtLedger: path.join(rootDir, "data", "review-debt-ledger.json"),
  externalReviewPacket: path.join(rootDir, "data", "external-review-packet.json"),
  certificationLedger: path.join(rootDir, "data", "certification-ledger.json"),
  sourceFamilyCertificationReview001: path.join(rootDir, "data", "source-family-certification-review-001.json"),
  governmentReleaseResponseDepthAudit: path.join(rootDir, "data", "government-release-response-depth-audit.json"),
  governmentReleaseResponseDepthRepairQueue: path.join(rootDir, "data", "government-release-response-depth-repair-queue.json"),
  edDatasetProvenanceAudit: path.join(rootDir, "data", "ed-dataset-provenance-audit.json"),
  certificationBatches: path.join(rootDir, "data", "certification-batches.json"),
  edCertificationBatchReview: path.join(rootDir, "data", "ed-certification-batch-001-review.json"),
  edCertificationBatch002Review: path.join(rootDir, "data", "ed-certification-batch-002-review.json"),
  edCertificationBatch003Review: path.join(rootDir, "data", "ed-certification-batch-003-review.json"),
  edCertificationBatch004Review: path.join(rootDir, "data", "ed-certification-batch-004-review.json"),
  edCertificationBatch005Review: path.join(rootDir, "data", "ed-certification-batch-005-review.json"),
  edCertificationBatch006Review: path.join(rootDir, "data", "ed-certification-batch-006-review.json"),
  edCertificationBatch007Review: path.join(rootDir, "data", "ed-certification-batch-007-review.json"),
  edCertificationBatch008Review: path.join(rootDir, "data", "ed-certification-batch-008-review.json"),
  edCertificationBatch009Review: path.join(rootDir, "data", "ed-certification-batch-009-review.json"),
  edCertificationBatch010Review: path.join(rootDir, "data", "ed-certification-batch-010-review.json"),
  edCertificationBatch011Review: path.join(rootDir, "data", "ed-certification-batch-011-review.json"),
  edCertificationBatch012Review: path.join(rootDir, "data", "ed-certification-batch-012-review.json"),
  edCertificationBatch013Review: path.join(rootDir, "data", "ed-certification-batch-013-review.json"),
  edCertificationBatch014Review: path.join(rootDir, "data", "ed-certification-batch-014-review.json"),
  edCertificationBatch015Review: path.join(rootDir, "data", "ed-certification-batch-015-review.json"),
  edCertificationBatch016Review: path.join(rootDir, "data", "ed-certification-batch-016-review.json"),
  sourceAudit: path.join(rootDir, "data", "source-audit.json"),
  sourceAuditLive: path.join(rootDir, "data", "source-audit-live.json"),
  changelog: path.join(rootDir, "data", "changelog.json"),
  productUpdates: path.join(rootDir, "data", "product-updates.json"),
  snapshotIndex: path.join(rootDir, "data", "snapshot-index.json"),
  eventsCsv: path.join(rootDir, "data", "events.csv"),
  eventsResearchJson: path.join(rootDir, "data", "events-research.json"),
  eventsResearchCsv: path.join(rootDir, "data", "events-research.csv"),
  schoolsCsv: path.join(rootDir, "data", "schools.csv"),
  schoolsResearchJson: path.join(rootDir, "data", "schools-research.json"),
  schoolsResearchCsv: path.join(rootDir, "data", "schools-research.csv"),
  sourcesCsv: path.join(rootDir, "data", "sources.csv"),
  sourcesResearchJson: path.join(rootDir, "data", "sources-research.json"),
  sourcesResearchCsv: path.join(rootDir, "data", "sources-research.csv"),
  manifest: path.join(rootDir, "data", "snapshot-manifest.json"),
  snapshotsDir: path.join(rootDir, "data", "snapshots")
};

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function sha256(value) {
  const normalized = JSON.stringify(canonicalize(value));
  return `sha256:${createHash("sha256").update(normalized).digest("hex")}`;
}

export function eventForHash(event) {
  const clone = structuredClone(event);
  clone.record_hash = "";
  return clone;
}

export function assertDate(value, label, errors) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    errors.push(`${label} must use YYYY-MM-DD format`);
    return;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) {
    errors.push(`${label} is not a valid calendar date`);
  }
}
