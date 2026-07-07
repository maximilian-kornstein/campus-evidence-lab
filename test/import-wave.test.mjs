import test from "node:test";
import assert from "node:assert/strict";
import {
  candidateDuplicateKey,
  runImportWave,
  validateImportWaveArtifacts,
  validateImportWaveCandidates
} from "../scripts/import-wave-lib.mjs";

const bulkManifest = {
  id: "manifest_ed_campus_safety_dataset",
  source_family: "ed_campus_safety_dataset",
  legal_risk_class: "low_official_structured",
  bulk_import_eligible: true,
  default_review_tier: "imported_public_source",
  source_urls: ["https://ope.ed.gov/campussafety/"],
  acquisition_date: "2026-07-06",
  importer_command: "npm run import:ed-campus-safety-scoped",
  field_map: {},
  duplicate_strategy: "stable deterministic source locator key",
  sampling_plan: "Review deterministic samples from every import wave.",
  known_limits: ["Official structured source records are imported public-source records, not individual human certification."],
  publishable_fields: ["school_id", "date", "category", "affected_communities", "source_locator"],
  prohibited_fields: ["student_name", "private_email", "private_phone", "private_address"],
  exclusion_rules: ["Exclude rows with private-person identifiers."]
};

const manualManifest = {
  ...bulkManifest,
  id: "manifest_university_statement",
  source_family: "university_statement",
  legal_risk_class: "medium_institutional_public_statement",
  bulk_import_eligible: false,
  default_review_tier: "source_family_checked"
};

const schools = [
  {
    id: "brown_university",
    name: "Brown University",
    city: "Providence",
    state: "RI",
    country: "US"
  }
];

function candidate(overrides = {}) {
  return {
    candidate_id: "cand_ed_001",
    manifest_id: "manifest_ed_campus_safety_dataset",
    source_family: "ed_campus_safety_dataset",
    source_url: "https://ope.ed.gov/campussafety/",
    source_locator: "Crime2023EXCEL workbook, Hate Crimes sheet, row 42, column C, cell C42.",
    school_id: "brown_university",
    institution_name: "Brown University",
    date: "2023-01-01",
    date_precision: "year",
    category: "Vandalism",
    affected_communities: ["Religion"],
    summary: "Official ED Campus Safety dataset row reports one hate-crime entry for Brown University.",
    raw_source_hash: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    import_notes: "Imported from official structured public dataset.",
    ...overrides
  };
}

test("validateImportWaveCandidates accepts bulk-eligible official structured candidates", () => {
  const result = validateImportWaveCandidates({
    waveId: "ed-campus-safety-wave-001",
    candidates: [candidate()],
    manifests: [bulkManifest],
    schools,
    existingEvents: []
  });

  assert.equal(result.publishable, true);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.accepted[0].review_tier, "imported_public_source");
  assert.deepEqual(result.quarantine, []);
  assert.equal(result.wave.accepted_count, 1);
  assert.equal(result.wave.quarantined_count, 0);
  assert.equal(result.wave.source_manifest.id, "manifest_ed_campus_safety_dataset");
});

test("validateImportWaveCandidates quarantines missing locators, private fields, and overclaims", () => {
  const result = validateImportWaveCandidates({
    waveId: "ed-campus-safety-wave-001",
    candidates: [
      candidate({
        candidate_id: "cand_bad_001",
        source_locator: "",
        student_name: "Private Student",
        summary: "This record proves the university is liable and is the worst school."
      })
    ],
    manifests: [bulkManifest],
    schools,
    existingEvents: []
  });

  assert.equal(result.publishable, false);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.quarantine.length, 1);
  assert.deepEqual(result.quarantine[0].reason_codes.sort(), [
    "missing_source_locator",
    "prohibited_private_field",
    "prohibited_public_claim"
  ]);
});

test("validateImportWaveCandidates blocks bulk-ineligible source families", () => {
  const result = validateImportWaveCandidates({
    waveId: "university-statement-wave-001",
    candidates: [
      candidate({
        candidate_id: "cand_statement_001",
        manifest_id: "manifest_university_statement",
        source_family: "university_statement"
      })
    ],
    manifests: [manualManifest],
    schools,
    existingEvents: []
  });

  assert.equal(result.publishable, false);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.quarantine[0].reason_codes.includes("bulk_import_not_allowed"), true);
});

