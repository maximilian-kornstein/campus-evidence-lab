import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFlagshipReport,
  buildGoldRecordV1,
  containsProhibitedFlagshipClaim,
  validateFlagshipArtifacts
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
    verification_status: "Documented in multiple linked public sources",
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
    verification_status: "Documented in linked public source",
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
    verification_status: "Documented in linked public source",
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

const requiredFindingIds = [
  "documentation_over_counts",
  "source_concentration_requires_review",
  "precision_is_a_review_dimension",
  "response_depth_prevents_false_clarity",
  "adversarial_review_is_infrastructure"
];

const requiredBoundaryPatterns = [
  /not .*rank/i,
  /not .*safety/i,
  /not .*severity/i,
  /not .*prevalence/i,
  /not .*legal/i,
  /not .*endorsement/i,
  /not .*external/i
];

function assertBoundaryLanguage(value) {
  for (const pattern of requiredBoundaryPatterns) {
    assert.match(value, pattern);
  }
}

function assertHasEvidenceLink(finding, expectedUrl) {
  assert.equal(
    finding.evidence_links.some((link) => link.url === expectedUrl),
    true,
    `${finding.id} should link to ${expectedUrl}`
  );
}

function assertMissingRationaleIsBounded(value) {
  assert.match(value, /not explicitly captured/i);
  assert.match(value, /current metadata/i);
  assert.match(value, /review/i);
}

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
  assert.equal(report.title, "The Public Evidence Infrastructure Gap");
  assert.equal(report.snapshot_id, "snapshot_test");
  assert.equal(report.snapshot_hash, "sha256:test");
  assert.equal(report.thesis.includes("evidence infrastructure"), true);
  assert.equal(Array.isArray(report.recommended_next_reviews), true);
  assert.equal(report.recommended_next_reviews.length > 0, true);
  assert.equal(Array.isArray(report.audience_paths), true);
  assert.equal(report.audience_paths.length > 0, true);
  assert.deepEqual(
    report.findings.map((finding) => finding.id),
    requiredFindingIds
  );
  assert.equal(report.findings.every((finding) => finding.evidence_links.length > 0), true);
  assert.equal(report.findings.every((finding) => finding.challenge_url.startsWith("/challenge/")), true);
  assert.equal(
    report.findings.every((finding) => finding.evidence_links.every((link) => link.url.startsWith("/") && link.label && link.note)),
    true
  );

  const findingsById = new Map(report.findings.map((finding) => [finding.id, finding]));
  const documentationFinding = findingsById.get("documentation_over_counts");
  const sourceConcentrationFinding = findingsById.get("source_concentration_requires_review");
  const precisionFinding = findingsById.get("precision_is_a_review_dimension");
  const responseDepthFinding = findingsById.get("response_depth_prevents_false_clarity");
  const adversarialReviewFinding = findingsById.get("adversarial_review_is_infrastructure");

  assert.ok(documentationFinding);
  assert.ok(sourceConcentrationFinding);
  assert.ok(precisionFinding);
  assert.ok(responseDepthFinding);
  assert.ok(adversarialReviewFinding);

  assert.equal(documentationFinding.metric.value, events.length);
  assertHasEvidenceLink(documentationFinding, "/data/events.json");
  assertHasEvidenceLink(documentationFinding, "/data/snapshot-manifest.json");

  assert.equal(sourceConcentrationFinding.metric.value, robustnessMetrics.source_type_concentration.top_value.value);
  assert.equal(sourceConcentrationFinding.metric.count, robustnessMetrics.source_type_concentration.top_value.count);
  assertHasEvidenceLink(sourceConcentrationFinding, "/data/robustness-metrics.json");
  assertHasEvidenceLink(sourceConcentrationFinding, "/data/evidence-capsules.json");

  assert.equal(precisionFinding.metric.value, robustnessMetrics.review_gaps.year_precision);
  assertHasEvidenceLink(precisionFinding, "/data/evidence-depth-queues.json");

  assert.equal(responseDepthFinding.metric.value, robustnessMetrics.review_gaps.limited_or_missing_response);
  assertHasEvidenceLink(responseDepthFinding, "/data/robustness-metrics.json");

  assert.equal(adversarialReviewFinding.metric.value, challengeQueues.packets.length);
  assertHasEvidenceLink(adversarialReviewFinding, "/data/challenge-queues.json");
  assertHasEvidenceLink(adversarialReviewFinding, "/data/challenge-ledger.json");

  assertBoundaryLanguage(report.public_claim_limit);
  for (const finding of report.findings) {
    assertBoundaryLanguage(finding.use_limit);
  }
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
  assert.equal(gold.selection_version, "gold_v1_review_priority_2026_06_16");
  assert.equal(Array.isArray(gold.selection_criteria), true);
  assert.equal(gold.selection_criteria.length > 0, true);
  assert.ok(gold.coverage_summary);
  assert.equal(gold.records.length, 2);
  assert.equal(gold.records[0].event_id, "evt_beta");
  assert.equal(Object.keys(gold.coverage_summary.categories).length, 2);
  assert.equal(Object.keys(gold.coverage_summary.source_types).length >= 2, true);
  assert.equal(gold.records.every((record) => record.status === "gold_v1_review_packet"), true);
  assert.equal(gold.records.every((record) => record.workspace_url.includes("record_ids=")), true);
  assert.equal(gold.records.every((record) => record.event_url.startsWith("/events/")), true);
  assert.equal(gold.records.every((record) => record.school_url.startsWith("/schools/")), true);
  assert.equal(gold.records.every((record) => record.correction_url.includes("record_id=")), true);
  assert.equal(gold.records.every((record) => record.challenge_url.startsWith("/challenge/")), true);
  assert.equal(gold.records.every((record) => Number.isFinite(record.review_score)), true);
  assert.equal(gold.records.every((record) => record.selection_reason), true);
  assert.equal(
    gold.records.every((record) =>
      record.source_basis.every((source) => source.source_url.startsWith("/sources/") && source.external_url)
    ),
    true
  );
  assert.equal(gold.records.every((record) => record.review_questions.length >= 4), true);
  assert.equal(
    gold.records.every((record) => !/truth[- ]score/i.test(record.rationale_packet.confidence_rationale)),
    true
  );
  assert.equal(
    gold.records.every((record) =>
      ["classification_rationale", "community_rationale", "confidence_rationale", "response_note"].every(
        (field) => record.rationale_packet[field]
      )
    ),
    true
  );
  assert.equal(gold.records.some((record) => record.challenge_url === "/challenge/?packet=evt_beta"), true);
  assertBoundaryLanguage(gold.public_claim_limit);
  for (const record of gold.records) {
    assert.equal(record.public_claim_limit.includes("not outside validation"), true);
    assertBoundaryLanguage(record.public_claim_limit);
  }

  const recordsByEventId = new Map(gold.records.map((record) => [record.event_id, record]));
  const alphaRecord = recordsByEventId.get("evt_alpha");
  const betaRecord = recordsByEventId.get("evt_beta");

  assert.ok(alphaRecord);
  assert.ok(betaRecord);
  assert.equal(alphaRecord.rationale_packet.classification_rationale, events[0].classification_rationale);
  assert.equal(alphaRecord.rationale_packet.community_rationale, events[0].community_rationale);
  assert.equal(alphaRecord.rationale_packet.confidence_rationale, events[0].confidence_rationale);

  assertMissingRationaleIsBounded(betaRecord.rationale_packet.classification_rationale);
  assertMissingRationaleIsBounded(betaRecord.rationale_packet.community_rationale);
  assertMissingRationaleIsBounded(betaRecord.rationale_packet.confidence_rationale);
  assert.equal(betaRecord.rationale_packet.response_note.includes(events[1].institutional_response), true);

  const goldWithMissingResponse = buildGoldRecordV1({
    events,
    schools,
    sources,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" },
    limit: 3
  });
  const gammaRecord = goldWithMissingResponse.records.find((record) => record.event_id === "evt_gamma");
  assert.ok(gammaRecord);
  assert.match(gammaRecord.rationale_packet.response_note, /no public institutional response text is stored/i);

  assert.equal(containsProhibitedFlagshipClaim(JSON.stringify(gold)), false);
});

