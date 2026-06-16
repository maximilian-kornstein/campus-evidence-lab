import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceDepthQueues,
  buildReviewerChallengePack,
  buildRobustnessMetrics,
  classifyResponseDepth,
  containsProhibitedRobustnessClaim,
  selectEnrichmentBatch,
  selectGoldRecordCandidates
} from "../scripts/robustness-metrics-lib.mjs";

const sampleSources = [
  {
    id: "src_government_dataset",
    source_type: "Government dataset",
    title: "Campus safety dataset"
  },
  {
    id: "src_ocr_release",
    source_type: "Government release",
    title: "OCR resolution announcement"
  },
  {
    id: "src_university_statement",
    source_type: "University statement",
    title: "University public statement"
  }
];

const sampleEvents = [
  {
    id: "evt_2026_0001",
    school_id: "sch_alpha",
    date: "2026-01-15",
    date_precision: "day",
    category: "OCR complaint",
    affected_communities: ["Jewish"],
    source_ids: ["src_ocr_release", "src_university_statement"],
    source_types: ["Government release", "University statement"],
    confidence: "High",
    verification_status: "Verified from multiple public sources",
    institutional_response: "Alpha University said it would update training, publish policy revisions, and continue reporting to OCR.",
    response_date: "2026-01-16"
  },
  {
    id: "evt_2026_0002",
    school_id: "sch_beta",
    date: "2026-01-01",
    date_precision: "year",
    category: "Vandalism",
    affected_communities: ["Religion"],
    source_ids: ["src_government_dataset"],
    source_types: ["Government dataset"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response:
      "The record summarizes public dataset fields and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
    response_date: "2026-01-01"
  },
  {
    id: "evt_2026_0003",
    school_id: "sch_gamma",
    date: "2026-02-01",
    date_precision: "month",
    category: "Harassment or threat",
    affected_communities: ["LGBTQ+"],
    source_ids: ["src_government_dataset"],
    source_types: ["Government dataset"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response: ""
  },
  {
    id: "evt_2026_0004",
    school_id: "sch_delta",
    date: "2026-03-01",
    date_precision: "day",
    category: "Title IX compliance",
    affected_communities: ["Women"],
    source_ids: ["src_ocr_release"],
    source_types: ["Government release"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response: "OCR announced that Delta College entered a voluntary resolution agreement addressing compliance obligations.",
    response_date: "2026-03-02"
  }
];

test("classifyResponseDepth distinguishes direct, agency-described, limited, and missing response states", () => {
  assert.equal(classifyResponseDepth(sampleEvents[0]).code, "direct_institutional_response");
  assert.equal(classifyResponseDepth(sampleEvents[1]).code, "limited_public_response_note");
  assert.equal(classifyResponseDepth(sampleEvents[2]).code, "no_public_response_found");
  assert.equal(classifyResponseDepth(sampleEvents[3]).code, "agency_described_institutional_action");
});

test("buildRobustnessMetrics reports source concentration, confidence, date precision, communities, categories, and response depth", () => {
  const metrics = buildRobustnessMetrics({
    events: sampleEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test" }
  });

  assert.equal(metrics.snapshot_id, "snapshot_test");
  assert.equal(metrics.totals.events, 4);
  assert.equal(metrics.source_type_concentration.top_value.value, "Government dataset");
  assert.equal(metrics.source_type_concentration.top_value.count, 2);
  assert.equal(metrics.date_precision.year.count, 1);
  assert.equal(metrics.confidence.High.count, 1);
  assert.equal(metrics.response_depth.direct_institutional_response.count, 1);
  assert.equal(metrics.response_depth.agency_described_institutional_action.count, 1);
  assert.equal(metrics.category_concentration.top_value.value, "Harassment or threat");
  assert.equal(metrics.known_limits.length > 0, true);
});

test("buildEvidenceDepthQueues returns deterministic bounded review queues with non-overclaiming language", () => {
  const queues = buildEvidenceDepthQueues({
    events: sampleEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test" },
    limit: 2
  });

  assert.equal(queues.snapshot_id, "snapshot_test");
  assert.equal(queues.queues.length >= 6, true);
  assert.equal(queues.queues.every((queue) => queue.records.length <= 2), true);
  assert.deepEqual(
    queues.queues.find((queue) => queue.id === "single-source-government-dataset").records.map((row) => row.event_id),
    ["evt_2026_0002", "evt_2026_0003"]
  );
  assert.equal(queues.queues.every((queue) => queue.records.every((row) => row.workspace_url.includes("record_ids="))), true);
  assert.equal(queues.queues.every((queue) => queue.records.every((row) => row.packet_url.includes("record_ids="))), true);
  assert.equal(containsProhibitedRobustnessClaim(JSON.stringify(queues)), false);
});

test("selectGoldRecordCandidates marks candidates as existing-metadata review instead of outside validation", () => {
  const gold = selectGoldRecordCandidates({
    events: sampleEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test" },
    limit: 3
  });

  assert.equal(gold.snapshot_id, "snapshot_test");
  assert.equal(gold.review_standard, "existing_metadata_evidence_depth_review");
  assert.equal(gold.records.length, 3);
  assert.equal(gold.records.every((record) => record.status === "candidate_enriched_from_existing_metadata"), true);
  assert.equal(containsProhibitedRobustnessClaim(JSON.stringify(gold)), false);
});

test("selectEnrichmentBatch caps records and returns explicit existing-metadata enrichment fields", () => {
  const batch = selectEnrichmentBatch({
    events: sampleEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    limit: 2
  });

  assert.equal(batch.snapshot_id, "snapshot_test");
  assert.equal(batch.generated_at, "2026-06-03");
  assert.equal(batch.review_standard, "existing_metadata_evidence_depth_enrichment");
  assert.equal(batch.records.length, 2);
  assert.equal(batch.records.every((record) => record.enrichment.response_depth), true);
  assert.equal(batch.records.every((record) => record.enrichment.classification_rationale.includes("does not treat it as an independent legal finding")), true);
  assert.equal(containsProhibitedRobustnessClaim(JSON.stringify(batch)), false);
});

test("selectEnrichmentBatch is stable after selected records receive enrichment fields", () => {
  const firstBatch = selectEnrichmentBatch({
    events: sampleEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    limit: 2
  });
  const enrichmentById = new Map(firstBatch.records.map((record) => [record.event_id, record.enrichment]));
  const enrichedEvents = sampleEvents.map((event) =>
    enrichmentById.has(event.id) ? { ...event, ...enrichmentById.get(event.id) } : event
  );
  const secondBatch = selectEnrichmentBatch({
    events: enrichedEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    limit: 2
  });

  assert.deepEqual(
    secondBatch.records.map((record) => record.event_id),
    firstBatch.records.map((record) => record.event_id)
  );
});

test("buildReviewerChallengePack selects difficult records from evidence-depth queues", () => {
  const queues = buildEvidenceDepthQueues({
    events: sampleEvents,
    sources: sampleSources,
    manifest: { snapshot_id: "snapshot_test" },
    limit: 2
  });
  const challenge = buildReviewerChallengePack({ queues, limit: 3 });

  assert.equal(challenge.snapshot_id, "snapshot_test");
  assert.equal(challenge.records.length, 3);
  assert.equal(challenge.records.every((record) => record.challenge_reason_codes.length > 0), true);
  assert.equal(challenge.records.every((record) => record.workspace_url.includes("record_ids=")), true);
  assert.equal(containsProhibitedRobustnessClaim(JSON.stringify(challenge)), false);
});

test("containsProhibitedRobustnessClaim catches ranking, prevalence, endorsement, and safety-score language", () => {
  assert.equal(containsProhibitedRobustnessClaim("this is the safest school ranking"), true);
  assert.equal(containsProhibitedRobustnessClaim("approved by outside reviewers"), true);
  assert.equal(containsProhibitedRobustnessClaim("this estimates prevalence across campuses"), true);
  assert.equal(containsProhibitedRobustnessClaim("dataset composition metrics for review prioritization"), false);
});
