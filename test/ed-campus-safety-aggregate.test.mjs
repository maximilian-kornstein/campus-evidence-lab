import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEdCampusSafetyAggregateCandidates,
  columnLetter,
  edCampusSafetyAggregateRowsFromSheet
} from "../scripts/ed-campus-safety-aggregate-lib.mjs";
import { validateImportWaveCandidates } from "../scripts/import-wave-lib.mjs";

const manifest = {
  id: "manifest_ed_campus_safety_dataset",
  source_family: "ed_campus_safety_dataset",
  legal_risk_class: "low_official_structured",
  bulk_import_eligible: true,
  default_review_tier: "imported_public_source",
  source_urls: ["https://ope.ed.gov/campussafety/"],
  acquisition_date: "2026-07-06",
  importer_command: "node scripts/export-ed-campus-safety-aggregate-wave-candidates.mjs",
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

test("columnLetter converts zero-based indexes to Excel column labels", () => {
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
});

test("edCampusSafetyAggregateRowsFromSheet extracts positive VAWA aggregate cells", () => {
  const rows = edCampusSafetyAggregateRowsFromSheet({
    workbookName: "Oncampusvawa222324.xls",
    sheetRows: [
      ["UNITID_P", "INSTNM", "OPEID", "BRANCH", "Address", "City", "State", "ZIP", "sector_cd", "Sector_desc", "men_total", "women_total", "Total", "DOMEST24", "DATING24", "FILTER24"],
      [217156001, "Brown University", "00340100", "Main Campus", "1 Prospect St", "Providence", "RI", "02912", 2, "Private nonprofit", 4000, 5000, 9000, 2, "", 1]
    ]
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].institution_name, "Brown University");
  assert.equal(rows[0].scope, "on-campus");
  assert.equal(rows[0].year, "2024");
  assert.equal(rows[0].statistic, "Domestic violence");
  assert.equal(rows[0].count, 2);
  assert.equal(rows[0].cell, "N2");
});

test("buildEdCampusSafetyAggregateCandidates emits neutral publishable candidates for known schools", () => {
  const sourceRows = edCampusSafetyAggregateRowsFromSheet({
    workbookName: "Oncampusvawa222324.xls",
    sheetRows: [
      ["UNITID_P", "INSTNM", "OPEID", "BRANCH", "Address", "City", "State", "ZIP", "sector_cd", "Sector_desc", "men_total", "women_total", "Total", "DOMEST24", "DATING24", "FILTER24"],
      [217156001, "Brown University", "00340100", "Main Campus", "1 Prospect St", "Providence", "RI", "02912", 2, "Private nonprofit", 4000, 5000, 9000, 2, "", 1],
      [999999001, "Unknown College", "00999900", "Main Campus", "10 Main St", "Nowhere", "ZZ", "00000", 2, "Private nonprofit", 10, 10, 20, 1, "", 1]
    ]
  });

  const { candidates, mappingQuarantine } = buildEdCampusSafetyAggregateCandidates({
    waveId: "ed-campus-safety-vawa-wave-001",
    sourceRows,
    schools,
    limit: 10
  });

  assert.equal(candidates.length, 1);
  assert.equal(mappingQuarantine.length, 1);
  assert.equal(candidates[0].source_family, "ed_campus_safety_dataset");
  assert.equal(candidates[0].school_id, "brown_university");
  assert.equal(candidates[0].date, "2024-01-01");
  assert.equal(candidates[0].date_precision, "year");
  assert.deepEqual(candidates[0].affected_communities, ["Gender"]);
  assert.match(candidates[0].summary, /VAWA aggregate statistic/);
  assert.doesNotMatch(candidates[0].summary, /ranking|score|prevalence|legal finding/i);

  const result = validateImportWaveCandidates({
    waveId: "ed-campus-safety-vawa-wave-001",
    candidates,
    manifests: [manifest],
    schools,
    existingEvents: [],
    datasetHashBefore: "sha256:before",
    datasetHashAfter: "sha256:after",
    command: "node scripts/export-ed-campus-safety-aggregate-wave-candidates.mjs"
  });

  assert.equal(result.publishable, true);
  assert.equal(result.accepted.length, 1);
});
