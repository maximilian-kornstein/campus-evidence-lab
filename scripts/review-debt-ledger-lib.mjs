const PROHIBITED_LEDGER_PATTERN =
  /\b(?:safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|outside validated|externally validated|external audit|external validation|safety score|safety scoring|severity score|severity scoring|school ranking|prevalence estimate|estimates prevalence|frequency measurement|frequency measure|legal truth)\b/gi;

const STATUS_ORDER = {
  blocked: 4,
  high_review_debt: 3,
  medium_review_debt: 2,
  low_review_debt: 1,
  lower_priority_review_debt: 0
};

const ISSUE_REASONS = {
  missing_linked_source: "Missing linked public source.",
  missing_source_url: "Missing source URL.",
  live_source_check_not_ok: "Live source check did not pass.",
  source_redirect_locator_risk: "Source URL redirects away from the cited locator.",
  dataset_cell_locator_needed: "Dataset-backed record needs workbook, table, row, or cell locator review.",
  page_table_locator_needed: "ASR or public notice record needs a stronger page, table, section, or item locator.",
  aggregated_source_item_locator_needed: "Aggregate or mixed-date source needs item-level locator review.",
  category_may_be_too_generic_for_offense: "Category may be broader than the source offense language.",
  guidance_source_category_fit_review: "Guidance-source category fit needs source review.",
  high_stakes_record_needs_explicit_rationale: "High-stakes category needs explicit source-bounded rationale.",
  broad_affected_community_label: "Affected-community label is broad enough to need source-text boundary review.",
  multi_community_label_boundary_review: "Multiple affected-community labels need source-text boundary review.",
  year_precision_public_use_limit: "Year-level date precision must remain visible in public use.",
  day_precision_from_mixed_date_source: "Day precision from mixed-date source needs item-date review.",
  no_public_response_stored: "No public institutional response text is stored.",
  thin_response_note: "Response text is a limited source-bound note, not necessarily direct institutional response.",
  missing_explicit_rationales: "Classification, community, or confidence rationale is missing.",
  generic_or_generated_rationale: "Rationale appears generic and needs source-specific review."
};

const QUEUE_DEFINITIONS = [
  {
    id: "blocked_records",
    label: "Blocked Records",
    description: "Records with source or locator blockers that should not be routed externally until repaired.",
    issueIds: ["missing_linked_source", "missing_source_url", "live_source_check_not_ok", "source_redirect_locator_risk"],
    matcher: (record) => record.debt_status === "blocked"
  },
  {
    id: "dataset_locator_debt",
    label: "Dataset Locator Debt",
    description: "Dataset-backed records needing workbook, table, row, or cell locator review.",
    issueIds: ["dataset_cell_locator_needed"]
  },
  {
    id: "asr_page_locator_debt",
    label: "ASR/Public Notice Locator Debt",
    description: "ASR or public notice records needing page, table, section, or item locator detail.",
    issueIds: ["page_table_locator_needed"]
  },
  {
    id: "ocr_aggregate_item_debt",
    label: "OCR/Aggregate Item Debt",
    description: "Aggregate or mixed-date source records needing item-level locator and date review.",
    issueIds: ["aggregated_source_item_locator_needed", "day_precision_from_mixed_date_source"]
  },
  {
    id: "label_boundary_debt",
    label: "Affected-Label Boundary Debt",
    description: "Records whose affected-community labels need source-text boundary review.",
    issueIds: ["broad_affected_community_label", "multi_community_label_boundary_review"]
  },
  {
    id: "rationale_debt",
    label: "Rationale Debt",
    description: "Records with missing, generic, or high-stakes rationale review needs.",
    issueIds: ["missing_explicit_rationales", "generic_or_generated_rationale", "high_stakes_record_needs_explicit_rationale"]
  },
  {
    id: "date_precision_debt",
    label: "Date Precision Debt",
    description: "Records whose date precision needs clearer source-supported boundaries.",
    issueIds: ["year_precision_public_use_limit", "day_precision_from_mixed_date_source"]
  },
  {
    id: "category_fit_debt",
    label: "Category-Fit Debt",
    description: "Records where category language may need source-wording review.",
    issueIds: ["category_may_be_too_generic_for_offense", "guidance_source_category_fit_review"]
  },
  {
    id: "response_depth_debt",
    label: "Response-Depth Debt",
    description: "Records where response text is missing, limited, or should not be read as a direct institutional response.",
    issueIds: ["thin_response_note", "no_public_response_stored"]
  }
];

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

