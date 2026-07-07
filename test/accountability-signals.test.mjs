import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountabilitySignals,
  hasProhibitedSignalLanguage,
  validateAccountabilitySignals
} from "../scripts/accountability-signals-lib.mjs";

const schools = [
  { id: "brown_university", name: "Brown University", city: "Providence", state: "RI" },
  { id: "quiet_college", name: "Quiet College", city: "Example", state: "CA" }
];

const events = [
  {
    id: "evt_1",
    school_id: "brown_university",
    source_ids: ["src_ocr"],
    response_depth: "direct_institution_response",
    institutional_response: "Brown University published a public response.",
    source_locator: "OCR release"
  },
  {
    id: "evt_2",
    school_id: "brown_university",
    source_ids: ["src_ed"],
    response_depth: "limited_public_response_note",
    institutional_response: "The dataset does not independently evaluate response outcomes."
  }
];

const sources = [
  { id: "src_ocr", source_type: "Government release", publisher: "U.S. Department of Education Office for Civil Rights" },
  { id: "src_ed", source_type: "Government dataset", publisher: "U.S. Department of Education" }
];

const institutionImportWaveSummary = {
  accepted_candidate_count: 150000,
  institution_count: 2,
  institutions: [
    {
      school_id: "brown_university",
      accepted_candidate_count: 42,
      source_family_counts: { ed_campus_safety_dataset: 40, ocr_open_investigation: 2 },
      record_lane_counts: { aggregate_safety_stat: 40, civil_rights_case: 2 },
      import_wave_ids: ["wave_1", "wave_2"],
      latest_source_year: "2025"
    }
  ]
};

const corrections = [{ id: "correction_1", event_id: "evt_1", status: "resolved" }];

test("buildAccountabilitySignals separates public events from accepted import-wave candidates", () => {
  const artifact = buildAccountabilitySignals({
    schools,
    events,
    sources,
    institutionImportWaveSummary,
    corrections,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-07-07" }
  });
  const brown = artifact.institutions.find((institution) => institution.school_id === "brown_university");

  assert.equal(artifact.snapshot_id, "snapshot_test");
  assert.equal(brown.public_event_count, 2);
  assert.equal(brown.accepted_candidate_count, 42);
  assert.equal(brown.source_family_counts.ed_campus_safety_dataset, 40);
  assert.equal(brown.signals.some((signal) => signal.id === "accepted_official_source_qa_candidates"), true);
  assert.equal(brown.public_use_limits.some((limit) => /not individual human certification/i.test(limit)), true);
});

test("buildAccountabilitySignals describes missing evidence without implying absence outside the snapshot", () => {
  const artifact = buildAccountabilitySignals({
    schools,
    events,
    sources,
    institutionImportWaveSummary,
    corrections: [],
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-07-07" }
  });
  const quiet = artifact.institutions.find((institution) => institution.school_id === "quiet_college");

  assert.equal(quiet.public_event_count, 0);
  assert.equal(quiet.accepted_candidate_count, 0);
  assert.equal(quiet.signals.some((signal) => signal.id === "limited_current_snapshot"), true);
  assert.match(quiet.unresolved_limits.join(" "), /current snapshot/i);
});

test("hasProhibitedSignalLanguage catches ranking and scoring language", () => {
  assert.equal(hasProhibitedSignalLanguage("high risk institution"), true);
  assert.equal(hasProhibitedSignalLanguage("safety score"), true);
  assert.equal(hasProhibitedSignalLanguage("source-backed event records present"), false);
});

test("validateAccountabilitySignals rejects prohibited claims and count drift", () => {
  const artifact = buildAccountabilitySignals({
    schools,
    events,
    sources,
    institutionImportWaveSummary,
    corrections,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-07-07" }
  });
  assert.deepEqual(validateAccountabilitySignals({ artifact, schools, events, institutionImportWaveSummary }), []);

  const prohibited = structuredClone(artifact);
  prohibited.institutions[0].signals[0].label = "High risk school";
  assert.equal(
    validateAccountabilitySignals({ artifact: prohibited, schools, events, institutionImportWaveSummary }).some((error) =>
      /prohibited/i.test(error)
    ),
    true
  );

  const drift = structuredClone(artifact);
  drift.institutions[0].accepted_candidate_count += 1;
  assert.equal(
    validateAccountabilitySignals({ artifact: drift, schools, events, institutionImportWaveSummary }).some((error) => /candidate count/i.test(error)),
    true
  );
});