test("buildGoldRecordV1 preserves an existing Gold v1 cohort when supplied", () => {
  const gold = buildGoldRecordV1({
    events,
    schools,
    sources,
    challengeQueues,
    existingGoldRecordV1: { records: [{ event_id: "evt_alpha" }, { event_id: "evt_gamma" }] },
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" },
    limit: 2
  });

  assert.deepEqual(
    gold.records.map((record) => record.event_id),
    ["evt_alpha", "evt_gamma"]
  );
  assert.equal(gold.records.every((record) => Number.isFinite(record.review_score)), true);
  assert.equal(gold.coverage_summary.total_records, 2);
});

test("containsProhibitedFlagshipClaim rejects ranking, safety, prevalence, and endorsement language", () => {
  for (const prohibited of [
    "safest school ranking",
    "externally validated by reviewers",
    "prevalence estimate by campus",
    "campus safety score",
    "incident severity score",
    "best campus for civil rights",
    "worst school for bias",
    "approved by reviewers",
    "endorsed by a federal agency",
    "legal finding against the institution",
    "frequency measurement across campuses",
    "independently audited",
    "certified gold standard",
    "reviewer-validated",
    "representative sample",
    "incidence rate",
    "comprehensive measurement",
    "This is not merely a safety score.",
    "This is not controversial because it is a safety score.",
    "This is not a draft and is an external audit.",
    "This is not only a prevalence estimate."
  ]) {
    assert.equal(containsProhibitedFlagshipClaim(prohibited), true, prohibited);
  }

  for (const allowed of [
    "public evidence infrastructure review artifact",
    "This report is not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit.",
    "Gold v1 packet status is not outside validation and only identifies a record for review.",
    "Campus Evidence Lab does not treat the source label as an independent legal finding.",
    "Medium confidence describes source support only; it is not a severity score, not a judgment about institutional conduct, not a prevalence estimate, and not independent factual adjudication."
  ]) {
    assert.equal(containsProhibitedFlagshipClaim(allowed), false, allowed);
  }
});