function sourceText(source) {
  return `${source?.title ?? ""} ${source?.publisher ?? ""} ${source?.source_type ?? ""} ${source?.published_date ?? ""} ${source?.url ?? ""}`;
}

export function sourceFamilyForRecord(record, sourcesById = new Map()) {
  const linkedSources = (record.source_ids ?? []).map((sourceId) => sourcesById.get(sourceId)).filter(Boolean);
  const types = unique(linkedSources.map((source) => source.source_type).concat(record.source_types ?? []));
  const text = linkedSources.map(sourceText).join(" ");

  if (types.includes("Government dataset") || /Crime20\d{2}EXCEL|Campus Safety and Security Data Analysis/i.test(text)) {
    return "ed_campus_safety_dataset";
  }
  if (types.includes("Annual security report")) return "annual_security_report";
  if (types.includes("Public safety notice")) return "campus_public_safety_notice";
  if (/what'?s new|office for civil rights|ocr/i.test(text) && types.some((type) => /Government release|Government guidance|Government letter/i.test(type))) {
    return "ocr_or_ed_release";
  }
  if (types.includes("Government guidance")) return "government_guidance";
  if (types.some((type) => /Government letter|Government case/i.test(type))) return "government_case_or_letter";
  if (types.includes("University statement")) return "university_statement";
  if (types.includes("News report")) return "news_report";
  if (types.length === 1) return types[0].toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "other_public_source";
  return "mixed_or_other_public_source";
}

function debtStatusForAuditRow(row) {
  if (row.audit_status === "blocked_before_external_packet" || row.highest_severity === "blocker") return "blocked";
  if (row.highest_severity === "high" || row.audit_status === "needs_internal_review") return "high_review_debt";
  if (row.highest_severity === "medium" || row.audit_status === "usable_with_review_notes") return "medium_review_debt";
  if ((row.issue_count ?? 0) > 0) return "low_review_debt";
  return "lower_priority_review_debt";
}

function publicUseStatus(debtStatus) {
  return (
    {
      blocked: "do_not_route_externally_until_repaired",
      high_review_debt: "internal_review_required_before_reuse",
      medium_review_debt: "usable_only_with_review_notes",
      low_review_debt: "lower_priority_but_still_source_check_before_reuse",
      lower_priority_review_debt: "lower_priority_but_not_manually_certified"
    }[debtStatus] ?? "internal_review_required_before_reuse"
  );
}

function repairPriority(debtStatus, reviewScore) {
  return (STATUS_ORDER[debtStatus] ?? 0) * 100 + (Number(reviewScore) || 0);
}

function ledgerRecord({ event, auditRow, sourcesById }) {
  const debtStatus = debtStatusForAuditRow(auditRow);
  const issueIds = unique(auditRow.issue_ids ?? []);
  return {
    event_id: event.id,
    school_id: event.school_id,
    source_family: sourceFamilyForRecord(event, sourcesById),
    debt_status: debtStatus,
    public_use_status: publicUseStatus(debtStatus),
    issue_ids: issueIds,
    debt_reasons: issueIds.map((issueId) => ISSUE_REASONS[issueId] ?? `Review issue: ${issueId}`),
    repair_priority: repairPriority(debtStatus, auditRow.review_score),
    audit_status: auditRow.audit_status,
    highest_severity: auditRow.highest_severity,
    review_score: auditRow.review_score,
    source_types: auditRow.source_types ?? event.source_types ?? [],
    confidence: auditRow.confidence ?? event.confidence,
    date_precision: auditRow.date_precision ?? event.date_precision,
    response_depth: auditRow.response_depth ?? event.response_depth ?? null,
    source_count: auditRow.source_count ?? unique(event.source_ids ?? []).length,
    event_url: auditRow.event_url ?? `/events/${encodeURIComponent(event.id)}/`,
    workspace_url: auditRow.workspace_url ?? `/research-workspace/?record_ids=${encodeURIComponent(event.id)}`
  };
}

