import { createHash } from "node:crypto";

const BROAD_LABELS = new Set(["Race", "Religion", "National origin", "Ethnicity", "Gender"]);
const REVIEW_STATUSES = new Set(["not_started", "in_progress", "completed", "changes_requested", "superseded"]);
const REVIEW_TYPES = new Set(["internal", "external", "source_audit", "classification_audit", "methodology_audit"]);

const REVIEW_QUESTIONS = {
  low_confidence:
    "Does the current public source support the record strongly enough, or should confidence remain low, be raised, or be narrowed?",
  single_source:
    "Can an additional public source corroborate the record, or should the record remain explicitly single-source?",
  broad_label:
    "Is the affected-community label directly supported by source text, or should it be narrowed, removed, or explicitly justified?",
  missing_response:
    "Is a public institutional response available, or should the record clearly state that no response field is currently documented?",
  legal_or_ocr:
    "Does the legal/OCR wording track the public source without implying findings, liability, or procedural posture beyond the source?",
  source_audit_followup: "Does the linked source URL still resolve, redirect, or require replacement with a more stable public source?"
};

function sourceIdsForRecord(record) {
  if (Array.isArray(record.sources) && record.sources.length) return record.sources.map((source) => source.id);
  return record.source_ids ?? [];
}

function sourceAuditFollowupIds(sourceAuditLive) {
  return new Set(
    (sourceAuditLive?.entries ?? [])
      .filter((entry) => entry.live_status !== "ok" || entry.launch_check_status !== "live_checked")
      .map((entry) => entry.source_id)
  );
}

function isLegalOrOcr(record) {
  return /ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(
    `${record.category ?? ""} ${record.legal_status ?? ""} ${(record.tags ?? []).join(" ")}`
  );
}

function sampleSortKey(record, snapshotHash) {
  return createHash("sha256").update(`${snapshotHash}|${record.id}`).digest("hex");
}

function newestRecordFirst(a, b) {
  return String(b.date ?? "").localeCompare(String(a.date ?? "")) || String(b.id ?? "").localeCompare(String(a.id ?? ""));
}

function workspaceUrlForRecordIds(recordIds) {
  const url = new URL("/campus-evidence-lab/research-workspace/", "https://maximilian-kornstein.github.io");
  url.searchParams.set("records", recordIds.join(","));
  return url.pathname + url.search;
}

function checklistUrl(sampleId, sampleLabel, snapshotId) {
  const url = new URL("https://github.com/maximilian-kornstein/campus-evidence-lab/issues/new");
  url.searchParams.set("template", "reviewer-checklist.yml");
  url.searchParams.set("title", `Reviewer checklist: ${sampleLabel}`);
  url.searchParams.set("body", `${sampleLabel} review sample ${sampleId} generated from ${snapshotId}.`);
  return url.toString();
}

function recordSummary(record, sampleId, sampleLabel, snapshotId, sourceAuditLive) {
  const reasons = reasonCodesForRecord(record, sourceAuditLive);
  return {
    event_id: record.id,
    school_id: record.school_id,
    date: record.date,
    category: record.category,
    confidence: record.confidence,
    reason_codes: reasons,
    review_questions: reviewQuestionsForReasons(reasons),
    workspace_url: workspaceUrlForRecordIds([record.id]),
    checklist_url: checklistUrl(sampleId, sampleLabel, snapshotId)
  };
}

function sampleDefinition(id, label, description, records, snapshotHash, snapshotId, sourceAuditLive, limit = 25) {
  const selected = stableSample(records, limit, `${snapshotHash}|${id}`).sort(newestRecordFirst);
  return {
    id,
    label,
    description,
    limit,
    count: selected.length,
    workspace_url: workspaceUrlForRecordIds(selected.map((record) => record.id)),
    checklist_url: checklistUrl(id, label, snapshotId),
    records: selected.map((record) => recordSummary(record, id, label, snapshotId, sourceAuditLive))
  };
}

export function reasonCodesForRecord(record, sourceAuditLive = { entries: [] }) {
  const reasons = [];
  const sourceIds = sourceIdsForRecord(record);
  const auditFollowups = sourceAuditFollowupIds(sourceAuditLive);

  if (record.confidence === "Low") reasons.push("low_confidence");
  if (sourceIds.length <= 1) reasons.push("single_source");
  if ((record.affected_communities ?? []).some((community) => BROAD_LABELS.has(community))) reasons.push("broad_label");
  if (!record.institutional_response) reasons.push("missing_response");
  if (isLegalOrOcr(record)) reasons.push("legal_or_ocr");
  if (sourceIds.some((sourceId) => auditFollowups.has(sourceId))) reasons.push("source_audit_followup");

  return reasons;
}

