import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewDebtLedger,
  sourceFamilyForRecord,
  validateReviewDebtLedger
} from "../scripts/review-debt-ledger-lib.mjs";

const sources = [
  {
    id: "src_dataset",
    title: "Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files",
    publisher: "U.S. Department of Education Office of Postsecondary Education",
    source_type: "Government dataset",
    published_date: "2026-04-30",
    url: "https://example.edu/Crime2025EXCEL.zip"
  },
  {
    id: "src_asr",
    title: "Annual Security Report",
    publisher: "Example University",
    source_type: "Annual security report",
    published_date: "2025-10-01",
    url: "https://example.edu/asr.pdf"
  },
  {
    id: "src_ocr_mixed",
    title: "What's New in OCR",
    publisher: "U.S. Department of Education Office for Civil Rights",
    source_type: "Government release",
    published_date: "Mixed",
    url: "https://example.edu/ocr"
  },
  {
    id: "src_statement",
    title: "Campus response update",
    publisher: "Example University",
    source_type: "University statement",
    published_date: "2025-02-01",
    url: "https://example.edu/update"
  }
];

const events = [
  {
    id: "evt_dataset",
    school_id: "school_one",
    source_ids: ["src_dataset"],
    source_types: ["Government dataset"],
    confidence: "Medium",
    date_precision: "year",
    response_depth: "limited_public_response_note"
  },
  {
    id: "evt_asr",
    school_id: "school_two",
    source_ids: ["src_asr"],
    source_types: ["Annual security report"],
    confidence: "High",
    date_precision: "year",
    response_depth: "limited_public_response_note"
  },
  {
    id: "evt_ocr",
    school_id: "school_three",
    source_ids: ["src_ocr_mixed"],
    source_types: ["Government release"],
    confidence: "Medium",
    date_precision: "day",
    response_depth: "agency_described_institutional_action"
  },
  {
    id: "evt_statement",
    school_id: "school_four",
    source_ids: ["src_statement"],
    source_types: ["University statement"],
    confidence: "High",
    date_precision: "day",
    response_depth: "direct_institutional_response"
  }
];

const audit = {
  id: "record_quality_audit_v1",
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-16",
  totals: { records: 4 },
  records: [
    {
      event_id: "evt_dataset",
      school_id: "school_one",
      category: "Harassment or threat",
      confidence: "Medium",
      date_precision: "year",
      source_count: 1,
      source_types: ["Government dataset"],
      response_depth: "limited_public_response_note",
      audit_status: "needs_internal_review",
      review_score: 7,
      highest_severity: "high",
      issue_count: 3,
      issue_ids: ["dataset_cell_locator_needed", "broad_affected_community_label", "year_precision_public_use_limit"],
      workspace_url: "/research-workspace/?record_ids=evt_dataset",
      event_url: "/events/evt_dataset/"
    },
    {
      event_id: "evt_asr",
      school_id: "school_two",
      category: "Harassment or threat",
      confidence: "High",
      date_precision: "year",
      source_count: 1,
      source_types: ["Annual security report"],
      response_depth: "limited_public_response_note",
      audit_status: "usable_with_review_notes",
      review_score: 2,
      highest_severity: "medium",
      issue_count: 1,
      issue_ids: ["page_table_locator_needed"],
      workspace_url: "/research-workspace/?record_ids=evt_asr",
      event_url: "/events/evt_asr/"
    },
    {
      event_id: "evt_ocr",
      school_id: "school_three",
      category: "OCR complaint",
      confidence: "Medium",
      date_precision: "day",
      source_count: 1,
      source_types: ["Government release"],
      response_depth: "agency_described_institutional_action",
      audit_status: "needs_internal_review",
      review_score: 10,
      highest_severity: "high",
      issue_count: 3,
      issue_ids: ["aggregated_source_item_locator_needed", "day_precision_from_mixed_date_source", "high_stakes_record_needs_explicit_rationale"],
      workspace_url: "/research-workspace/?record_ids=evt_ocr",
      event_url: "/events/evt_ocr/"
    },
    {
      event_id: "evt_statement",
      school_id: "school_four",
      category: "Institutional response",
      confidence: "High",
      date_precision: "day",
      source_count: 1,
      source_types: ["University statement"],
      response_depth: "direct_institutional_response",
      audit_status: "blocked_before_external_packet",
      review_score: 4,
      highest_severity: "blocker",
      issue_count: 1,
      issue_ids: ["source_redirect_locator_risk"],
      workspace_url: "/research-workspace/?record_ids=evt_statement",
      event_url: "/events/evt_statement/"
    }
  ],
  issue_counts: {
    dataset_cell_locator_needed: 1,
    page_table_locator_needed: 1,
    aggregated_source_item_locator_needed: 1,
    source_redirect_locator_risk: 1
  }
};

