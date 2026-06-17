import { sourceFamilyForRecord } from "./review-debt-ledger-lib.mjs";

const PROHIBITED_CERTIFICATION_PATTERN =
  /\b(?:safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|outside validated|externally validated|external audit|external validation|safety score|safety scoring|severity score|severity scoring|school ranking|prevalence estimate|estimates prevalence|frequency measurement|frequency measure|legal truth)\b/gi;

const GATE_DEFINITIONS = {
  source_availability: {
    label: "Source availability",
    blockerIssues: ["missing_linked_source", "missing_source_url", "live_source_check_not_ok"],
    reviewIssues: []
  },
  source_locator_specificity: {
    label: "Source locator specificity",
    blockerIssues: ["source_redirect_locator_risk"],
    reviewIssues: ["dataset_cell_locator_needed", "page_table_locator_needed", "aggregated_source_item_locator_needed"]
  },
  institution_support: {
    label: "Institution support",
    blockerIssues: [],
    reviewIssues: []
  },
  date_precision_support: {
    label: "Date precision support",
    blockerIssues: [],
    reviewIssues: ["year_precision_public_use_limit", "day_precision_from_mixed_date_source"]
  },
  category_fit: {
    label: "Category fit",
    blockerIssues: [],
    reviewIssues: ["category_may_be_too_generic_for_offense", "guidance_source_category_fit_review"]
  },
  affected_label_boundary: {
    label: "Affected-label boundary",
    blockerIssues: [],
    reviewIssues: ["broad_affected_community_label", "multi_community_label_boundary_review"]
  },
  response_depth_classification: {
    label: "Response-depth classification",
    blockerIssues: [],
    reviewIssues: ["no_public_response_stored", "thin_response_note"]
  },
  rationale_specificity: {
    label: "Rationale specificity",
    blockerIssues: [],
    reviewIssues: ["missing_explicit_rationales", "generic_or_generated_rationale", "high_stakes_record_needs_explicit_rationale"]
  },
  overclaim_risk: {
    label: "Overclaim risk",
    blockerIssues: [],
    reviewIssues: []
  }
};

const STATUS_MEANINGS = [
  {
    status: "certified",
    meaning:
      "Internal source-to-record certification status. Every deterministic gate passes and the record has an explicit certification basis such as Gold v1 review or a completed batch review."
  },
  {
    status: "not_certified",
    meaning:
      "The record was reviewed in a bounded certification process and did not satisfy every gate. It may remain public with visible limits, but it is not certified."
  },
  {
    status: "blocked",
    meaning: "A source or locator blocker prevents certification until repaired."
  },
  {
    status: "awaiting_review",
    meaning: "The record has an inspectable status, but one or more gates still need source-to-record review."
  }
];

const BATCH_001_LIMIT = 100;

