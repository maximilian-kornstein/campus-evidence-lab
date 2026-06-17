const DEFAULT_SOURCE_BATCH_ID = "ed_dataset_batch_001";
const DEFAULT_REVIEW_BATCH_ID = "ed_dataset_batch_001";
const STANDARD_VERSION = "certification_rules_v1";

const BIAS_LABELS = {
  rac: "Race",
  rel: "Religion",
  sex: "LGBTQ+",
  gen: "Gender",
  gid: "LGBTQ+",
  dis: "Students with disabilities",
  et: "Ethnicity",
  nat: "National origin"
};

const OFFENSE_LABELS = {
  "agg-a": "Aggravated assault",
  arson: "Arson",
  burgla: "Burglary",
  fond: "Fondling",
  intim: "Intimidation",
  "lar-t": "Larceny-theft",
  murd: "Murder/non-negligent manslaughter",
  rape: "Rape",
  robbe: "Robbery",
  "sim-a": "Simple assault",
  vandal: "Destruction/damage/vandalism",
  vehic: "Motor vehicle theft"
};

const GATE_ORDER = [
  "source_availability",
  "source_locator_specificity",
  "institution_support",
  "date_precision_support",
  "category_fit",
  "affected_label_boundary",
  "response_depth_classification",
  "rationale_specificity",
  "overclaim_risk"
];

const PROHIBITED_CERTIFICATION_PATTERN =
  /\b(?:safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|outside validated|externally validated|external audit|external validation|safety score|safety scoring|severity score|severity scoring|school ranking|prevalence estimate|estimates prevalence|frequency measurement|frequency measure|legal truth)\b/gi;

function reviewNumber(reviewBatchId) {
  return String(reviewBatchId ?? "").match(/_(\d{3})$/)?.[1] ?? "001";
}

function artifactIdForReviewBatch(reviewBatchId) {
  return `ed_certification_batch_${reviewNumber(reviewBatchId)}_review_v1`;
}

function certificationBasisForReviewBatch(reviewBatchId) {
  return `${reviewBatchId}_internal_source_to_record_review`;
}

function reviewLabel(reviewBatchId) {
  return `Batch ${reviewNumber(reviewBatchId)}`;
}

