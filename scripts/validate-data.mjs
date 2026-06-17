import { access } from "node:fs/promises";
import path from "node:path";
import { assertDate, paths, readJson, rootDir, sha256, eventForHash } from "./lib.mjs";
import { validateReviewLedger } from "./review-samples-lib.mjs";
import { validateMethodologyExamples } from "./methodology-definitions.mjs";
import { validateCredibilityStatus, validateReleaseVerification, validateReleases } from "./release-credibility-lib.mjs";
import { containsProhibitedRobustnessClaim } from "./robustness-metrics-lib.mjs";
import { hasProhibitedEvidenceClaim } from "./evidence-capsules-lib.mjs";
import { hasProhibitedChallengeClaim, validateChallengeArtifacts } from "./challenge-protocol-lib.mjs";
import { validateFlagshipArtifacts } from "./flagship-report-lib.mjs";
import {
  validateGoldV1CertificationStatus,
  hasProhibitedRecordAuditClaim,
  validateRecordQualityAudit,
  validateRecordQualityReviewerPacket
} from "./record-quality-audit-lib.mjs";
import { hasProhibitedExternalReviewClaim, validateExternalReviewPacket } from "./external-review-packet-lib.mjs";
import { validateCertificationLedger } from "./certification-ledger-lib.mjs";
import { validateEdDatasetProvenanceAudit } from "./ed-dataset-provenance-lib.mjs";
import { validateCertificationBatches } from "./certification-batches-lib.mjs";
import { validateEdCertificationBatchReview } from "./ed-certification-batch-review-lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "./ed-certification-review-registry.mjs";

const allowedCommunities = new Set([
  "Jewish",
  "Asian",
  "Black",
  "Native",
  "Indigenous",
  "Latino",
  "Muslim",
  "Israeli",
  "Sikh",
  "Hindu",
  "LGBTQ+",
  "Race",
  "Religion",
  "National origin",
  "Ethnicity",
  "Gender",
  "Disability",
  "Students with disabilities",
  "Women",
  "Pregnant students",
  "Palestinian",
  "Arab"
]);

const allowedCategories = new Set([
  "Harassment or threat",
  "Vandalism",
  "Discrimination allegation",
  "Protest-related incident",
  "Institutional response",
  "Public statement",
  "Policy change",
  "Public safety notice",
  "OCR complaint",
  "Lawsuit or legal filing",
  "Criminal investigation",
  "Community response",
  "Title IX compliance",
  "Pregnancy discrimination",
  "Disability access",
  "Athletic equity",
  "Other source-backed civil rights event"
]);

const allowedVerification = new Set([
  "Pending review",
  "Verified from public source",
  "Verified from multiple public sources",
  "Public allegation",
  "Institutional statement only",
  "Updated after correction",
  "Archived / no longer included"
]);

const allowedConfidence = new Set(["High", "Medium", "Low"]);
const allowedDatePrecision = new Set(["day", "month", "year"]);
const allowedResponseDepth = new Set([
  "direct_institutional_response",
  "agency_described_institutional_action",
  "limited_public_response_note",
  "no_public_response_found"
]);
const allowedLocatorTypes = new Set(["workbook_cell", "page_table", "aggregate_item", "source_item", "document_section"]);

const allowedCorrectionStatus = new Set(["pending", "accepted", "rejected", "needs_more_evidence"]);
const requiredReviewQueues = new Set([
  "source-submissions",
  "correction-requests",
  "duplicate-reports",
  "school-metadata-corrections"
]);

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
  certificationBatches,
  ...edCertificationBatchReviewsAndManifest
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
  readJson(paths.certificationBatches),
  ...ED_CERTIFICATION_REVIEW_SPECS.map((spec) => readJson(paths[spec.dataPathKey])),
  readJson(paths.manifest)
]);
const manifest = edCertificationBatchReviewsAndManifest.at(-1);
const edCertificationBatchReviews = edCertificationBatchReviewsAndManifest.slice(0, -1);

const errors = [];

function uniqueBy(items, key, label) {
  const seen = new Set();
  for (const item of items) {
    if (!item[key]) errors.push(`${label} missing ${key}`);
    if (seen.has(item[key])) errors.push(`Duplicate ${label} ${key}: ${item[key]}`);
    seen.add(item[key]);
  }
}