function rowSort(a, b) {
  return b.repair_priority - a.repair_priority || b.review_score - a.review_score || a.event_id.localeCompare(b.event_id);
}

function queueRows(records, definition, limit) {
  const issueIds = new Set(definition.issueIds ?? []);
  const rows = records.filter((record) => definition.matcher?.(record) ?? record.issue_ids.some((issueId) => issueIds.has(issueId)));
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    records: rows
      .slice()
      .sort(rowSort)
      .slice(0, limit)
      .map((record) => ({
        event_id: record.event_id,
        school_id: record.school_id,
        source_family: record.source_family,
        debt_status: record.debt_status,
        repair_priority: record.repair_priority,
        issue_ids: record.issue_ids,
        event_url: record.event_url,
        workspace_url: record.workspace_url,
        challenge_url: `/challenge/?record=${encodeURIComponent(record.event_id)}`
      }))
  };
}

function issueCounts(records) {
  return countValues(records.flatMap((record) => record.issue_ids));
}

function familyDebt(records) {
  const families = [...new Set(records.map((record) => record.source_family))].sort();
  return Object.fromEntries(
    families.map((family) => {
      const familyRecords = records.filter((record) => record.source_family === family);
      return [
        family,
        {
          records: familyRecords.length,
          status_counts: countValues(familyRecords.map((record) => record.debt_status)),
          top_issue_counts: Object.fromEntries(Object.entries(issueCounts(familyRecords)).slice(0, 10))
        }
      ];
    })
  );
}

export function buildReviewDebtLedger({ events, sources = [], audit, manifest = {}, queueLimit = 100 }) {
  const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));
  const auditByEventId = new Map((audit.records ?? []).map((record) => [record.event_id, record]));
  const records = events.map((event) => {
    const auditRow = auditByEventId.get(event.id) ?? {
      event_id: event.id,
      school_id: event.school_id,
      audit_status: "blocked_before_external_packet",
      review_score: 4,
      highest_severity: "blocker",
      issue_count: 1,
      issue_ids: ["missing_audit_row"],
      source_types: event.source_types ?? [],
      confidence: event.confidence,
      date_precision: event.date_precision,
      response_depth: event.response_depth
    };
    return ledgerRecord({ event, auditRow, sourcesById });
  });

  const queues = Object.fromEntries(QUEUE_DEFINITIONS.map((definition) => [definition.id, queueRows(records, definition, queueLimit)]));
  const sourceFamilyCounts = countValues(records.map((record) => record.source_family));
  const debtStatusCounts = countValues(records.map((record) => record.debt_status));

  return {
    id: "review_debt_ledger_v1",
    snapshot_id: manifest.snapshot_id ?? audit.snapshot_id ?? "unversioned",
    generated_at: manifest.created_at ?? audit.generated_at ?? "2026-06-03",
    status: "whole_database_review_debt_ledger",
    method:
      "Deterministic whole-database review-debt ledger generated from record-quality audit rows, linked source metadata, source families, and source-locator checks. It makes review debt inspectable; it is not manual certification, outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.",
    public_claim_limit:
      "This ledger may be described as deterministic internal review-debt triage. It must not be described as third-party review, external validation, institutional quality judgment, school ranking, safety scoring, severity scoring, prevalence measurement, or legal finding.",
    status_definitions: [
      {
        status: "blocked",
        meaning: "A source or locator blocker is present; repair before external routing."
      },
      {
        status: "high_review_debt",
        meaning: "At least one high-priority source, category, date, or rationale issue needs internal review."
      },
      {
        status: "medium_review_debt",
        meaning: "The record is usable only with visible review notes and source-bound limits."
      },
      {
        status: "low_review_debt",
        meaning: "A lower-priority deterministic issue remains."
      },
      {
        status: "lower_priority_review_debt",
        meaning: "No deterministic issue was detected, but the record is not manually certified by this ledger."
      }
    ],
    totals: {
      records: records.length,
      source_families: Object.keys(sourceFamilyCounts).length,
      blocked: debtStatusCounts.blocked ?? 0,
      high_review_debt: debtStatusCounts.high_review_debt ?? 0,
      medium_review_debt: debtStatusCounts.medium_review_debt ?? 0,
      low_review_debt: debtStatusCounts.low_review_debt ?? 0,
      lower_priority_review_debt: debtStatusCounts.lower_priority_review_debt ?? 0,
      queue_records_available: Object.values(queues).reduce((sum, queue) => sum + queue.records.length, 0)
    },
    debt_status_counts: debtStatusCounts,
    source_family_counts: sourceFamilyCounts,
    source_family_debt: familyDebt(records),
    issue_counts: issueCounts(records),
    safe_repair_policy: {
      applied_batch_repairs: [],
      deferred_batch_repairs: [
        "Do not mass-certify dataset records without workbook, sheet, row, column, or cell locators.",
        "Do not mass-upgrade ASR records without page, table, section, or item locators.",
        "Do not mass-upgrade aggregate OCR records without item-level locator and date review.",
        "Do not rewrite broad affected-community labels without source-text boundary review.",
        "Do not convert limited response notes into direct institutional responses without source support."
      ],
      rule: "This wave assigns inspectable debt status and queues; it does not change record facts unless a source-supported repair is made in a bounded follow-up."
    },
    queues,
    records: records.sort((a, b) => a.event_id.localeCompare(b.event_id))
  };
}

