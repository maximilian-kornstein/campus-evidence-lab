import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewSamples,
  reasonCodesForRecord,
  reviewQuestionsForReasons,
  stableSample,
  validateReviewLedger
} from "../scripts/review-samples-lib.mjs";

const records = [
  {
    id: "evt_2026_0001",
    school_id: "alpha",
    date: "2026-01-01",
    affected_communities: ["Race"],
    category: "OCR complaint",
    legal_status: "OCR complaint opened",
    confidence: "Low",
    source_ids: ["src_a"],
    sources: [{ id: "src_a" }],
    tags: ["ocr"]
  },
  {
    id: "evt_2026_0002",
    school_id: "beta",
    date: "2026-01-02",
    affected_communities: ["Jewish"],
    category: "Institutional response",
    legal_status: "No legal finding stated",
    confidence: "High",
    source_ids: ["src_b", "src_c"],
    sources: [{ id: "src_b" }, { id: "src_c" }],
    institutional_response: "The university published a response.",
    tags: []
  },
  {
    id: "evt_2026_0003",
    school_id: "gamma",
    date: "2026-01-03",
    affected_communities: ["Muslim"],
    category: "Lawsuit or legal filing",
    legal_status: "Federal lawsuit filed",
    confidence: "Medium",
    source_ids: ["src_d"],
    sources: [{ id: "src_d" }],
    institutional_response: "",
    tags: ["federal"]
  }
];

const sourceAuditLive = {
  entries: [{ source_id: "src_d", live_status: "error", launch_check_status: "needs_review" }]
};

test("reasonCodesForRecord assigns deterministic review reasons", () => {
  assert.deepEqual(reasonCodesForRecord(records[0], sourceAuditLive), [
    "low_confidence",
    "single_source",
    "broad_label",
    "missing_response",
    "legal_or_ocr"
  ]);
  assert.deepEqual(reasonCodesForRecord(records[2], sourceAuditLive), [
    "single_source",
    "missing_response",
    "legal_or_ocr",
    "source_audit_followup"
  ]);
});

test("reviewQuestionsForReasons maps reasons to reviewer prompts", () => {
  const questions = reviewQuestionsForReasons(["broad_label", "single_source"]);
  assert.equal(questions.length, 2);
  assert.match(questions[0], /affected-community label/i);
  assert.match(questions[1], /additional public source/i);
});

test("stableSample returns stable snapshot-bound samples", () => {
  const first = stableSample(records, 2, "sha256:abc");
  const second = stableSample(records, 2, "sha256:abc");
  assert.deepEqual(
    first.map((record) => record.id),
    second.map((record) => record.id)
  );
  assert.equal(first.length, 2);
});

test("buildReviewSamples produces capped named samples with packet and checklist links", () => {
  const samples = buildReviewSamples({
    records,
    sourceAuditLive,
    snapshotId: "snapshot_2026_06_16",
    snapshotHash: "sha256:abc"
  });

  assert.equal(samples.snapshot_id, "snapshot_2026_06_16");
  assert.ok(samples.samples.some((sample) => sample.id === "random-25"));
  const low = samples.samples.find((sample) => sample.id === "low-confidence-25");
  assert.equal(low.records.length, 1);
  assert.equal(low.records[0].event_id, "evt_2026_0001");
  assert.ok(low.records[0].workspace_url.includes("research-workspace"));
  assert.ok(low.records[0].checklist_url.includes("reviewer-checklist.yml"));
});

test("buildReviewSamples lists selected sample records newest first", () => {
  const samples = buildReviewSamples({
    records,
    sourceAuditLive,
    snapshotId: "snapshot_2026_06_16",
    snapshotHash: "sha256:abc"
  });

  const singleSource = samples.samples.find((sample) => sample.id === "single-source-25");
  assert.deepEqual(
    singleSource.records.map((record) => record.event_id),
    ["evt_2026_0003", "evt_2026_0001"]
  );
});

test("validateReviewLedger rejects invalid statuses and unknown samples", () => {
  const errors = validateReviewLedger(
    {
      version: "0.1.0",
      updated_at: "2026-06-16",
      entries: [
        {
          id: "review_2026_0001",
          sample_id: "missing-sample",
          status: "done",
          review_type: "internal",
          reviewer_display: null,
          reviewed_at: null,
          record_count: 25,
          findings_summary: "",
          issue_url: null,
          resulting_correction_ids: [],
          resulting_event_ids: []
        }
      ]
    },
    new Set(["random-25"])
  );

  assert.ok(errors.some((error) => error.includes("unknown sample_id")));
  assert.ok(errors.some((error) => error.includes("invalid status")));
});