uniqueBy(events, "id", "event");
uniqueBy(schools, "id", "school");
uniqueBy(sources, "id", "source");
uniqueBy(briefs, "id", "brief");
uniqueBy(corrections, "id", "correction");
uniqueBy(sources, "url", "source");

const schoolIds = new Set(schools.map((school) => school.id));
const sourceIds = new Set(sources.map((source) => source.id));
const eventIds = new Set(events.map((event) => event.id));

for (const school of schools) {
  for (const field of ["name", "city", "state", "country"]) {
    if (!school[field]) errors.push(`School ${school.id} missing ${field}`);
  }
  if (school.website) {
    try {
      new URL(school.website);
    } catch {
      errors.push(`School ${school.id} has invalid website`);
    }
  }
}

for (const source of sources) {
  for (const field of ["title", "url", "publisher", "source_type", "published_date", "accessed_date"]) {
    if (!source[field]) errors.push(`Source ${source.id} missing ${field}`);
  }
  try {
    new URL(source.url);
  } catch {
    errors.push(`Source ${source.id} has invalid URL`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(source.published_date)) {
    assertDate(source.published_date, `Source ${source.id} published_date`, errors);
  }
  assertDate(source.accessed_date, `Source ${source.id} accessed_date`, errors);
}

for (const event of events) {
  if (!/^evt_\d{4}_\d{4}$/.test(event.id)) errors.push(`Event ${event.id} has invalid ID format`);
  if (!schoolIds.has(event.school_id)) errors.push(`Event ${event.id} references unknown school ${event.school_id}`);
  assertDate(event.date, `Event ${event.id} date`, errors);
  assertDate(event.created_at, `Event ${event.id} created_at`, errors);
  assertDate(event.updated_at, `Event ${event.id} updated_at`, errors);
  if (!allowedDatePrecision.has(event.date_precision)) errors.push(`Event ${event.id} has invalid date_precision`);
  if (!allowedCategories.has(event.category)) errors.push(`Event ${event.id} has invalid category ${event.category}`);
  if (!allowedVerification.has(event.verification_status)) errors.push(`Event ${event.id} has invalid verification_status`);
  if (!allowedConfidence.has(event.confidence)) errors.push(`Event ${event.id} has invalid confidence`);
  if (event.response_depth !== undefined && !allowedResponseDepth.has(event.response_depth)) {
    errors.push(`Event ${event.id} has invalid response_depth ${event.response_depth}`);
  }
  if (!Array.isArray(event.affected_communities) || event.affected_communities.length === 0) {
    errors.push(`Event ${event.id} must include affected_communities`);
  } else {
    for (const community of event.affected_communities) {
      if (!allowedCommunities.has(community)) errors.push(`Event ${event.id} has unsupported community ${community}`);
    }
  }
  if (!Array.isArray(event.source_ids) || event.source_ids.length === 0) {
    errors.push(`Event ${event.id} must include at least one source_id`);
  } else {
    for (const sourceId of event.source_ids) {
      if (!sourceIds.has(sourceId)) errors.push(`Event ${event.id} references unknown source ${sourceId}`);
    }
  }
  for (const field of ["classification_rationale", "community_rationale", "confidence_rationale"]) {
    if (event[field] !== undefined && (!event[field] || event[field].length < 20)) {
      errors.push(`Event ${event.id} ${field} is too short`);
    }
  }
  if (event.limitations !== undefined) {
    if (!Array.isArray(event.limitations) || event.limitations.length === 0) {
      errors.push(`Event ${event.id} limitations must be a non-empty array when present`);
    } else {
      for (const [index, limitation] of event.limitations.entries()) {
        if (!limitation || limitation.length < 20) errors.push(`Event ${event.id} limitations[${index}] is too short`);
      }
    }
  }
  if (event.field_support !== undefined) {
    if (!Array.isArray(event.field_support) || event.field_support.length === 0) {
      errors.push(`Event ${event.id} field_support must be a non-empty array when present`);
    } else {
      for (const [index, row] of event.field_support.entries()) {
        if (!row.field) errors.push(`Event ${event.id} field_support[${index}] missing field`);
        if (!row.rationale || row.rationale.length < 20) errors.push(`Event ${event.id} field_support[${index}] rationale is too short`);
        if (!Array.isArray(row.source_ids) || row.source_ids.length === 0) {
          errors.push(`Event ${event.id} field_support[${index}] must include source_ids`);
        } else {
          for (const sourceId of row.source_ids) {
            if (!sourceIds.has(sourceId)) errors.push(`Event ${event.id} field_support[${index}] references unknown source ${sourceId}`);
          }
        }
      }
    }
  }
  if (event.source_locators !== undefined) {
    if (!Array.isArray(event.source_locators) || event.source_locators.length === 0) {
      errors.push(`Event ${event.id} source_locators must be a non-empty array when present`);
    } else {
      for (const [index, locator] of event.source_locators.entries()) {
        if (!locator.source_id || !sourceIds.has(locator.source_id)) {
          errors.push(`Event ${event.id} source_locators[${index}] references unknown source`);
        }
        if (!allowedLocatorTypes.has(locator.locator_type)) {
          errors.push(`Event ${event.id} source_locators[${index}] has invalid locator_type`);
        }
        if (!locator.locator || locator.locator.length < 20) {
          errors.push(`Event ${event.id} source_locators[${index}] locator is too short`);
        }
        if (locator.locator_type === "workbook_cell") {
          for (const field of ["workbook", "sheet", "row", "column", "cell"]) {
            if (!locator[field]) errors.push(`Event ${event.id} source_locators[${index}] workbook_cell missing ${field}`);
          }
          if (!Number.isInteger(locator.row) || locator.row < 1) {
            errors.push(`Event ${event.id} source_locators[${index}] workbook_cell row must be a positive integer`);
          }
        }
        if (locator.locator_type === "aggregate_item") {
          if (!locator.item_date || !locator.item_label) {
            errors.push(`Event ${event.id} source_locators[${index}] aggregate_item missing item_date or item_label`);
          } else {
            assertDate(locator.item_date, `Event ${event.id} source_locators[${index}].item_date`, errors);
          }
          if (locator.item_date_precision !== undefined && !allowedDatePrecision.has(locator.item_date_precision)) {
            errors.push(`Event ${event.id} source_locators[${index}] has invalid item_date_precision`);
          }
        }
        if (["page_table", "source_item", "document_section"].includes(locator.locator_type)) {
          if (!locator.page && !locator.table && !locator.section && !locator.item_label) {
            errors.push(`Event ${event.id} source_locators[${index}] page/document locator needs page, table, section, or item_label`);
          }
        }
      }
    }
  }
  for (const field of ["summary", "description", "institutional_response", "legal_status"]) {
    if (!event[field] || event[field].length < 20) errors.push(`Event ${event.id} ${field} is too short`);
  }
  if (!Array.isArray(event.changelog) || event.changelog.length === 0) {
    errors.push(`Event ${event.id} must include changelog`);
  } else {
    for (const [index, entry] of event.changelog.entries()) {
      assertDate(entry.date, `Event ${event.id} changelog[${index}].date`, errors);
      if (!entry.note) errors.push(`Event ${event.id} changelog[${index}] missing note`);
    }
  }
  if (!event.record_hash) {
    errors.push(`Event ${event.id} missing record_hash. Run npm run hash:data`);
  } else if (event.record_hash !== sha256(eventForHash(event))) {
    errors.push(`Event ${event.id} record_hash is stale. Run npm run hash:data`);
  }
}

for (const brief of briefs) {
  assertDate(brief.week_start, `Brief ${brief.id} week_start`, errors);
  assertDate(brief.week_end, `Brief ${brief.id} week_end`, errors);
  assertDate(brief.published_date, `Brief ${brief.id} published_date`, errors);
  for (const eventId of [...brief.new_event_ids, ...brief.updated_event_ids]) {
    if (!eventIds.has(eventId)) errors.push(`Brief ${brief.id} references unknown event ${eventId}`);
  }
}

for (const correction of corrections) {
  if (!/^corr_\d{4}_\d{4}$/.test(correction.id)) errors.push(`Correction ${correction.id} has invalid ID format`);
  if (!eventIds.has(correction.record_id)) errors.push(`Correction ${correction.id} references unknown event ${correction.record_id}`);
  if (!allowedCorrectionStatus.has(correction.status)) errors.push(`Correction ${correction.id} has invalid status ${correction.status}`);
  assertDate(correction.requested_at, `Correction ${correction.id} requested_at`, errors);
  if (correction.resolved_at !== null && correction.resolved_at !== undefined) {
    assertDate(correction.resolved_at, `Correction ${correction.id} resolved_at`, errors);
  }
  for (const field of ["field", "requested_change", "public_rationale"]) {
    if (!correction[field]) errors.push(`Correction ${correction.id} missing ${field}`);
  }
  if (!Array.isArray(correction.public_source_urls) || correction.public_source_urls.length === 0) {
    errors.push(`Correction ${correction.id} must include public_source_urls`);
  } else {
    for (const url of correction.public_source_urls) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") errors.push(`Correction ${correction.id} source URL must use HTTPS`);
      } catch {
        errors.push(`Correction ${correction.id} has invalid public source URL`);
      }
    }
  }
  for (const eventId of correction.applied_event_ids ?? []) {
    if (!eventIds.has(eventId)) errors.push(`Correction ${correction.id} references unknown applied event ${eventId}`);
  }
}