export function hasProhibitedReviewDebtClaim(value) {
  const text = String(value ?? "");
  PROHIBITED_LEDGER_PATTERN.lastIndex = 0;
  for (const match of text.matchAll(PROHIBITED_LEDGER_PATTERN)) {
    const prefix = text.slice(Math.max(0, (match.index ?? 0) - 220), match.index ?? 0).toLowerCase();
    const sameClause = prefix.slice(Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf(";"), prefix.lastIndexOf(":")) + 1);
    if (/\b(?:not|no|nor|without|cannot|never|must not|is not|are not|does not|do not)\b/.test(sameClause)) continue;
    return true;
  }
  return false;
}

export function validateReviewDebtLedger({ ledger, events = [], manifest = {} }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const ledgerIds = new Set((ledger.records ?? []).map((record) => record.event_id));

  if (ledger.id !== "review_debt_ledger_v1") errors.push("review-debt-ledger id must be review_debt_ledger_v1");
  if (ledger.snapshot_id !== (manifest.snapshot_id ?? ledger.snapshot_id)) errors.push("review-debt-ledger snapshot_id must match snapshot manifest");
  if (ledger.generated_at !== (manifest.created_at ?? ledger.generated_at)) errors.push("review-debt-ledger generated_at must match snapshot manifest created_at");
  if (ledger.totals?.records !== events.length || (ledger.records ?? []).length !== events.length || ledgerIds.size !== eventIds.size) {
    errors.push("review-debt-ledger must include one row per event");
  }

  for (const event of events) {
    if (!ledgerIds.has(event.id)) errors.push(`review-debt-ledger missing event ${event.id}`);
  }

  for (const record of ledger.records ?? []) {
    if (!eventIds.has(record.event_id)) errors.push(`review-debt-ledger references unknown event ${record.event_id}`);
    if (!record.source_family || !record.debt_status || !record.public_use_status) {
      errors.push(`review-debt-ledger row ${record.event_id} missing family, debt status, or public-use status`);
    }
    if (!Array.isArray(record.issue_ids) || !Array.isArray(record.debt_reasons)) {
      errors.push(`review-debt-ledger row ${record.event_id} missing issue ids or debt reasons`);
    }
    if (!record.event_url || !record.workspace_url) errors.push(`review-debt-ledger row ${record.event_id} missing review URLs`);
  }

  if (!ledger.queues || Object.keys(ledger.queues).length < QUEUE_DEFINITIONS.length) {
    errors.push("review-debt-ledger must include all required queues");
  }

  const statusCounts = countValues((ledger.records ?? []).map((record) => record.debt_status));
  for (const [status, count] of Object.entries(statusCounts)) {
    if (ledger.debt_status_counts?.[status] !== count) errors.push(`review-debt-ledger debt_status_counts mismatch for ${status}`);
  }

  if (hasProhibitedReviewDebtClaim(JSON.stringify(ledger))) {
    errors.push("review-debt-ledger includes prohibited validation, ranking, safety, frequency, endorsement, or legal-truth language");
  }

  return errors;
}
