import test from "node:test";
import assert from "node:assert/strict";
import { buildCertificationBatches, validateCertificationBatches } from "../scripts/certification-batches-lib.mjs";

const ledger = {
  id: "certification_ledger_v1",
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-17",
  records: [
    {
      event_id: "evt_dataset_1",
      school_id: "school_a",
      source_family: "ed_campus_safety_dataset",
      certification_status: "awaiting_review",
      open_gates: ["source_locator_specificity"],
      issue_ids: ["dataset_cell_locator_needed"],
      event_url: "/events/evt_dataset_1/",
      workspace_url: "/research-workspace/?record_ids=evt_dataset_1",
      challenge_url: "/challenge/?record=evt_dataset_1"
    },
    {
      event_id: "evt_asr_1",
      school_id: "school_b",
      source_family: "annual_security_report",
      certification_status: "awaiting_review",
      open_gates: ["source_locator_specificity"],
      issue_ids: ["page_table_locator_needed"],
      event_url: "/events/evt_asr_1/",
      workspace_url: "/research-workspace/?record_ids=evt_asr_1",
      challenge_url: "/challenge/?record=evt_asr_1"
    },
    {
      event_id: "evt_ocr_1",
      school_id: "school_c",
      source_family: "ocr_or_ed_release",
      certification_status: "certified",
      open_gates: [],
      issue_ids: [],
      event_url: "/events/evt_ocr_1/",
      workspace_url: "/research-workspace/?record_ids=evt_ocr_1",
      challenge_url: "/challenge/?record=evt_ocr_1"
    },
    {
      event_id: "evt_blocked_1",
      school_id: "school_d",
      source_family: "university_statement",
      certification_status: "blocked",
      open_gates: ["source_locator_specificity"],
      issue_ids: ["source_redirect_locator_risk"],
      event_url: "/events/evt_blocked_1/",
      workspace_url: "/research-workspace/?record_ids=evt_blocked_1",
      challenge_url: "/challenge/?record=evt_blocked_1"
    }
  ]
};

test("buildCertificationBatches groups records by source-family review lanes", () => {
  const batches = buildCertificationBatches({ certificationLedger: ledger, batchSize: 1 });

  assert.equal(batches.id, "certification_batches_v1");
  assert.equal(batches.totals.records, 4);
  assert.equal(batches.totals.batches, 4);
  assert.equal(batches.lanes.ed_dataset.records, 1);
  assert.equal(batches.lanes.asr.records, 1);
  assert.equal(batches.lanes.ocr_or_government_release.records, 1);
  assert.equal(batches.lanes.blocked_or_problem.records, 1);
  assert.equal(batches.batches.every((batch) => batch.records.length <= 1), true);
  assert.equal(batches.batches.find((batch) => batch.lane_id === "ed_dataset").completion_rule.includes("final visible status"), true);
});

test("validateCertificationBatches rejects missing coverage and oversized batches", () => {
  const batches = buildCertificationBatches({ certificationLedger: ledger, batchSize: 2 });
  assert.deepEqual(validateCertificationBatches({ batches, certificationLedger: ledger }), []);

  const missing = structuredClone(batches);
  missing.batches[0].records = [];
  assert.match(validateCertificationBatches({ batches: missing, certificationLedger: ledger }).join("\n"), /must include every certification-ledger record/);

  const oversized = structuredClone(batches);
  oversized.batches[0].records.push(oversized.batches[0].records[0], oversized.batches[0].records[0]);
  assert.match(validateCertificationBatches({ batches: oversized, certificationLedger: ledger }).join("\n"), /exceeds batch size/);
});