assertDate(reviewLog.updated_at, "review-log updated_at", errors);
if (!Array.isArray(reviewLog.queues) || reviewLog.queues.length < requiredReviewQueues.size) {
  errors.push("review-log must include all required public intake queues");
}

const queueNames = new Set((reviewLog.queues ?? []).map((queue) => queue.name));
for (const queueName of requiredReviewQueues) {
  if (!queueNames.has(queueName)) {
    errors.push(`review-log missing required queue ${queueName}`);
  }
}

for (const queue of reviewLog.queues ?? []) {
  for (const field of ["name", "status", "public_entrypoint"]) {
    if (!queue[field]) errors.push(`review-log queue missing ${field}`);
  }
  if (!["open", "paused", "closed"].includes(queue.status)) {
    errors.push(`review-log queue ${queue.name} has invalid status ${queue.status}`);
  }
  if (!Array.isArray(queue.accepted_evidence) || queue.accepted_evidence.length === 0) {
    errors.push(`review-log queue ${queue.name} must include accepted_evidence`);
  }
  if (!Array.isArray(queue.excluded_evidence) || queue.excluded_evidence.length === 0) {
    errors.push(`review-log queue ${queue.name} must include excluded_evidence`);
  }
  try {
    await access(path.join(rootDir, queue.public_entrypoint));
  } catch {
    errors.push(`review-log queue ${queue.name} references missing entrypoint ${queue.public_entrypoint}`);
  }
}