test("candidateDuplicateKey is stable and duplicate rows are quarantined deterministically", () => {
  const first = candidate({ candidate_id: "cand_dup_001" });
  const second = candidate({ candidate_id: "cand_dup_002" });

  assert.equal(candidateDuplicateKey(first), candidateDuplicateKey(second));

  const result = validateImportWaveCandidates({
    waveId: "ed-campus-safety-wave-001",
    candidates: [first, second],
    manifests: [bulkManifest],
    schools,
    existingEvents: []
  });

  assert.equal(result.accepted.length, 1);
  assert.equal(result.quarantine.length, 1);
  assert.equal(result.quarantine[0].reason_codes.includes("duplicate_candidate"), true);
  assert.equal(result.wave.duplicate_count, 1);
});

test("runImportWave returns valid wave and quarantine artifacts", () => {
  const artifacts = runImportWave({
    waveId: "ed-campus-safety-wave-001",
    candidates: [candidate(), candidate({ candidate_id: "cand_missing_school", school_id: "unknown_school" })],
    manifests: [bulkManifest],
    schools,
    existingEvents: [],
    command: "node scripts/import-wave-runner.mjs --candidates data/import-candidates/ed-campus-safety-wave-001.json --wave-id ed-campus-safety-wave-001",
    generatedAt: "2026-07-06",
    datasetHashBefore: "sha256:before",
    datasetHashAfter: "sha256:after"
  });

  assert.deepEqual(validateImportWaveArtifacts(artifacts), []);
  assert.equal(artifacts.wave.attempted_count, 2);
  assert.equal(artifacts.wave.accepted_count, 1);
  assert.equal(artifacts.wave.quarantined_count, 1);
  assert.equal(artifacts.quarantine.rows[0].reason_codes.includes("unknown_school"), true);
});

test("runImportWave preserves excluded source-row counts and artifacts", () => {
  const artifacts = runImportWave({
    waveId: "ocr-open-investigations-wave-001",
    candidates: [candidate()],
    manifests: [bulkManifest],
    schools,
    existingEvents: [],
    command: "node scripts/import-wave-runner.mjs --candidates data/import-candidates/ocr-open-investigations-wave-001.json --wave-id ocr-open-investigations-wave-001 --exclusions data/import-exclusions/ocr-open-investigations-wave-001.json",
    generatedAt: "2026-07-07",
    datasetHashBefore: "sha256:before",
    datasetHashAfter: "sha256:after",
    excludedCount: 42,
    exclusionArtifact: "data/import-exclusions/ocr-open-investigations-wave-001.json"
  });

  assert.equal(artifacts.wave.excluded_count, 42);
  assert.equal(artifacts.wave.exclusion_artifact, "data/import-exclusions/ocr-open-investigations-wave-001.json");
  assert.deepEqual(validateImportWaveArtifacts(artifacts), []);
});

test("validateImportWaveCandidates handles 40000 generated candidates without changing review tier semantics", () => {
  const candidates = Array.from({ length: 40000 }, (_, index) =>
    candidate({
      candidate_id: `cand_scale_${String(index + 1).padStart(5, "0")}`,
      source_locator: `Crime2023EXCEL workbook, Hate Crimes sheet, row ${index + 2}, column C, cell C${index + 2}.`,
      raw_source_hash: `sha256:${String(index + 1).padStart(64, "0").slice(0, 64)}`
    })
  );

  const result = validateImportWaveCandidates({
    waveId: "ed-campus-safety-scale-test",
    candidates,
    manifests: [bulkManifest],
    schools,
    existingEvents: []
  });

  assert.equal(result.accepted.length, 40000);
  assert.equal(result.quarantine.length, 0);
  assert.equal(result.wave.accepted_count, 40000);
  assert.equal(result.wave.qa_gate_counts.accepted, 40000);
  assert.equal(new Set(result.accepted.map((row) => row.review_tier)).size, 1);
  assert.equal(result.accepted[0].review_tier, "imported_public_source");
});
