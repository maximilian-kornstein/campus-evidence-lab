import assert from "node:assert/strict";
import test from "node:test";
import { buildApiV1Payloads, hasPrivateApiField, validateApiV1Payloads } from "../scripts/api-v1-lib.mjs";

const manifest = {
  snapshot_id: "snapshot_test",
  created_at: "2026-07-07",
  dataset_hash: "sha256:test",
  totals: { events: 1, schools: 1, sources: 1 }
};

const schools = [{ id: "brown_university", name: "Brown University", city: "Providence", state: "RI" }];
const events = [
  {
    id: "evt_1",
    school_id: "brown_university",
    source_ids: ["src_1"],
    record_hash: "sha256:event",
    source_locator: "OCR release",
    category: "OCR complaint",
    date: "2024-07-08"
  }
];
const sources = [
  {
    id: "src_1",
    title: "OCR source",
    url: "https://example.edu/source",
    publisher: "ED OCR",
    source_type: "Government release"
  }
];
const importWaves = [
  {
    id: "wave_1",
    source_family: "ed_campus_safety_dataset",
    accepted_count: 42,
    quarantined_count: 0,
    status: "passed"
  }
];
const accountabilitySignals = {
  snapshot_id: "snapshot_test",
  generated_at: "2026-07-07",
  public_use_limits: ["Accepted import-wave QA candidates are not individual human certification of every row."],
  totals: { institutions: 1, public_event_records: 1, accepted_import_wave_qa_candidates: 42 },
  institutions: [
    {
      school_id: "brown_university",
      name: "Brown University",
      city: "Providence",
      state: "RI",
      public_event_count: 1,
      accepted_candidate_count: 42,
      source_family_counts: { ed_campus_safety_dataset: 42 },
      import_wave_ids: ["wave_1"],
      signals: [{ id: "source_backed_event_records", label: "source-backed event records present" }],
      public_use_limits: ["Accepted import-wave QA candidates are not individual human certification of every row."],
      unresolved_limits: []
    }
  ]
};

test("buildApiV1Payloads creates versioned public-safe endpoint payloads", () => {
  const payloads = buildApiV1Payloads({
    manifest,
    schools,
    events,
    sources,
    importWaves,
    accountabilitySignals
  });

  assert.equal(payloads.index.api_version, "v1");
  assert.equal(payloads.snapshot.snapshot_id, "snapshot_test");
  assert.equal(payloads.institutionsIndex.institutions[0].school_id, "brown_university");
  assert.equal(payloads.institutionDetails.get("brown_university").accepted_candidate_count, 42);
  assert.equal(payloads.institutionDetails.get("brown_university").routes.api, "/api/v1/institutions/brown_university.json");
  assert.equal(payloads.citationPackets.get("brown_university").sources[0].url, "https://example.edu/source");
  assert.equal(payloads.index.public_use_limits.some((limit) => /not rankings/i.test(limit)), true);
});

test("hasPrivateApiField catches private and quarantine fields", () => {
  assert.equal(hasPrivateApiField("private_email"), true);
  assert.equal(hasPrivateApiField("raw_quarantine_row"), true);
  assert.equal(hasPrivateApiField("school_id"), false);
});

test("validateApiV1Payloads rejects missing limits and private fields", () => {
  const payloads = buildApiV1Payloads({
    manifest,
    schools,
    events,
    sources,
    importWaves,
    accountabilitySignals
  });
  assert.deepEqual(validateApiV1Payloads(payloads), []);

  const missingLimits = {
    ...payloads,
    index: { ...payloads.index, public_use_limits: [] }
  };
  assert.equal(validateApiV1Payloads(missingLimits).some((error) => /public_use_limits/i.test(error)), true);

  const privateField = {
    ...payloads,
    institutionsIndex: {
      ...payloads.institutionsIndex,
      institutions: [{ ...payloads.institutionsIndex.institutions[0], private_email: "person@example.edu" }]
    }
  };
  assert.equal(validateApiV1Payloads(privateField).some((error) => /private/i.test(error)), true);
});