const actualCorrectionCounts = {
  pending: corrections.filter((correction) => correction.status === "pending").length,
  accepted: corrections.filter((correction) => correction.status === "accepted").length,
  rejected: corrections.filter((correction) => correction.status === "rejected").length,
  needs_more_evidence: corrections.filter((correction) => correction.status === "needs_more_evidence").length
};

for (const [status, count] of Object.entries(actualCorrectionCounts)) {
  if (reviewLog.decision_counts?.[status] !== count) {
    errors.push(`review-log decision_counts.${status} is ${reviewLog.decision_counts?.[status]}, expected ${count}`);
  }
}

if (!reviewLog.service_standard?.publication_rule || !reviewLog.service_standard?.correction_rule) {
  errors.push("review-log must include publication and correction rules");
}

if (!reviewSamples.snapshot_id || reviewSamples.snapshot_id !== manifest.snapshot_id) {
  errors.push("review-samples snapshot_id must match snapshot manifest");
}
if (!Array.isArray(reviewSamples.samples) || reviewSamples.samples.length === 0) {
  errors.push("review-samples must include at least one sample");
}

const reviewSampleIds = new Set();
for (const sample of reviewSamples.samples ?? []) {
  if (!sample.id) errors.push("review-samples sample missing id");
  if (reviewSampleIds.has(sample.id)) errors.push(`review-samples duplicate sample ${sample.id}`);
  reviewSampleIds.add(sample.id);
  if (!sample.label || !sample.description) errors.push(`review-samples sample ${sample.id} missing label or description`);
  if (!Number.isInteger(sample.limit) || sample.limit < 1) errors.push(`review-samples sample ${sample.id} has invalid limit`);
  if (!Array.isArray(sample.records)) errors.push(`review-samples sample ${sample.id} records must be an array`);
  for (const row of sample.records ?? []) {
    if (!eventIds.has(row.event_id)) errors.push(`review-samples sample ${sample.id} references unknown event ${row.event_id}`);
    if (!Array.isArray(row.reason_codes) || row.reason_codes.length === 0) {
      errors.push(`review-samples sample ${sample.id} row ${row.event_id} must include reason_codes`);
    }
    if (!row.workspace_url || !row.checklist_url) {
      errors.push(`review-samples sample ${sample.id} row ${row.event_id} missing review URLs`);
    }
  }
}

