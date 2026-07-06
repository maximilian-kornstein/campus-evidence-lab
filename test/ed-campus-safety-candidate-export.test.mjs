import test from "node:test";
import assert from "node:assert/strict";
import { buildEdCampusSafetyWaveCandidates } from "../scripts/ed-campus-safety-candidate-export-lib.mjs";
import { validateImportWaveCandidates } from "../scripts/import-wave-lib.mjs";

const manifest = {
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

const schools = [
  {
    id: "brown_university",
    name: "Brown University",
    city: "Providence",
    state: "RI",
    country: "US"
  }
];

const source = {
  id: "src_ed_campus_safety_2025_hate_crime_data_files",
  title: "Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files",
  url: "https://ope.ed.gov/campussafety/#/datafile/list",
  publisher: "U.S. Department of Education Office of Postsecondary Education",
  source_type: "Government dataset",
  published_date: "2026-04-30",
  accessed_date: "2026-06-03"
};

const event = {
  id: "evt_2026_0712",
  school_id: "brown_university",
  date: "2024-01-01",
  date_precision: "year",
  affected_communities: ["Religion"],
  category: "Harassment or threat",
  summary: "ED campus safety data listed 2 reported on-campus hate-crime statistics for Brown University.",
  source_ids: [source.id],
  source_types: ["Government dataset"],
  record_hash: "sha256:event"
};

const matchedAuditRow = {
  event_id: event.id,
  school_id: event.school_id,
  source_id: source.id,
  workbook: "Oncampushate222324.xlsx",
  scope: "on-campus",
  source_year: "2024",
  code_tag: "intim-rel24",
  expected_column: "INTIM_REL24",
  expected_count: 2,
  provenance_status: "matched",
  locator: {
    locator_type: "workbook_cell",
    workbook: "Oncampushate222324.xlsx",
    sheet: "sheet1",
    row: 42,
    column: "INTIM_REL24",
    column_letter: "NK",
    cell: "NK42",
    cell_value: "2",
    locator: "Oncampushate222324.xlsx > sheet1 row 42 > column INTIM_REL24 > cell NK42"
  }
};

test("buildEdCampusSafetyWaveCandidates exports matched ED provenance rows as import-wave candidates", () => {
  const candidates = buildEdCampusSafetyWaveCandidates({
    waveId: "ed-campus-safety-wave-002",
    limit: 1,
    events: [event],
    schools,
    sources: [source],
    edDatasetProvenanceAudit: {
      records: [
        matchedAuditRow,
        {
          ...matchedAuditRow,
          event_id: "evt_unmatched",
          provenance_status: "unmatched"
        }
      ]
    },
    usedCandidateIds: new Set()
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].candidate_id, "cand_ed_evt_2026_0712");
  assert.equal(candidates[0].existing_event_id, event.id);
  assert.equal(candidates[0].manifest_id, "manifest_ed_campus_safety_dataset");
  assert.equal(candidates[0].source_family, "ed_campus_safety_dataset");
  assert.equal(candidates[0].source_url, source.url);
  assert.equal(candidates[0].source_locator, matchedAuditRow.locator.locator);
  assert.match(candidates[0].raw_source_hash, /^sha256:/);

  const result = validateImportWaveCandidates({
    waveId: "ed-campus-safety-wave-002",
    candidates,
    manifests: [manifest],
    schools,
    existingEvents: []
  });

  assert.equal(result.publishable, true);
  assert.equal(result.accepted_count, undefined);
  assert.equal(result.accepted[0].review_tier, "imported_public_source");
});

test("buildEdCampusSafetyWaveCandidates skips prior candidates and current records with stored locators", () => {
  const candidates = buildEdCampusSafetyWaveCandidates({
    waveId: "ed-campus-safety-wave-002",
    limit: 5,
    events: [
      event,
      {
        ...event,
        id: "evt_2026_0999",
        source_locators: [{ locator: matchedAuditRow.locator.locator }]
      }
    ],
    schools,
    sources: [source],
    edDatasetProvenanceAudit: {
      records: [
        matchedAuditRow,
        {
          ...matchedAuditRow,
          event_id: "evt_2026_0999"
        }
      ]
    },
    usedCandidateIds: new Set(["cand_ed_evt_2026_0712"])
  });

  assert.deepEqual(candidates, []);
});
