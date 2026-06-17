const LANE_DEFINITIONS = [
  {
    id: "blocked_or_problem",
    label: "Blocked/problem records",
    matcher: (record) => record.certification_status === "blocked" || record.certification_status === "not_certified",
    completion_rule: "Every record must retain a final visible status with exact blocker or not-certified reason before reconsideration."
  },
  {
    id: "ed_dataset",
    label: "ED dataset records",
    matcher: (record) => record.source_family === "ed_campus_safety_dataset" && !["blocked", "not_certified"].includes(record.certification_status),
    completion_rule: "Every record must have a final visible status and exact gates; source-cell provenance is required before certification."
  },
  {
    id: "asr",
    label: "Annual security report records",
    matcher: (record) => record.source_family === "annual_security_report" && !["blocked", "not_certified"].includes(record.certification_status),
    completion_rule: "Every record must have page, table, section, or item locator review before certification."
  },
  {
    id: "ocr_or_government_release",
    label: "OCR or government release records",
    matcher: (record) =>
      ["ocr_or_ed_release", "government_release", "government_case_or_letter", "government_guidance"].includes(record.source_family) &&
      !["blocked", "not_certified"].includes(record.certification_status),
    completion_rule: "Every record must have item-level or document-section support and bounded legal/procedural wording."
  },
  {
    id: "university_statement",
    label: "University statement records",
    matcher: (record) => record.source_family === "university_statement" && !["blocked", "not_certified"].includes(record.certification_status),
    completion_rule: "Every record must preserve direct statement boundaries, response-depth classification, and source-supported labels."
  },
  {
    id: "public_notice_or_news",
    label: "Public notice or news-like records",
    matcher: (record) => ["campus_public_safety_notice", "news_report"].includes(record.source_family) && !["blocked", "not_certified"].includes(record.certification_status),
    completion_rule: "Every record must separate reported allegations, public notice wording, and direct institutional response."
  },
  {
    id: "other_public_source",
    label: "Other public-source records",
    matcher: (record) => true,
    completion_rule: "Every record must retain exact open gates and a final visible status before the batch is complete."
  }
];

function countValues(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function row(record) {
  return {
    event_id: record.event_id,
    school_id: record.school_id,
    source_family: record.source_family,
    certification_status: record.certification_status,
    open_gates: record.open_gates ?? [],
    issue_ids: record.issue_ids ?? [],
    event_url: record.event_url,
    workspace_url: record.workspace_url,
    challenge_url: record.challenge_url
  };
}

function chunks(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

function laneForRecord(record) {
  return LANE_DEFINITIONS.find((lane) => lane.matcher(record));
}

export function buildCertificationBatches({ certificationLedger, batchSize = 250 }) {
  const assigned = new Map(LANE_DEFINITIONS.map((lane) => [lane.id, []]));
  for (const record of certificationLedger.records ?? []) {
    const lane = laneForRecord(record);
    assigned.get(lane.id).push(record);
  }

  const lanes = {};
  const batches = [];
  for (const lane of LANE_DEFINITIONS) {
    const records = (assigned.get(lane.id) ?? []).sort((a, b) => {
      if (a.certification_status !== b.certification_status) return a.certification_status.localeCompare(b.certification_status);
      return (b.open_gates?.length ?? 0) - (a.open_gates?.length ?? 0) || a.event_id.localeCompare(b.event_id);
    });
    lanes[lane.id] = {
      id: lane.id,
      label: lane.label,
      records: records.length,
      status_counts: countValues(records.map((record) => record.certification_status)),
      open_gate_counts: countValues(records.flatMap((record) => record.open_gates ?? [])),
      completion_rule: lane.completion_rule
    };

    chunks(records, batchSize).forEach((recordsChunk, index) => {
      if (!recordsChunk.length) return;
      batches.push({
        id: `${lane.id}_batch_${String(index + 1).padStart(3, "0")}`,
        lane_id: lane.id,
        label: `${lane.label} batch ${index + 1}`,
        batch_size: batchSize,
        completion_rule: lane.completion_rule,
        status_counts: countValues(recordsChunk.map((record) => record.certification_status)),
        open_gate_counts: countValues(recordsChunk.flatMap((record) => record.open_gates ?? [])),
        records: recordsChunk.map(row)
      });
    });
  }

  return {
    id: "certification_batches_v1",
    snapshot_id: certificationLedger.snapshot_id,
    generated_at: certificationLedger.generated_at,
    status: "source_family_certification_batch_manifest",
    method:
      "Deterministic source-family batch manifest generated from the full certification ledger. Batches organize review work; they do not certify records by themselves.",
    public_claim_limit:
      "Batch membership is a review workflow label. It must not be described as external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal finding.",
    certification_standard_version: "certification_rules_v1",
    batch_size: batchSize,
    completion_rule:
      "A batch is complete only when every included record has a final visible status: certified, not_certified, blocked, or awaiting_review with exact open gates. Zero certifications is acceptable when sources do not support certification.",
    totals: {
      records: (certificationLedger.records ?? []).length,
      lanes: Object.keys(lanes).length,
      batches: batches.length
    },
    lanes,
    batches
  };
}

export function validateCertificationBatches({ batches, certificationLedger }) {
  const errors = [];
  const ledgerIds = new Set((certificationLedger.records ?? []).map((record) => record.event_id));
  const batchRows = (batches.batches ?? []).flatMap((batch) => batch.records ?? []);
  const batchIds = new Set(batchRows.map((record) => record.event_id));

  if (batches.id !== "certification_batches_v1") errors.push("certification-batches id must be certification_batches_v1");
  if (batches.snapshot_id !== certificationLedger.snapshot_id) errors.push("certification-batches snapshot_id must match certification ledger");
  if (batches.certification_standard_version !== "certification_rules_v1") errors.push("certification-batches must use certification_rules_v1");
  if (batchRows.length !== ledgerIds.size || batchIds.size !== ledgerIds.size) errors.push("certification-batches must include every certification-ledger record exactly once");
  for (const eventId of ledgerIds) {
    if (!batchIds.has(eventId)) errors.push(`certification-batches missing event ${eventId}`);
  }
  for (const batch of batches.batches ?? []) {
    if ((batch.records ?? []).length > batches.batch_size) errors.push(`certification-batches ${batch.id} exceeds batch size`);
    if (!batch.completion_rule || !batch.lane_id) errors.push(`certification-batches ${batch.id} missing lane or completion rule`);
    for (const record of batch.records ?? []) {
      if (!ledgerIds.has(record.event_id)) errors.push(`certification-batches ${batch.id} references unknown event ${record.event_id}`);
    }
  }
  return errors;
}