errors.push(...validateReviewLedger(reviewLedger, reviewSampleIds));
errors.push(...validateMethodologyExamples(methodologyExamples));

if (!workflows.version) errors.push("workflows missing version");
assertDate(workflows.updated_at, "workflows updated_at", errors);
if (!Array.isArray(workflows.workflows) || workflows.workflows.length < 8) {
  errors.push("workflows must include the required task entry points");
}
for (const workflow of workflows.workflows ?? []) {
  for (const field of ["id", "title", "audience", "start_url", "packet_url"]) {
    if (!workflow[field]) errors.push(`Workflow ${workflow.id ?? "unknown"} missing ${field}`);
  }
  for (const field of ["steps", "supported_claims", "requires_followup", "guardrail_links"]) {
    if (!Array.isArray(workflow[field]) || workflow[field].length === 0) {
      errors.push(`Workflow ${workflow.id ?? "unknown"} ${field} must be a non-empty array`);
    }
  }
  const text = JSON.stringify(workflow).toLowerCase();
  if (/safest|most dangerous|worst school|best school|endorsed by|approved by|safety score|severity score|school ranking|prevalence estimate/.test(text)) {
    errors.push(`Workflow ${workflow.id} includes prohibited overclaiming language`);
  }
}
errors.push(...validateReleases(releases));
errors.push(...validateReleaseVerification(releaseVerification));
errors.push(...validateCredibilityStatus(credibilityStatus));

for (const [label, artifact] of [
  ["robustness-metrics", robustnessMetrics],
  ["evidence-depth-queues", evidenceDepthQueues],
  ["gold-record-set", goldRecordSet],
  ["reviewer-challenge-pack", reviewerChallengePack]
]) {
  if (artifact.snapshot_id !== manifest.snapshot_id) {
    errors.push(`${label} snapshot_id must match snapshot manifest`);
  }
  assertDate(artifact.generated_at, `${label} generated_at`, errors);
  if (containsProhibitedRobustnessClaim(JSON.stringify(artifact))) {
    errors.push(`${label} includes prohibited ranking, prevalence, endorsement, or safety-score language`);
  }
}

if (!robustnessMetrics.totals || robustnessMetrics.totals.events !== events.length) {
  errors.push("robustness-metrics totals.events must match event count");
}
for (const field of ["source_type_concentration", "confidence", "date_precision", "community_concentration", "category_concentration", "response_depth", "review_gaps"]) {
  if (!robustnessMetrics[field] || typeof robustnessMetrics[field] !== "object") {
    errors.push(`robustness-metrics missing ${field}`);
  }
}
if (!Array.isArray(robustnessMetrics.known_limits) || robustnessMetrics.known_limits.length === 0) {
  errors.push("robustness-metrics must include known limits");
}

if (!Array.isArray(evidenceDepthQueues.queues) || evidenceDepthQueues.queues.length < 6) {
  errors.push("evidence-depth-queues must include at least six queues");
}
for (const queue of evidenceDepthQueues.queues ?? []) {
  if (!queue.id || !queue.label || !queue.description) {
    errors.push("evidence-depth-queues queue missing id, label, or description");
  }
  if (!Array.isArray(queue.records) || queue.records.length === 0 || queue.records.length > 25) {
    errors.push(`evidence-depth-queues ${queue.id} must include 1-25 records`);
  }
  for (const row of queue.records ?? []) {
    if (!eventIds.has(row.event_id)) errors.push(`evidence-depth-queues ${queue.id} references unknown event ${row.event_id}`);
    if (!Array.isArray(row.reason_codes) || row.reason_codes.length === 0) {
      errors.push(`evidence-depth-queues ${queue.id} row ${row.event_id} missing reason_codes`);
    }
    if (!row.workspace_url || !row.packet_url) {
      errors.push(`evidence-depth-queues ${queue.id} row ${row.event_id} missing review URLs`);
    }
    if (!row.workspace_url?.includes("record_ids=") || !row.packet_url?.includes("record_ids=")) {
      errors.push(`evidence-depth-queues ${queue.id} row ${row.event_id} review URLs must select record_ids`);
    }
  }
}