test("sourceFamilyForRecord groups records by review-relevant source family", () => {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  assert.equal(sourceFamilyForRecord(events[0], sourcesById), "ed_campus_safety_dataset");
  assert.equal(sourceFamilyForRecord(events[1], sourcesById), "annual_security_report");
  assert.equal(sourceFamilyForRecord(events[2], sourcesById), "ocr_or_ed_release");
  assert.equal(sourceFamilyForRecord(events[3], sourcesById), "university_statement");
});

test("buildReviewDebtLedger creates one inspectable debt row per record with grouped queues", () => {
  const ledger = buildReviewDebtLedger({
    events,
    sources,
    audit,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" },
    queueLimit: 10
  });

  assert.equal(ledger.id, "review_debt_ledger_v1");
  assert.equal(ledger.totals.records, events.length);
  assert.equal(ledger.records.length, events.length);
  assert.equal(ledger.source_family_counts.ed_campus_safety_dataset, 1);
  assert.equal(ledger.source_family_counts.annual_security_report, 1);
  assert.equal(ledger.source_family_counts.ocr_or_ed_release, 1);
  assert.equal(ledger.source_family_debt.ed_campus_safety_dataset.status_counts.high_review_debt, 1);
  assert.equal(ledger.debt_status_counts.blocked, 1);
  assert.equal(ledger.debt_status_counts.high_review_debt, 2);
  assert.equal(ledger.debt_status_counts.medium_review_debt, 1);

  const blocked = ledger.records.find((record) => record.event_id === "evt_statement");
  assert.equal(blocked.debt_status, "blocked");
  assert.equal(blocked.public_use_status, "do_not_route_externally_until_repaired");

  const dataset = ledger.records.find((record) => record.event_id === "evt_dataset");
  assert.equal(dataset.source_family, "ed_campus_safety_dataset");
  assert.equal(dataset.debt_reasons.some((reason) => reason.includes("Dataset")), true);

  assert.equal(ledger.queues.dataset_locator_debt.records[0].event_id, "evt_dataset");
  assert.equal(ledger.queues.asr_page_locator_debt.records[0].event_id, "evt_asr");
  assert.equal(ledger.queues.ocr_aggregate_item_debt.records[0].event_id, "evt_ocr");
  assert.equal(ledger.queues.blocked_records.records[0].event_id, "evt_statement");
  assert.match(ledger.public_claim_limit, /must not be described as/i);
});

test("validateReviewDebtLedger rejects missing coverage and prohibited claims", () => {
  const ledger = buildReviewDebtLedger({
    events,
    sources,
    audit,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" },
    queueLimit: 10
  });

  assert.deepEqual(validateReviewDebtLedger({ ledger, events, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" } }), []);

  const missingCoverage = { ...ledger, records: ledger.records.slice(1), totals: { ...ledger.totals, records: ledger.records.length - 1 } };
  assert.equal(validateReviewDebtLedger({ ledger: missingCoverage, events }).some((error) => /one row per event/i.test(error)), true);

  const prohibited = { ...ledger, method: `${ledger.method} This is externally validated.` };
  assert.equal(validateReviewDebtLedger({ ledger: prohibited, events }).some((error) => /prohibited/i.test(error)), true);
});