function compact(items) {
  return (items ?? []).filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function codeTagForEvent(event) {
  return (event?.tags ?? []).find((tag) => /^.+?-(rac|rel|sex|gen|gid|dis|et|nat)\d{2}$/i.test(tag)) ?? null;
}

function offenseKeyForCodeTag(codeTag) {
  return String(codeTag ?? "")
    .toLowerCase()
    .replace(/-(rac|rel|sex|gen|gid|dis|et|nat)\d{2}$/i, "");
}

function biasKeyForCodeTag(codeTag) {
  return String(codeTag ?? "").toLowerCase().match(/-(rac|rel|sex|gen|gid|dis|et|nat)\d{2}$/i)?.[1] ?? null;
}

function yearForCodeTag(codeTag) {
  const suffix = String(codeTag ?? "").match(/(\d{2})$/)?.[1];
  return suffix ? `20${suffix}` : null;
}

export function categoryForCodeTag(codeTag) {
  const offenseKey = offenseKeyForCodeTag(codeTag);
  const offense = OFFENSE_LABELS[offenseKey] ?? offenseKey;
  if (/vandalism|destruction|damage/i.test(offense)) return "Vandalism";
  if (/assault|intimidation|threat|harassment/i.test(offense)) return "Harassment or threat";
  return "Other source-backed civil rights event";
}

export function affectedCommunityForCodeTag(codeTagOrBiasKey) {
  const key = String(codeTagOrBiasKey ?? "").includes("-") ? biasKeyForCodeTag(codeTagOrBiasKey) : String(codeTagOrBiasKey ?? "").toLowerCase();
  return BIAS_LABELS[key] ?? null;
}

export function offenseForCodeTag(codeTag) {
  return OFFENSE_LABELS[offenseKeyForCodeTag(codeTag)] ?? offenseKeyForCodeTag(codeTag);
}

function hasProhibitedClaim(value) {
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

function gate(status, detail, requiredAction = "No deterministic action required for this reviewed gate.") {
  return { status, detail, required_action: requiredAction };
}

function sourceText(event, provenance) {
  const codeTag = provenance?.code_tag ?? codeTagForEvent(event);
  const offense = offenseForCodeTag(codeTag);
  const affected = affectedCommunityForCodeTag(codeTag);
  return { codeTag, offense, affected };
}

function sourceLocatorGate(provenance) {
  if (provenance?.provenance_status === "matched" && provenance.locator?.cell) {
    return gate(
      "pass",
      `Matched official ED workbook cell ${provenance.locator.cell} in ${provenance.locator.workbook}, ${provenance.locator.sheet} row ${provenance.locator.row}, column ${provenance.locator.column}.`
    );
  }
  return gate(
    "block",
    provenance?.unresolved_reason ?? "No matched official ED workbook cell is available for this batch-review row.",
    "Keep blocked until workbook, sheet, row, column, and cell provenance is resolved."
  );
}

function gateReviews({ event, batchRow, provenance }) {
  if (!event) {
    return Object.fromEntries(GATE_ORDER.map((gateId) => [gateId, gate("block", "The batch row does not resolve to an event record.", "Repair batch coverage before certification.")]));
  }

  const { codeTag, offense, affected } = sourceText(event, provenance);
  const expectedCategory = categoryForCodeTag(codeTag);
  const expectedYear = provenance?.source_year ?? yearForCodeTag(codeTag);
  const actualYear = String(event.date ?? "").slice(0, 4);
  const locatorGate = sourceLocatorGate(provenance);
  const exactAffected = Array.isArray(event.affected_communities) && event.affected_communities.length === 1 && event.affected_communities[0] === affected;
  const limitedResponseText = /does not independently evaluate investigative, disciplinary, or institutional response outcomes/i.test(event.institutional_response ?? "");
  const responseDepth = event.response_depth ?? "limited_public_response_note";

  return {
    source_availability:
      Array.isArray(event.source_ids) && event.source_ids.length > 0
        ? gate("pass", "The event retains linked ED dataset source ids for source availability review.")
        : gate("block", "The event has no linked source id.", "Repair source ids before certification."),
    source_locator_specificity: locatorGate,
    institution_support:
      event.school_id && (!batchRow?.school_id || batchRow.school_id === event.school_id) && (!provenance?.school_id || provenance.school_id === event.school_id)
        ? gate("pass", `The batch row, event record, and ED provenance row use school id ${event.school_id}.`)
        : gate("block", "The batch row, event record, and ED provenance row do not agree on institution identity.", "Resolve institution identity before certification."),
    date_precision_support:
      event.date_precision === "year" && actualYear === expectedYear
        ? gate("pass", `The record keeps year precision visible and the ED source-cell year is ${expectedYear}.`)
        : gate("review", "The event date precision or year does not match the ED source-cell year.", "Keep not certified until date precision is corrected or source-supported."),
    category_fit:
      event.category === expectedCategory
        ? gate("pass", `The source offense ${offense} maps to the stored category ${event.category}.`)
        : gate("review", `The source offense ${offense} maps to ${expectedCategory}, not the stored category ${event.category}.`, "Keep not certified until category wording is repaired or separately justified."),
    affected_label_boundary: exactAffected
      ? gate("pass", `The ED bias code maps directly to the stored affected-community label ${affected}.`)
      : gate(
          "review",
          `The ED bias code maps to ${affected ?? "an unresolved label"}, while the event stores ${compact(event.affected_communities).join(", ") || "no affected-community label"}.`,
          "Keep not certified until the affected-community label exactly matches source support."
        ),
    response_depth_classification:
      responseDepth === "limited_public_response_note" && limitedResponseText
        ? gate("pass", "The stored response text is classified as a limited public response note, not as a direct institutional response.")
        : gate("review", "The response-depth classification is missing or stronger than the stored ED dataset response note supports.", "Keep not certified until response depth is corrected."),
    rationale_specificity:
      locatorGate.status === "pass" && codeTag && expectedCategory && affected
        ? gate("pass", "The batch review supplies source-specific category, community, and confidence rationales tied to the ED workbook cell.")
        : gate("review", "Source-specific rationales cannot be completed without matched code-tag and source-cell support.", "Keep not certified until source-specific rationales can be supplied."),
    overclaim_risk: hasProhibitedClaim(JSON.stringify(event))
      ? gate("review", "Event text contains language that could overstate what the ED dataset can show.", "Remove or qualify overclaiming language before certification.")
      : gate("pass", "No prohibited endorsement, ranking, scoring, prevalence, or legal-truth language was detected in event text.")
  };
}

function statusForGateReviews(gates) {
  const statuses = Object.values(gates).map((gateReview) => gateReview.status);
  if (statuses.includes("block")) return "blocked";
  if (statuses.every((status) => status === "pass")) return "certified";
  return "not_certified";
}

function firstReason(gates, status) {
  const entry = Object.entries(gates).find(([, gateReview]) => gateReview.status === status);
  return entry ? `${entry[0]}: ${entry[1].detail}` : null;
}

function rationaleFields({ event, provenance }) {
  const codeTag = provenance?.code_tag ?? codeTagForEvent(event);
  const offense = offenseForCodeTag(codeTag);
  const affected = affectedCommunityForCodeTag(codeTag);
  const locator = provenance?.locator?.locator ?? "unresolved ED workbook cell";
  return {
    classification_rationale: `The ED source-cell code ${provenance?.expected_column ?? codeTag} is for ${offense}; the stored category is certified only when that source offense maps directly to the public category.`,
    community_rationale: `The affected-community label is certified only when the ED bias-code suffix in ${codeTag} maps directly to ${affected}; no broader affected label is inferred.`,
    confidence_rationale: `Certification confidence is limited to source-to-record support from ${locator}. It is not a severity rating, prevalence estimate, safety score, or legal finding.`
  };
}

function reviewedRecord({ event, batchRow, provenance, reviewBatchId }) {
  const certificationBasis = certificationBasisForReviewBatch(reviewBatchId);
  const gates = gateReviews({ event, batchRow, provenance });
  const certificationStatus = statusForGateReviews(gates);
  const openGates = Object.entries(gates)
    .filter(([, gateReview]) => gateReview.status !== "pass")
    .map(([gateId]) => gateId);
  const rationales = event && provenance ? rationaleFields({ event, provenance }) : {};
  return {
    event_id: batchRow.event_id,
    school_id: event?.school_id ?? batchRow.school_id ?? provenance?.school_id ?? null,
    source_family: "ed_campus_safety_dataset",
    review_batch_id: reviewBatchId,
    certification_standard_version: STANDARD_VERSION,
    certification_status: certificationStatus,
    certification_basis: certificationStatus === "certified" ? certificationBasis : null,
    not_certified_reason: certificationStatus === "not_certified" ? firstReason(gates, "review") : null,
    blocked_reason: certificationStatus === "blocked" ? firstReason(gates, "block") : null,
    source_locator: provenance?.provenance_status === "matched" ? provenance.locator : null,
    provenance_status: provenance?.provenance_status ?? "missing",
    code_tag: provenance?.code_tag ?? codeTagForEvent(event),
    expected_column: provenance?.expected_column ?? null,
    expected_count: provenance?.expected_count ?? null,
    source_year: provenance?.source_year ?? null,
    open_gates: openGates,
    gate_reviews: gates,
    source_specific_rationales: rationales,
    next_action:
      certificationStatus === "certified"
        ? "No certification action required for this batch-review version; continue normal periodic source checks."
        : certificationStatus === "blocked"
          ? "Repair the blocker gate before this record can be certified."
          : "Resolve the listed review gates before reconsidering certification.",
    event_url: `/events/${encodeURIComponent(batchRow.event_id)}/`,
    workspace_url: `/research-workspace/?record_ids=${encodeURIComponent(batchRow.event_id)}`,
    challenge_url: `/challenge/?record=${encodeURIComponent(batchRow.event_id)}`
  };
}

export function buildEdCertificationBatchReview({
  events,
  certificationBatches,
  edDatasetProvenanceAudit,
  manifest = {},
  batchId = DEFAULT_SOURCE_BATCH_ID,
  sourceBatchId = batchId,
  reviewBatchId = DEFAULT_REVIEW_BATCH_ID,
  existingReview = null
}) {
  const batch = (certificationBatches.batches ?? []).find((candidate) => candidate.id === sourceBatchId);
  if (!batch) throw new Error(`Missing certification batch ${sourceBatchId}`);
  const eventsById = new Map((events ?? []).map((event) => [event.id, event]));
  const provenanceById = new Map((edDatasetProvenanceAudit.records ?? []).map((record) => [record.event_id, record]));
  const artifactId = artifactIdForReviewBatch(reviewBatchId);
  const existingRows =
    existingReview?.id === artifactId && existingReview?.review_batch_id === reviewBatchId
      ? (existingReview.records ?? []).map((record) => ({ event_id: record.event_id, school_id: record.school_id }))
      : null;
  const selectedRows = existingRows?.length ? existingRows : (batch.records ?? []);
  const records = selectedRows
    .map((batchRow) =>
      reviewedRecord({
        event: eventsById.get(batchRow.event_id),
        batchRow,
        provenance: provenanceById.get(batchRow.event_id),
        reviewBatchId
      })
    )
    .sort((a, b) => a.event_id.localeCompare(b.event_id));

  return {
    id: artifactId,
    snapshot_id: manifest.snapshot_id ?? certificationBatches.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? certificationBatches.generated_at ?? "2026-06-03",
    review_batch_id: reviewBatchId,
    source_batch_id: sourceBatchId,
    status: "bounded_internal_source_to_record_review",
    certification_standard_version: STANDARD_VERSION,
    selection_method: `Frozen from the existing ED ${reviewLabel(reviewBatchId)} review artifact so repeated generation cannot silently expand the certified set.`,
    method:
      `Deterministic ${reviewLabel(reviewBatchId)} review for ED Campus Safety dataset records. It uses current event fields, the ED source-cell provenance audit, and certification_rules_v1 gates. Matched source cells are necessary but not sufficient for certification.`,
    public_claim_limit:
      "This artifact is internal source-to-record review. It must not be described as third-party review, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal finding.",
    completion_rule:
      "Every included record receives a visible status. A certified status requires every gate to pass and an explicit batch-review certification basis; unresolved source-cell locators are blocked.",
    totals: {
      records: records.length,
      certified: records.filter((record) => record.certification_status === "certified").length,
      not_certified: records.filter((record) => record.certification_status === "not_certified").length,
      blocked: records.filter((record) => record.certification_status === "blocked").length,
      awaiting_review: 0
    },
    status_counts: countValues(records.map((record) => record.certification_status)),
    open_gate_counts: countValues(records.flatMap((record) => record.open_gates)),
    provenance_status_counts: countValues(records.map((record) => record.provenance_status)),
    records
  };
}

export function validateEdCertificationBatchReview({
  review,
  events = [],
  certificationBatches = {},
  manifest = {},
  batchId = DEFAULT_SOURCE_BATCH_ID,
  sourceBatchId = batchId,
  reviewBatchId = DEFAULT_REVIEW_BATCH_ID
}) {
  const errors = [];
  const batch = (certificationBatches.batches ?? []).find((candidate) => candidate.id === sourceBatchId);
  const usesFrozenSelection = /^Frozen from the existing ED Batch \d+ review artifact/.test(review.selection_method ?? "");
  const batchIds = new Set((batch?.records ?? []).map((record) => record.event_id));
  const reviewIds = new Set((review.records ?? []).map((record) => record.event_id));
  const eventIds = new Set((events ?? []).map((event) => event.id));
  const artifactId = artifactIdForReviewBatch(reviewBatchId);
  const expectedBasis = certificationBasisForReviewBatch(reviewBatchId);

  if (review.id !== artifactId) errors.push(`ed certification batch review id must be ${artifactId}`);
  if (review.snapshot_id !== (manifest.snapshot_id ?? review.snapshot_id)) errors.push("ed certification batch review snapshot_id must match snapshot manifest");
  if (review.generated_at !== (manifest.created_at ?? review.generated_at)) errors.push("ed certification batch review generated_at must match snapshot manifest");
  if (review.review_batch_id !== reviewBatchId) errors.push(`ed certification batch review must target ${reviewBatchId}`);
  if (review.source_batch_id !== sourceBatchId) errors.push(`ed certification batch review source_batch_id must be ${sourceBatchId}`);
  if (review.certification_standard_version !== STANDARD_VERSION) errors.push(`ed certification batch review must use ${STANDARD_VERSION}`);
  if (!review.selection_method) errors.push("ed certification batch review missing selection_method");
  if (!batch && !usesFrozenSelection) errors.push(`ed certification batch review missing source batch ${sourceBatchId}`);
  if (reviewIds.size !== (review.records ?? []).length || (review.records ?? []).length === 0) {
    errors.push("ed certification batch review must include unique reviewed records");
  }
  if (!usesFrozenSelection && ((review.records ?? []).length !== batchIds.size || reviewIds.size !== batchIds.size)) {
    errors.push("ed certification batch review must include one row per batch record");
  }

  if (!usesFrozenSelection) {
    for (const eventId of batchIds) {
      if (!reviewIds.has(eventId)) errors.push(`ed certification batch review missing batch event ${eventId}`);
    }
  }

  for (const record of review.records ?? []) {
    if (!usesFrozenSelection && !batchIds.has(record.event_id)) errors.push(`ed certification batch review references event outside batch ${record.event_id}`);
    if (!eventIds.has(record.event_id)) errors.push(`ed certification batch review references unknown event ${record.event_id}`);
    if (!["certified", "not_certified", "blocked"].includes(record.certification_status)) {
      errors.push(`ed certification batch review row ${record.event_id} has invalid status`);
    }
    if (record.review_batch_id !== reviewBatchId) errors.push(`ed certification batch review row ${record.event_id} has wrong review_batch_id`);
    for (const gateId of GATE_ORDER) {
      const gateReview = record.gate_reviews?.[gateId];
      if (!gateReview || !["pass", "review", "block"].includes(gateReview.status) || !gateReview.detail || !gateReview.required_action) {
        errors.push(`ed certification batch review row ${record.event_id} missing valid ${gateId} gate review`);
      }
    }
    if (record.certification_status === "certified") {
      if (record.certification_basis !== expectedBasis) errors.push(`ed certification batch review row ${record.event_id} certified without batch basis`);
      const failingGate = Object.entries(record.gate_reviews ?? {}).find(([, gateReview]) => gateReview.status !== "pass");
      if (failingGate) errors.push(`ed certification batch review row ${record.event_id} certified with non-passing gate ${failingGate[0]}`);
      if (!record.source_locator?.cell) errors.push(`ed certification batch review row ${record.event_id} certified without source cell locator`);
    }
    if (record.certification_status === "not_certified" && !record.not_certified_reason) {
      errors.push(`ed certification batch review row ${record.event_id} is not_certified without reason`);
    }
    if (record.certification_status === "blocked" && !record.blocked_reason) {
      errors.push(`ed certification batch review row ${record.event_id} is blocked without reason`);
    }
  }

  const statusCounts = countValues((review.records ?? []).map((record) => record.certification_status));
  for (const [status, count] of Object.entries(statusCounts)) {
    if (review.status_counts?.[status] !== count) errors.push(`ed certification batch review status_counts mismatch for ${status}`);
  }
  if (hasProhibitedClaim(JSON.stringify(review))) {
    errors.push("ed certification batch review includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }

  return errors;
}