if (goldRecordSet.review_standard !== "existing_metadata_evidence_depth_review") {
  errors.push("gold-record-set review_standard must be existing_metadata_evidence_depth_review");
}
if (!Array.isArray(goldRecordSet.records) || goldRecordSet.records.length === 0 || goldRecordSet.records.length > 100) {
  errors.push("gold-record-set must include 1-100 records");
}
for (const record of goldRecordSet.records ?? []) {
  if (!eventIds.has(record.event_id)) errors.push(`gold-record-set references unknown event ${record.event_id}`);
  if (record.status !== "candidate_enriched_from_existing_metadata") {
    errors.push(`gold-record-set ${record.event_id} has unsupported status ${record.status}`);
  }
  if (!Array.isArray(record.required_before_gold_status) || record.required_before_gold_status.length === 0) {
    errors.push(`gold-record-set ${record.event_id} missing required_before_gold_status`);
  }
}

if (!Array.isArray(reviewerChallengePack.records) || reviewerChallengePack.records.length === 0 || reviewerChallengePack.records.length > 25) {
  errors.push("reviewer-challenge-pack must include 1-25 records");
}
for (const record of reviewerChallengePack.records ?? []) {
  if (!eventIds.has(record.event_id)) errors.push(`reviewer-challenge-pack references unknown event ${record.event_id}`);
  if (!Array.isArray(record.challenge_reason_codes) || record.challenge_reason_codes.length === 0) {
    errors.push(`reviewer-challenge-pack ${record.event_id} missing challenge_reason_codes`);
  }
}

for (const [label, artifact] of [
  ["evidence-capsules", evidenceCapsules],
  ["source-provenance-queues", sourceProvenanceQueues]
]) {
  if (artifact.snapshot_id !== manifest.snapshot_id) {
    errors.push(`${label} snapshot_id must match snapshot manifest`);
  }
  assertDate(artifact.generated_at, `${label} generated_at`, errors);
  if (hasProhibitedEvidenceClaim(JSON.stringify(artifact))) {
    errors.push(`${label} includes prohibited validation, approval, ranking, frequency, or safety language`);
  }
}

if (!evidenceCapsules.totals || evidenceCapsules.totals.records !== events.length) {
  errors.push("evidence-capsules totals.records must match event count");
}
if (!Array.isArray(evidenceCapsules.records) || evidenceCapsules.records.length !== events.length) {
  errors.push("evidence-capsules must include one capsule per event");
}
const capsuleIds = new Set();
for (const capsule of evidenceCapsules.records ?? []) {
  if (!eventIds.has(capsule.event_id)) errors.push(`evidence-capsules references unknown event ${capsule.event_id}`);
  if (capsuleIds.has(capsule.event_id)) errors.push(`evidence-capsules duplicate event ${capsule.event_id}`);
  capsuleIds.add(capsule.event_id);
  if (!capsule.import_family?.id || !capsule.locator_quality?.code) {
    errors.push(`evidence-capsules ${capsule.event_id} missing import family or locator quality`);
  }
  if (!capsule.source_basis || !Array.isArray(capsule.source_basis.source_ids)) {
    errors.push(`evidence-capsules ${capsule.event_id} missing source basis`);
  } else {
    for (const sourceId of capsule.source_basis.source_ids) {
      if (!sourceIds.has(sourceId)) errors.push(`evidence-capsules ${capsule.event_id} references unknown source ${sourceId}`);
    }
  }
  if (!Array.isArray(capsule.field_evidence) || capsule.field_evidence.length === 0) {
    errors.push(`evidence-capsules ${capsule.event_id} missing field evidence`);
  }
  for (const row of capsule.field_evidence ?? []) {
    if (!row.field || !row.support_level || !row.support_note) {
      errors.push(`evidence-capsules ${capsule.event_id} has incomplete field evidence row`);
    }
    for (const sourceId of row.source_ids ?? []) {
      if (!sourceIds.has(sourceId)) errors.push(`evidence-capsules ${capsule.event_id} field evidence references unknown source ${sourceId}`);
    }
  }
}

errors.push(...validateChallengeArtifacts({ standards: challengeStandards, queues: challengeQueues, ledger: challengeLedger, events, sources, corrections }));