export function reviewQuestionsForReasons(reasons) {
  return reasons.map((reason) => REVIEW_QUESTIONS[reason]).filter(Boolean);
}

export function stableSample(records, limit, snapshotHash) {
  return [...records]
    .sort((a, b) => sampleSortKey(a, snapshotHash).localeCompare(sampleSortKey(b, snapshotHash)) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

export function buildReviewSamples({ records, sourceAuditLive, snapshotId, snapshotHash }) {
  const lowConfidence = records.filter((record) => record.confidence === "Low");
  const singleSource = records.filter((record) => sourceIdsForRecord(record).length <= 1);
  const broadLabels = records.filter((record) => (record.affected_communities ?? []).some((community) => BROAD_LABELS.has(community)));
  const missingResponse = records.filter((record) => !record.institutional_response);
  const legalOrOcr = records.filter(isLegalOrOcr);
  const sourceFollowupIds = sourceAuditFollowupIds(sourceAuditLive);
  const sourceAuditFollowups = records.filter((record) => sourceIdsForRecord(record).some((sourceId) => sourceFollowupIds.has(sourceId)));

  const samples = [
    sampleDefinition("random-25", "Random 25", "Stable snapshot-bound random sample for broad record review.", records, snapshotHash, snapshotId, sourceAuditLive),
    sampleDefinition(
      "low-confidence-25",
      "Low-confidence 25",
      "Records whose confidence label should be checked against source support.",
      lowConfidence,
      snapshotHash,
      snapshotId,
      sourceAuditLive
    ),
    sampleDefinition(
      "single-source-25",
      "Single-source 25",
      "Records supported by one linked public source and useful for corroboration review.",
      singleSource,
      snapshotHash,
      snapshotId,
      sourceAuditLive
    ),
    sampleDefinition(
      "broad-label-25",
      "Broad-label 25",
      "Records with broad affected-community labels that should be checked against source text.",
      broadLabels,
      snapshotHash,
      snapshotId,
      sourceAuditLive
    ),
    sampleDefinition(
      "missing-response-25",
      "Missing-response 25",
      "Records where a public institutional response may need to be located or the absence kept explicit.",
      missingResponse,
      snapshotHash,
      snapshotId,
      sourceAuditLive
    ),
    sampleDefinition(
      "legal-ocr-25",
      "Legal/OCR 25",
      "Records whose legal or OCR wording should be reviewed for source-faithful restraint.",
      legalOrOcr,
      snapshotHash,
      snapshotId,
      sourceAuditLive
    ),
    sampleDefinition(
      "source-audit-followup-25",
      "Source-audit follow-up 25",
      "Records linked to source URLs flagged by the latest live source audit.",
      sourceAuditFollowups,
      snapshotHash,
      snapshotId,
      sourceAuditLive
    )
  ];

  return {
    version: "0.1.0",
    generated_at: "2026-06-16",
    snapshot_id: snapshotId,
    snapshot_hash: snapshotHash,
    method:
      "Samples are deterministic for the snapshot hash. They are review queues, not school rankings, prevalence estimates, or severity scores.",
    samples
  };
}

export function validateReviewLedger(ledger, sampleIds) {
  const errors = [];
  if (!ledger || typeof ledger !== "object") return ["review-ledger must be an object"];
  if (!ledger.version) errors.push("review-ledger missing version");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ledger.updated_at ?? "")) errors.push("review-ledger updated_at must use YYYY-MM-DD");
  if (!Array.isArray(ledger.entries)) {
    errors.push("review-ledger entries must be an array");
    return errors;
  }

  const seen = new Set();
  for (const entry of ledger.entries) {
    if (!entry.id) errors.push("review-ledger entry missing id");
    if (seen.has(entry.id)) errors.push(`review-ledger duplicate entry ${entry.id}`);
    seen.add(entry.id);
    if (!sampleIds.has(entry.sample_id)) errors.push(`review-ledger entry ${entry.id} has unknown sample_id ${entry.sample_id}`);
    if (!REVIEW_STATUSES.has(entry.status)) errors.push(`review-ledger entry ${entry.id} has invalid status ${entry.status}`);
    if (!REVIEW_TYPES.has(entry.review_type)) errors.push(`review-ledger entry ${entry.id} has invalid review_type ${entry.review_type}`);
    if (!Number.isInteger(entry.record_count) || entry.record_count < 0) errors.push(`review-ledger entry ${entry.id} has invalid record_count`);
    for (const field of ["resulting_correction_ids", "resulting_event_ids"]) {
      if (!Array.isArray(entry[field])) errors.push(`review-ledger entry ${entry.id} ${field} must be an array`);
    }
  }

  return errors;
}