function compact(items) {
  return (items ?? []).filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function sourceIdsResolve(event, sourcesById) {
  return (event.source_ids ?? []).length > 0 && event.source_ids.every((sourceId) => sourcesById.has(sourceId));
}

function hasRationales(event) {
  return ["classification_rationale", "community_rationale", "confidence_rationale"].every((field) => String(event[field] ?? "").trim().length >= 40);
}

function gateFromIssues(gateId, issueIds, event, sourcesById) {
  const definition = GATE_DEFINITIONS[gateId];
  const blockerIssue = definition.blockerIssues.find((issueId) => issueIds.includes(issueId));
  if (blockerIssue) {
    return {
      status: "block",
      detail: `${definition.label} has blocker issue ${blockerIssue}.`,
      required_action: "Repair the source or locator blocker before certification."
    };
  }

  const reviewIssue = definition.reviewIssues.find((issueId) => issueIds.includes(issueId));
  if (reviewIssue) {
    return {
      status: "review",
      detail: `${definition.label} has unresolved review issue ${reviewIssue}.`,
      required_action: actionForIssue(reviewIssue)
    };
  }

  if (gateId === "source_availability" && !sourceIdsResolve(event, sourcesById)) {
    return {
      status: "block",
      detail: "One or more linked source ids do not resolve in the source index.",
      required_action: "Repair linked source ids before certification."
    };
  }

  if (gateId === "institution_support" && (!event.school_id || !Array.isArray(event.source_ids) || event.source_ids.length === 0)) {
    return {
      status: "block",
      detail: "The record is missing school id or linked source ids.",
      required_action: "Repair record identity fields before certification."
    };
  }

  if (gateId === "rationale_specificity" && !hasRationales(event)) {
    return {
      status: "review",
      detail: "The record does not yet have source-specific classification, community, and confidence rationales.",
      required_action: "Add source-bounded rationales before certification."
    };
  }

  if (gateId === "overclaim_risk" && hasProhibitedCertificationClaim(JSON.stringify(event))) {
    return {
      status: "review",
      detail: "Record text contains language that may overstate what the dataset can show.",
      required_action: "Remove or qualify overclaiming language before certification."
    };
  }

  return {
    status: "pass",
    detail: `${definition.label} has no deterministic blocker in the current audit inputs.`,
    required_action: "No deterministic action required; source-to-record certification still depends on certification basis."
  };
}

function actionForIssue(issueId) {
  return (
    {
      dataset_cell_locator_needed: "Add workbook, sheet, row, column, and cell locator or keep the record awaiting review.",
      page_table_locator_needed: "Add page, table, section, or item locator before certification.",
      aggregated_source_item_locator_needed: "Add item-level source locator and item date before certification.",
      year_precision_public_use_limit: "Keep year precision visible or add a narrower source-supported date after direct review.",
      day_precision_from_mixed_date_source: "Verify the exact source item date before relying on day precision.",
      category_may_be_too_generic_for_offense: "Review source wording and narrow or qualify the category if needed.",
      guidance_source_category_fit_review: "Confirm the source directly supports the record category.",
      broad_affected_community_label: "Confirm the source supports the exact affected-community label boundary.",
      multi_community_label_boundary_review: "Confirm each affected-community label is supported at the same source-text level.",
      no_public_response_stored: "Search for a source-supported response or keep no-public-response status visible.",
      thin_response_note: "Keep limited-response depth visible unless a direct or agency-described response is sourced.",
      missing_explicit_rationales: "Add source-bounded classification, community, and confidence rationales.",
      generic_or_generated_rationale: "Replace generic rationale with source-specific wording during hand review.",
      high_stakes_record_needs_explicit_rationale: "Add unusually clear rationale for high-stakes category support."
    }[issueId] ?? "Resolve this gate before certification."
  );
}

function certificationBasis(goldStatus, edBatchReview) {
  if (goldStatus?.certification_status === "certified") return "gold_v1_internal_source_to_record_review";
  if (edBatchReview?.certification_status === "certified") return edBatchReview.certification_basis ?? null;
  return null;
}

function gateFromBatchReview(gateId, edBatchReview) {
  const reviewedGate = edBatchReview?.gate_reviews?.[gateId];
  if (!reviewedGate) return null;
  return {
    status: reviewedGate.status,
    detail: reviewedGate.detail,
    required_action: reviewedGate.required_action
  };
}

function statusForRow({ gates, goldStatus, edBatchReview, basis }) {
  const gateValues = Object.values(gates);
  if (edBatchReview?.certification_status === "blocked") return "blocked";
  if (edBatchReview?.certification_status === "not_certified") return "not_certified";
  if (gateValues.some((gate) => gate.status === "block") || goldStatus?.certification_status === "blocked") return "blocked";
  if (goldStatus?.certification_status === "not_certified") return "not_certified";
  if (basis && gateValues.every((gate) => gate.status === "pass")) return "certified";
  return "awaiting_review";
}

function nextActionForRow(row) {
  if (row.certification_status === "certified") return "No action required for internal certification status; continue normal periodic source checks.";
  if (row.certification_status === "blocked") return "Repair blocker gate before this record can be certified or routed as a review example.";
  if (row.certification_status === "not_certified") {
    return row.not_certified_reason
      ? `Not certified in bounded review: ${row.not_certified_reason}`
      : "Resolve the listed gate failures in a bounded certification batch before reconsidering.";
  }
  if (row.open_gates.includes("source_locator_specificity") && row.source_family === "ed_campus_safety_dataset") {
    return "Add workbook, sheet, row, column, and cell provenance before source-to-record certification.";
  }
  return "Review and resolve the listed open gates before certification.";
}

function certificationRow({ event, sourcesById, debtRow, goldStatus, edBatchReview }) {
  const issueIds = unique(debtRow?.issue_ids ?? []);
  const gates = Object.fromEntries(
    Object.keys(GATE_DEFINITIONS).map((gateId) => [
      gateId,
      gateFromBatchReview(gateId, edBatchReview) ?? gateFromIssues(gateId, issueIds, event, sourcesById)
    ])
  );
  const basis = certificationBasis(goldStatus, edBatchReview);
  const certificationStatus = statusForRow({ gates, goldStatus, edBatchReview, basis });
  const openGates = Object.entries(gates)
    .filter(([, gate]) => gate.status !== "pass")
    .map(([gateId]) => gateId);
  const row = {
    event_id: event.id,
    school_id: event.school_id,
    source_family: debtRow?.source_family ?? sourceFamilyForRecord(event, sourcesById),
    certification_status: certificationStatus,
    certification_basis: basis,
    batch_review_status: edBatchReview?.certification_status ?? null,
    not_certified_reason: edBatchReview?.not_certified_reason ?? null,
    blocked_reason: edBatchReview?.blocked_reason ?? null,
    source_locator: edBatchReview?.source_locator ?? null,
    review_debt_status: debtRow?.debt_status ?? "missing_review_debt_row",
    issue_ids: issueIds,
    open_gates: openGates,
    gates,
    event_url: debtRow?.event_url ?? `/events/${encodeURIComponent(event.id)}/`,
    workspace_url: debtRow?.workspace_url ?? `/research-workspace/?record_ids=${encodeURIComponent(event.id)}`,
    challenge_url: `/challenge/?record=${encodeURIComponent(event.id)}`
  };
  row.next_action = nextActionForRow(row);
  return row;
}

function edBatchReviewsByEventId({ edCertificationBatchReview, edCertificationBatchReviews }) {
  const artifacts = [];
  if (Array.isArray(edCertificationBatchReviews)) artifacts.push(...edCertificationBatchReviews);
  else if (edCertificationBatchReviews?.records) artifacts.push(edCertificationBatchReviews);
  if (edCertificationBatchReview?.records) artifacts.push(edCertificationBatchReview);

  const rowsByEventId = new Map();
  for (const artifact of artifacts) {
    for (const row of artifact.records ?? []) {
      if (rowsByEventId.has(row.event_id)) {
        throw new Error(`duplicate ED batch review row for ${row.event_id}`);
      }
      rowsByEventId.set(row.event_id, row);
    }
  }
  return rowsByEventId;
}

function sourceFamilyCertification(records) {
  const families = [...new Set(records.map((record) => record.source_family))].sort();
  return Object.fromEntries(
    families.map((family) => {
      const familyRecords = records.filter((record) => record.source_family === family);
      return [
        family,
        {
          records: familyRecords.length,
          status_counts: countValues(familyRecords.map((record) => record.certification_status)),
          open_gate_counts: countValues(familyRecords.flatMap((record) => record.open_gates))
        }
      ];
    })
  );
}

function buildBatch001(records, limit) {
  const batchRecords = records
    .filter((record) => record.source_family === "ed_campus_safety_dataset")
    .sort((a, b) => {
      const aOpen = a.open_gates.length;
      const bOpen = b.open_gates.length;
      return bOpen - aOpen || a.event_id.localeCompare(b.event_id);
    })
    .slice(0, limit)
    .map((record) => ({
      event_id: record.event_id,
      school_id: record.school_id,
      certification_status: record.certification_status,
      open_gates: record.open_gates,
      issue_ids: record.issue_ids,
      next_action: record.next_action,
      event_url: record.event_url,
      workspace_url: record.workspace_url,
      challenge_url: record.challenge_url
    }));

  return {
    id: "batch_001_ed_dataset_provenance_pilot",
    label: "Batch 001: ED dataset provenance pilot",
    source_family: "ed_campus_safety_dataset",
    limit,
    method:
      "Bounded pilot over ED Campus Safety dataset records. The pilot makes workbook/cell provenance gaps visible and does not certify records lacking source-cell support.",
    public_claim_limit:
      "Batch 001 is internal source-to-record triage. It is not manual certification for all dataset records, external validation, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.",
    status_counts: countValues(batchRecords.map((record) => record.certification_status)),
    open_gate_counts: countValues(batchRecords.flatMap((record) => record.open_gates)),
    records: batchRecords
  };
}

export function buildCertificationLedger({
  events,
  sources = [],
  reviewDebtLedger = {},
  goldV1CertificationStatus = {},
  edCertificationBatchReview = {},
  edCertificationBatchReviews = null,
  manifest = {},
  batchLimit = BATCH_001_LIMIT
}) {
  const sourcesById = sourceMap(sources);
  const debtByEventId = new Map((reviewDebtLedger.records ?? []).map((record) => [record.event_id, record]));
  const goldByEventId = new Map((goldV1CertificationStatus.records ?? []).map((record) => [record.event_id, record]));
  const edBatchByEventId = edBatchReviewsByEventId({ edCertificationBatchReview, edCertificationBatchReviews });
  const records = events
    .map((event) =>
      certificationRow({
        event,
        sourcesById,
        debtRow: debtByEventId.get(event.id),
        goldStatus: goldByEventId.get(event.id),
        edBatchReview: edBatchByEventId.get(event.id)
      })
    )
    .sort((a, b) => a.event_id.localeCompare(b.event_id));
  const certificationStatusCounts = countValues(records.map((record) => record.certification_status));

  return {
    id: "certification_ledger_v1",
    snapshot_id: manifest.snapshot_id ?? reviewDebtLedger.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? reviewDebtLedger.generated_at ?? "2026-06-03",
    status: "full_database_internal_certification_status",
    method:
      "Deterministic full-database certification ledger generated from event records, source metadata, review-debt rows, and Gold v1 certification status. It assigns explicit gate status for every record; it does not certify records without a complete gate pass and explicit internal certification basis.",
    public_claim_limit:
      "This ledger may be described as internal source-to-record certification triage. It must not be described as third-party review, external validation, institutional quality judgment, school ranking, safety scoring, severity scoring, prevalence measurement, or legal finding.",
    status_definitions: STATUS_MEANINGS,
    certification_gates: Object.entries(GATE_DEFINITIONS).map(([id, definition]) => ({ id, label: definition.label })),
    totals: {
      records: records.length,
      certified: certificationStatusCounts.certified ?? 0,
      not_certified: certificationStatusCounts.not_certified ?? 0,
      blocked: certificationStatusCounts.blocked ?? 0,
      awaiting_review: certificationStatusCounts.awaiting_review ?? 0,
      source_families: new Set(records.map((record) => record.source_family)).size,
      batch_001_records: Math.min(batchLimit, records.filter((record) => record.source_family === "ed_campus_safety_dataset").length)
    },
    certification_status_counts: certificationStatusCounts,
    source_family_certification: sourceFamilyCertification(records),
    open_gate_counts: countValues(records.flatMap((record) => record.open_gates)),
    batch_001: buildBatch001(records, batchLimit),
    records
  };
}

export function hasProhibitedCertificationClaim(value) {
  const text = String(value ?? "");
  PROHIBITED_CERTIFICATION_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PROHIBITED_CERTIFICATION_PATTERN)) {
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 220), match.index ?? 0).toLowerCase();
    const sameClause = prefix.slice(Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf(":")) + 1);
    if (/\b(?:not|no|nor|without|cannot|never|must not|is not|are not|does not|do not|rather than|instead of)\b/.test(sameClause)) continue;
    return true;
  }
  return false;
}