for (const [label, artifact] of [
  ["Challenge standards", challengeStandards],
  ["Challenge queues", challengeQueues],
  ["Challenge ledger", challengeLedger]
]) {
  if (artifact.snapshot_id !== manifest.snapshot_id) {
    errors.push(`${label} snapshot_id must match snapshot manifest`);
  }
}
if (challengeStandards.generated_at !== manifest.created_at) {
  errors.push("Challenge standards generated_at must match snapshot manifest created_at");
}
if (challengeQueues.generated_at !== manifest.created_at) {
  errors.push("Challenge queues generated_at must match snapshot manifest created_at");
}
if (challengeLedger.updated_at !== manifest.created_at) {
  errors.push("Challenge ledger updated_at must match snapshot manifest created_at");
}
if (hasProhibitedChallengeClaim(JSON.stringify(challengeStandards))) errors.push("Challenge standards contain prohibited overclaiming language");
if (hasProhibitedChallengeClaim(JSON.stringify(challengeQueues))) errors.push("Challenge queues contain prohibited overclaiming language");
if (hasProhibitedChallengeClaim(JSON.stringify(challengeLedger))) errors.push("Challenge ledger contains prohibited overclaiming language");
if (challengeQueues.queue_count !== (challengeQueues.queues ?? []).length) {
  errors.push(`Challenge queues queue_count is ${challengeQueues.queue_count}, expected ${(challengeQueues.queues ?? []).length}`);
}
if (challengeQueues.packet_count !== (challengeQueues.packets ?? []).length) {
  errors.push(`Challenge queues packet_count is ${challengeQueues.packet_count}, expected ${(challengeQueues.packets ?? []).length}`);
}

errors.push(
  ...validateFlagshipArtifacts({
    report: flagshipReport,
    gold: goldRecordV1,
    events,
    schools,
    sources,
    challengeQueues,
    robustnessMetrics,
    manifest
  })
);

errors.push(...validateRecordQualityAudit({ audit: recordQualityAudit, events, goldRecordV1, manifest }));
errors.push(...validateRecordQualityReviewerPacket({ packet: recordQualityReviewerPacket, audit: recordQualityAudit, events, manifest }));
errors.push(...validateGoldV1CertificationStatus({ status: goldV1CertificationStatus, goldRecordV1, events, manifest }));
errors.push(
  ...validateExternalReviewPacket({
    packet: externalReviewPacket,
    events,
    sources,
    goldStatus: goldV1CertificationStatus,
    reviewDebtLedger,
    manifest
  })
);
errors.push(...validateCertificationLedger({ ledger: certificationLedger, events, manifest }));
errors.push(...validateEdDatasetProvenanceAudit({ audit: edDatasetProvenanceAudit, events, manifest }));
errors.push(...validateCertificationBatches({ batches: certificationBatches, certificationLedger }));
for (const [index, spec] of ED_CERTIFICATION_REVIEW_SPECS.entries()) {
  errors.push(
    ...validateEdCertificationBatchReview({
      review: edCertificationBatchReviews[index],
      events,
      certificationBatches,
      sourceBatchId: spec.sourceBatchId,
      reviewBatchId: spec.reviewBatchId,
      manifest
    })
  );
}
if (hasProhibitedRecordAuditClaim(JSON.stringify(recordQualityAudit))) {
  errors.push("record-quality-audit includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
}
if (hasProhibitedRecordAuditClaim(JSON.stringify(recordQualityReviewerPacket))) {
  errors.push("record-quality-reviewer-packet includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
}
if (hasProhibitedRecordAuditClaim(JSON.stringify(goldV1CertificationStatus))) {
  errors.push("gold-v1-certification-status includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
}
if (hasProhibitedExternalReviewClaim(JSON.stringify(externalReviewPacket))) {
  errors.push("external-review-packet includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
}

if (!Array.isArray(sourceProvenanceQueues.queues) || sourceProvenanceQueues.queues.length < 5) {
  errors.push("source-provenance-queues must include at least five queues");
}
for (const queue of sourceProvenanceQueues.queues ?? []) {
  if (!queue.id || !queue.label || !queue.description) {
    errors.push("source-provenance-queues queue missing id, label, or description");
  }
  if (!Array.isArray(queue.records) || queue.records.length > 25) {
    errors.push(`source-provenance-queues ${queue.id} must include no more than 25 records`);
  }
  for (const record of queue.records ?? []) {
    if (!eventIds.has(record.event_id)) errors.push(`source-provenance-queues ${queue.id} references unknown event ${record.event_id}`);
    if (!Array.isArray(record.review_needs) || record.review_needs.length === 0) {
      errors.push(`source-provenance-queues ${queue.id} record ${record.event_id} missing review_needs`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Data validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Data validation passed: ${events.length} events, ${schools.length} schools, ${sources.length} sources, ${corrections.length} corrections.`);
