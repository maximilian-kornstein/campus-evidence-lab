import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceCapsules,
  buildSourceProvenanceQueues,
  classifyImportFamily,
  evidenceLocatorQuality,
  fieldEvidenceRows,
  hasProhibitedEvidenceClaim,
  recordEvidenceCapsule
} from "../scripts/evidence-capsules-lib.mjs";

const sources = [
  {
    id: "src_dataset",
    title: "Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files",
    publisher: "U.S. Department of Education Office of Postsecondary Education",
    source_type: "Government dataset",
    published_date: "2025-01-01",
    accessed_date: "2026-06-03",
    url: "https://example.edu/dataset.zip"
  },
  {
    id: "src_ocr",
    title: "What's New in OCR",
    publisher: "U.S. Department of Education Office for Civil Rights",
    source_type: "Government release",
    published_date: "2025-01-16",
    accessed_date: "2026-06-03",
    url: "https://example.edu/ocr"
  },
  {
    id: "src_university",
    title: "Anti-Asian Hate Crime on SJSU Campus",
    publisher: "San Jose State University",
    source_type: "University statement",
    published_date: "2022-06-17",
    accessed_date: "2026-06-03",
    url: "https://example.edu/statement"
  }
];

const events = [
  {
    id: "evt_2026_0001",
    school_id: "emory_university",
    date: "2025-01-16",
    date_precision: "day",
    location: "Atlanta, GA",
    affected_communities: ["Muslim", "Palestinian"],
    category: "OCR complaint",
    summary: "OCR announced a resolution agreement with Emory University.",
    description: "According to OCR's What's New page, Emory University entered into a resolution agreement.",
    source_ids: ["src_ocr"],
    source_types: ["Government release"],
    institutional_response: "The record summarizes OCR's public announcement and does not independently evaluate the institution's completed response.",
    response_date: "2025-01-16",
    legal_status: "OCR resolution agreement announced",
    verification_status: "Verified from public source",
    confidence: "Medium",
    tags: ["title-vi", "shared-ancestry", "resolution-agreement"],
    created_at: "2026-06-03",
    updated_at: "2026-06-03",
    record_hash: "sha256:test"
  },
  {
    id: "evt_2026_0002",
    school_id: "beta_college",
    date: "2023-01-01",
    date_precision: "year",
    location: "Boston, MA",
    affected_communities: ["Religion"],
    category: "Vandalism",
    summary: "ED campus safety data listed one vandalism incident.",
    description: "According to the Department of Education Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files, the Oncampushate222324.xlsx workbook listed one incident.",
    source_ids: ["src_dataset"],
    source_types: ["Government dataset"],
    institutional_response: "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
    response_date: "2023-01-01",
    legal_status: "Reported in Department of Education campus safety hate-crime statistics",
    verification_status: "Verified from public source",
    confidence: "Medium",
    tags: ["ed-campus-safety-data", "clery", "hate-crime-statistics", "on-campus"],
    created_at: "2026-06-03",
    updated_at: "2026-06-03",
    record_hash: "sha256:test"
  },
  {
    id: "evt_2026_0003",
    school_id: "san_jose_state_university",
    date: "2022-06-17",
    date_precision: "day",
    location: "San Jose, CA",
    affected_communities: ["Asian"],
    category: "Criminal investigation",
    summary: "San Jose State University publicly addressed an anti-Asian hate crime attack on campus.",
    description: "According to San Jose State University's Office of Diversity, Equity and Inclusion, an SJSUAlert described an anti-Asian hate crime attack.",
    source_ids: ["src_university"],
    source_types: ["University statement"],
    institutional_response: "The university statement describes outreach to AAPI campus groups, coordination with University Police, and support resources.",
    response_date: "2022-06-17",
    legal_status: "University public statement after reported hate crime",
    verification_status: "Verified from public source",
    confidence: "High",
    tags: ["anti-asian-hate", "hate-crime", "university-statement"],
    created_at: "2026-06-03",
    updated_at: "2026-06-03",
    record_hash: "sha256:test"
  }
];

test("classifyImportFamily identifies government dataset, OCR/government release, and university statement records", () => {
  assert.equal(classifyImportFamily(events[0], sources).id, "ocr_government_release");
  assert.equal(classifyImportFamily(events[1], sources).id, "ed_campus_safety_dataset");
  assert.equal(classifyImportFamily(events[2], sources).id, "institutional_public_statement");
});

test("evidenceLocatorQuality grades source locator specificity conservatively", () => {
  assert.equal(evidenceLocatorQuality(events[0], sources).code, "source_page");
  assert.equal(evidenceLocatorQuality(events[1], sources).code, "dataset_file");
  assert.equal(evidenceLocatorQuality(events[2], sources).code, "source_page");
});

test("fieldEvidenceRows returns source-backed rows for core record fields", () => {
  const rows = fieldEvidenceRows(events[1], sources);
  assert.deepEqual(
    rows.map((row) => row.field),
    ["school", "date", "category", "affected_communities", "description", "institutional_response", "legal_status", "confidence"]
  );
  assert.equal(rows.every((row) => row.source_ids.includes("src_dataset")), true);
  assert.equal(rows.find((row) => row.field === "date").support_note.includes("year precision"), true);
});

test("recordEvidenceCapsule builds a compact source-to-field packet without overclaiming", () => {
  const capsule = recordEvidenceCapsule(events[1], sources);
  assert.equal(capsule.event_id, "evt_2026_0002");
  assert.equal(capsule.import_family.id, "ed_campus_safety_dataset");
  assert.equal(capsule.locator_quality.code, "dataset_file");
  assert.equal(capsule.source_basis.source_count, 1);
  assert.equal(capsule.field_evidence.length, 8);
  assert.equal(capsule.review_needs.includes("dataset_cell_locator_review"), true);
  assert.equal(hasProhibitedEvidenceClaim(JSON.stringify(capsule)), false);
});

test("buildEvidenceCapsules summarizes all records and import families", () => {
  const artifact = buildEvidenceCapsules({
    events,
    sources,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
  });
  assert.equal(artifact.snapshot_id, "snapshot_test");
  assert.equal(artifact.generated_at, "2026-06-03");
  assert.equal(artifact.records.length, 3);
  assert.equal(artifact.totals.records, 3);
  assert.equal(artifact.import_family_counts.ed_campus_safety_dataset, 1);
});

test("buildSourceProvenanceQueues returns deterministic review queues", () => {
  const artifact = buildEvidenceCapsules({
    events,
    sources,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
  });
  const queues = buildSourceProvenanceQueues({ capsules: artifact, limit: 2 });

  assert.equal(queues.snapshot_id, "snapshot_test");
  assert.equal(queues.queues.length >= 5, true);
  assert.deepEqual(
    queues.queues.find((queue) => queue.id === "dataset-cell-locator-review").records.map((record) => record.event_id),
    ["evt_2026_0002"]
  );
  assert.equal(hasProhibitedEvidenceClaim(JSON.stringify(queues)), false);
});

test("hasProhibitedEvidenceClaim catches validation, approval, ranking, and frequency claims", () => {
  assert.equal(hasProhibitedEvidenceClaim("externally validated source packet"), true);
  assert.equal(hasProhibitedEvidenceClaim("approved by reviewers"), true);
  assert.equal(hasProhibitedEvidenceClaim("safest school ranking"), true);
  assert.equal(hasProhibitedEvidenceClaim("source-to-field metadata packet"), false);
});