export function validateCertificationLedger({ ledger, events = [], manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const ledgerIds = new Set((ledger.records ?? []).map((record) => record.event_id));

  if (ledger.id !== "certification_ledger_v1") errors.push("certification-ledger id must be certification_ledger_v1");
  if (ledger.snapshot_id !== (manifest.snapshot_id ?? ledger.snapshot_id)) errors.push("certification-ledger snapshot_id must match snapshot manifest");
  if (ledger.generated_at !== (manifest.created_at ?? ledger.generated_at)) errors.push("certification-ledger generated_at must match snapshot manifest created_at");
  if (ledger.totals?.records !== events.length || (ledger.records ?? []).length !== events.length || ledgerIds.size !== eventIds.size) {
    errors.push("certification-ledger must include one row per event");
  }

  for (const event of events) {
    if (!ledgerIds.has(event.id)) errors.push(`certification-ledger missing event ${event.id}`);
  }

  const expectedGates = Object.keys(GATE_DEFINITIONS);
  for (const record of ledger.records ?? []) {
    if (!eventIds.has(record.event_id)) errors.push(`certification-ledger references unknown event ${record.event_id}`);
    if (!["certified", "not_certified", "blocked", "awaiting_review"].includes(record.certification_status)) {
      errors.push(`certification-ledger row ${record.event_id} has invalid certification_status`);
    }
    for (const gateId of expectedGates) {
      const gate = record.gates?.[gateId];
      if (!gate || !["pass", "review", "block"].includes(gate.status)) {
        errors.push(`certification-ledger row ${record.event_id} missing valid ${gateId} gate`);
      }
    }
    if (record.certification_status === "certified") {
      const nonPassingGate = Object.entries(record.gates ?? {}).find(([, gate]) => gate.status !== "pass");
      if (nonPassingGate) errors.push(`certification-ledger row ${record.event_id} is certified with non-passing gate ${nonPassingGate[0]}`);
      if (!record.certification_basis) errors.push(`certification-ledger row ${record.event_id} is certified without certification basis`);
    }
    if (!Array.isArray(record.open_gates) || !record.event_url || !record.workspace_url || !record.next_action) {
      errors.push(`certification-ledger row ${record.event_id} missing review metadata`);
    }
  }

  const statusCounts = countValues((ledger.records ?? []).map((record) => record.certification_status));
  for (const [status, count] of Object.entries(statusCounts)) {
    if (ledger.certification_status_counts?.[status] !== count) errors.push(`certification-ledger certification_status_counts mismatch for ${status}`);
  }

  const batchRecords = ledger.batch_001?.records ?? [];
  if (!ledger.batch_001 || ledger.batch_001.id !== "batch_001_ed_dataset_provenance_pilot") {
    errors.push("certification-ledger must include Batch 001 ED dataset provenance pilot");
  }
  if (batchRecords.length > (ledger.batch_001?.limit ?? BATCH_001_LIMIT)) {
    errors.push("certification-ledger Batch 001 exceeds configured limit");
  }
  for (const record of batchRecords) {
    const fullRecord = (ledger.records ?? []).find((candidate) => candidate.event_id === record.event_id);
    if (fullRecord?.source_family !== "ed_campus_safety_dataset") {
      errors.push(`certification-ledger Batch 001 contains non-ED-dataset record ${record.event_id}`);
    }
  }

  if (hasProhibitedCertificationClaim(JSON.stringify(ledger))) {
    errors.push("certification-ledger includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }

  return errors;
}
