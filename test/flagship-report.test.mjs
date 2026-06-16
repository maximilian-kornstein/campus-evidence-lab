import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFlagshipReport,
  buildGoldRecordV1,
  containsProhibitedFlagshipClaim
} from "../scripts/flagship-report-lib.mjs";

const events = [
  {
    id: "evt_alpha",
    school_id: "alpha_university",
    date: "2026-01-15",
    date_precision: "day",
    category: "OCR complaint",
    affected_communities: ["Jewish"],
    source_ids: ["src_ocr", "src_university"],
    source_types: ["Government release", "University statement"],
    confidence: "High",
    verification_status: "Verified from multiple public sources",
    institutional_response: "Alpha University said it would update training and report to OCR.",
    response_date: "2026-01-16",
    classification_rationale:
      "OCR complaint is retained because the public OCR source describes the matter as an OCR case.",
    community_rationale: "Jewish is retained because the public OCR source describes shared ancestry concerns.",
    confidence_rationale: "High confidence reflects multiple linked public sources and is not a severity score."
  },
  {
    id: "evt_beta",
    school_id: "beta_college",
    date: "2025-01-01",
    date_precision: "year",
    category: "Vandalism",
    affected_communities: ["Religion"],
    source_ids: ["src_dataset"],
    source_types: ["Government dataset"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response:
      "The record summarizes public dataset fields and does not independently evaluate investigative, disciplinary, or institutional response outcomes."
  },
  {
    id: "evt_gamma",
    school_id: "gamma_college",
    date: "2026-03-01",
    date_precision: "month",
    category: "Harassment or threat",
    affected_communities: ["Race"],
    source_ids: ["src_news"],
    source_types: ["News report"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response: ""
  }
];

const schools = [
  { id: "alpha_university", name: "Alpha University", state: "GA" },
  { id: "beta_college", name: "Beta College", state: "MA" },
  { id: "gamma_college", name: "Gamma College", state: "CA" }
];

const sources = [
  { id: "src_ocr", title: "OCR release", source_type: "Government release", url: "https://example.edu/ocr" },
  {
    id: "src_university",
    title: "University statement",
    source_type: "University statement",
    url: "https://example.edu/statement"
  },
  { id: "src_dataset", title: "Dataset row", source_type: "Government dataset", url: "https://example.edu/dataset" },
  { id: "src_news", title: "News report", source_type: "News report", url: "https://example.edu/news" }
];

const robustnessMetrics = {
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-16",
  totals: { events: 3, single_source_events: 2, multi_source_events: 1, records_with_explicit_rationales: 1 },
  source_type_concentration: { top_value: { value: "Government dataset", count: 1, percent: 33.33 } },
  date_precision: {
    year: { count: 1, percent: 33.33 },
    day: { count: 1, percent: 33.33 },
    month: { count: 1, percent: 33.33 }
  },
  confidence: { High: { count: 1, percent: 33.33 }, Medium: { count: 2, percent: 66.67 } },
  response_depth: {
    direct_institutional_response: { count: 1, percent: 33.33 },
    limited_public_response_note: { count: 1, percent: 33.33 },
    no_public_response_found: { count: 1, percent: 33.33 }
  },
  review_gaps: {
    single_source_government_dataset: 1,
    year_precision: 1,
    medium_or_low_confidence: 2,
    limited_or_missing_response: 2,
    missing_explicit_rationales: 2
  },
  known_limits: ["Composition metrics describe current records, not prevalence."]
};

const challengeQueues = {
  packets: [
    {
      event_id: "evt_beta",
      event_url: "/events/evt_beta/",
      workspace_url: "/research-workspace/?record_ids=evt_beta",
      submission_packet_url: "/submit/?type=correction&record_id=evt_beta",
      challenge_types: ["date_precision_challenge", "source_sufficiency_challenge"]
    }
  ]
};

test("buildFlagshipReport creates a bounded thesis with evidence-backed findings", () => {
  const report = buildFlagshipReport({
    events,
    schools,
    sources,
    robustnessMetrics,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16", hashes: { full_snapshot: "sha256:test" } }
  });

  assert.equal(report.id, "flagship_public_evidence_infrastructure_v1");
  assert.equal(report.snapshot_id, "snapshot_test");
  assert.equal(report.thesis.includes("evidence infrastructure"), true);
  assert.equal(report.findings.length >= 5, true);
  assert.equal(report.findings.every((finding) => finding.evidence_links.length > 0), true);
  assert.equal(report.findings.every((finding) => finding.challenge_url.startsWith("/challenge/")), true);
  assert.equal(containsProhibitedFlagshipClaim(JSON.stringify(report)), false);
});

test("buildGoldRecordV1 creates exactly bounded review packets with challenge and workspace links", () => {
  const gold = buildGoldRecordV1({
    events,
    schools,
    sources,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" },
    limit: 2
  });

  assert.equal(gold.snapshot_id, "snapshot_test");
  assert.equal(gold.records.length, 2);
  assert.equal(gold.records.every((record) => record.status === "gold_v1_review_packet"), true);
  assert.equal(gold.records.every((record) => record.workspace_url.includes("record_ids=")), true);
  assert.equal(gold.records.every((record) => record.event_url.startsWith("/events/")), true);
  assert.equal(gold.records.every((record) => record.review_questions.length >= 4), true);
  assert.equal(gold.records.every((record) => record.public_claim_limit.includes("not outside validation")), true);
  assert.equal(containsProhibitedFlagshipClaim(JSON.stringify(gold)), false);
});

test("containsProhibitedFlagshipClaim rejects ranking, safety, prevalence, and endorsement language", () => {
  assert.equal(containsProhibitedFlagshipClaim("safest school ranking"), true);
  assert.equal(containsProhibitedFlagshipClaim("externally validated by reviewers"), true);
  assert.equal(containsProhibitedFlagshipClaim("prevalence estimate by campus"), true);
  assert.equal(containsProhibitedFlagshipClaim("public evidence infrastructure review artifact"), false);
});