test("validateFlagshipArtifacts catches stale coverage, missing references, and overclaims", () => {
  const manifest = { snapshot_id: "snapshot_test", created_at: "2026-06-16", hashes: { full_snapshot: "sha256:test" } };
  const report = buildFlagshipReport({
    events,
    schools,
    sources,
    robustnessMetrics,
    challengeQueues,
    manifest
  });
  const gold = buildGoldRecordV1({
    events,
    schools,
    sources,
    challengeQueues,
    manifest,
    limit: 2
  });

  assert.deepEqual(
    validateFlagshipArtifacts({
      report,
      gold,
      events,
      schools,
      sources,
      challengeQueues,
      robustnessMetrics,
      manifest
    }),
    []
  );

  const staleCoverage = structuredClone(gold);
  staleCoverage.coverage_summary.categories.Vandalism = 99;
  assert.equal(
    validateFlagshipArtifacts({ report, gold: staleCoverage, events, schools, sources, challengeQueues, robustnessMetrics, manifest }).some((error) =>
      /coverage_summary\.categories/.test(error)
    ),
    true
  );

  const missingReference = structuredClone(gold);
  missingReference.records[0].event_id = "evt_missing";
  assert.equal(
    validateFlagshipArtifacts({ report, gold: missingReference, events, schools, sources, challengeQueues, robustnessMetrics, manifest }).some((error) =>
      /unknown event|challenge_url|event_url/i.test(error)
    ),
    true
  );

  const prohibitedClaim = structuredClone(report);
  prohibitedClaim.findings[0].summary = "This is the safest school ranking.";
  assert.equal(
    validateFlagshipArtifacts({ report: prohibitedClaim, gold, events, schools, sources, challengeQueues, robustnessMetrics, manifest }).some((error) =>
      /prohibited/i.test(error)
    ),
    true
  );
});
