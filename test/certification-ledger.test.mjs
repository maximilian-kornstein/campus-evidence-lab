import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCertificationLedger,
  validateCertificationLedger
} from "../scripts/certification-ledger-lib.mjs";

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
    category: "Harassment or threat",
    affected_communities: ["Race"],
    confidence: "Medium",
    date_precision: "year",
    response_depth: "limited_public_response_note"
  },
  {
    id: "evt_gold",
    school_id: "school_two",
    source_ids: ["src_statement"],
    source_types: ["University statement"],
    category: "Institutional response",
    affected_communities: ["Jewish"],
    confidence: "High",
    date_precision: "day",
    response_depth: "direct_institutional_response",
    classification_rationale: "The cited university statement directly supports the institutional-response category for this record.",
    community_rationale: "The cited statement names the affected community used in this record; no broader label is inferred.",
    confidence_rationale: "High confidence is limited to source-to-record support from the cited item and does not make any broader claim."
  },
  {
    id: "evt_blocked",
    school_id: "school_three",
    source_ids: ["src_statement"],
    source_types: ["University statement"],
    category: "Institutional response",
    affected_communities: ["Jewish"],
    confidence: "High",
    date_precision: "day",
    response_depth: "direct_institutional_response"
  }
];

const reviewDebtLedger = {
  id: "review_debt_ledger_v1",
  records: [
    {
      event_id: "evt_dataset",
      school_id: "school_one",
      source_family: "ed_campus_safety_dataset",
      debt_status: "high_review_debt",
      public_use_status: "internal_review_required_before_reuse",
      issue_ids: [
        "dataset_cell_locator_needed",
        "broad_affected_community_label",
        "year_precision_public_use_limit",
        "missing_explicit_rationales"
      ],
      repair_priority: 307,
      event_url: "/events/evt_dataset/",
      workspace_url: "/research-workspace/?record_ids=evt_dataset"
    },
    {
      event_id: "evt_gold",
      school_id: "school_two",
      source_family: "university_statement",
      debt_status: "lower_priority_review_debt",
      public_use_status: "lower_priority_but_not_manually_certified",
      issue_ids: [],
      repair_priority: 0,
      event_url: "/events/evt_gold/",
      workspace_url: "/research-workspace/?record_ids=evt_gold"
    },
    {
      event_id: "evt_blocked",
      school_id: "school_three",
      source_family: "university_statement",
      debt_status: "blocked",
      public_use_status: "do_not_route_externally_until_repaired",
      issue_ids: ["source_redirect_locator_risk"],
      repair_priority: 404,
      event_url: "/events/evt_blocked/",
      workspace_url: "/research-workspace/?record_ids=evt_blocked"
    }
  ]
};

const goldV1CertificationStatus = {
  records: [
    {
      event_id: "evt_gold",
      certification_status: "certified"
    },
    {
      event_id: "evt_blocked",
      certification_status: "blocked"
    }
  ]
};

test("buildCertificationLedger creates one conservative certification row per record", () => {
  const ledger = buildCertificationLedger({
    events,
    sources,
    reviewDebtLedger,
    goldV1CertificationStatus,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" },
    batchLimit: 2
  });

  assert.equal(ledger.id, "certification_ledger_v1");
  assert.equal(ledger.totals.records, events.length);
  assert.equal(ledger.records.length, events.length);
  assert.equal(ledger.certification_status_counts.certified, 1);
  assert.equal(ledger.certification_status_counts.awaiting_review, 1);
  assert.equal(ledger.certification_status_counts.blocked, 1);

  const gold = ledger.records.find((record) => record.event_id === "evt_gold");
  assert.equal(gold.certification_status, "certified");
  assert.equal(gold.certification_basis, "gold_v1_internal_source_to_record_review");
  assert.equal(Object.values(gold.gates).every((gate) => gate.status === "pass"), true);

  const dataset = ledger.records.find((record) => record.event_id === "evt_dataset");
  assert.equal(dataset.certification_status, "awaiting_review");
  assert.equal(dataset.gates.source_locator_specificity.status, "review");
  assert.equal(dataset.gates.rationale_specificity.status, "review");
  assert.match(dataset.open_gates.join(" "), /source_locator_specificity/);

  const blocked = ledger.records.find((record) => record.event_id === "evt_blocked");
  assert.equal(blocked.certification_status, "blocked");
  assert.equal(blocked.gates.source_locator_specificity.status, "block");
});

test("Batch 001 is bounded to ED dataset records and does not certify missing cell provenance", () => {
  const ledger = buildCertificationLedger({
    events,
    sources,
    reviewDebtLedger,
    goldV1CertificationStatus,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" },
    batchLimit: 1
  });

  assert.equal(ledger.batch_001.id, "batch_001_ed_dataset_provenance_pilot");
  assert.equal(ledger.batch_001.source_family, "ed_campus_safety_dataset");
  assert.equal(ledger.batch_001.records.length, 1);
  assert.equal(ledger.batch_001.records[0].event_id, "evt_dataset");
  assert.equal(ledger.batch_001.records[0].certification_status, "awaiting_review");
  assert.deepEqual(ledger.batch_001.status_counts, { awaiting_review: 1 });
  assert.match(ledger.batch_001.records[0].next_action, /workbook/i);
});

test("validateCertificationLedger rejects missing coverage, unsafe certification, and prohibited claims", () => {
  const ledger = buildCertificationLedger({
    events,
    sources,
    reviewDebtLedger,
    goldV1CertificationStatus,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" },
    batchLimit: 2
  });

  assert.deepEqual(validateCertificationLedger({ ledger, events, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" } }), []);

  const missingCoverage = { ...ledger, records: ledger.records.slice(1), totals: { ...ledger.totals, records: ledger.records.length - 1 } };
  assert.match(validateCertificationLedger({ ledger: missingCoverage, events, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" } }).join("\n"), /one row per event/);

  const unsafeCertified = structuredClone(ledger);
  unsafeCertified.records[0].certification_status = "certified";
  assert.match(validateCertificationLedger({ ledger: unsafeCertified, events, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" } }).join("\n"), /certified with non-passing gate/);

  const prohibited = structuredClone(ledger);
  prohibited.method = "This ledger is an external validation of safety scoring.";
  assert.match(validateCertificationLedger({ ledger: prohibited, events, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" } }).join("\n"), /prohibited/);
});
