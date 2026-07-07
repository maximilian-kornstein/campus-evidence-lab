import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEdCampusSafetySchoolsFromSourceRows,
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
  default_record_lane: "aggregate_safety_stat",
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
    profileId: "ed_vawa_2025",
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
  assert.equal(rows[0].record_lane, "aggregate_safety_stat");
});

test("edCampusSafetyAggregateRowsFromSheet extracts sex-offense crime aggregate cells without VAWA labels", () => {
  const rows = edCampusSafetyAggregateRowsFromSheet({
    profileId: "ed_sex_offense_crime_2025",
    workbookName: "Oncampuscrime222324.xls",
    sheetRows: [
      ["UNITID_P", "INSTNM", "OPEID", "BRANCH", "Address", "City", "State", "ZIP", "sector_cd", "Sector_desc", "men_total", "women_total", "Total", "MURD24", "RAPE24", "FONDL24", "INCES24", "STATR24", "FILTER24"],
      [217156001, "Brown University", "00340100", "Main Campus", "1 Prospect St", "Providence", "RI", "02912", 2, "Private nonprofit", 4000, 5000, 9000, 0, 2, 1, "", 1, 1]
    ]
  });

  assert.deepEqual(
    rows.map((row) => row.statistic),
    ["Rape", "Fondling", "Statutory rape"]
  );
  assert.equal(rows[0].category, "Official aggregate safety statistic");
  assert.deepEqual(rows[0].affected_communities, ["Campus community"]);
  assert.equal(rows[0].record_lane, "aggregate_safety_stat");
});

test("buildEdCampusSafetySchoolsFromSourceRows expands unknown ED institutions and preserves unitid identity", () => {
  const sourceRows = [
    {
      unitid: "217156001",
      institution_name: "Brown University",
      city: "Providence",
      state: "RI",
      zip: "02912",
      school_id: "brown_university"
    },
    {
      unitid: "999999001",
      institution_name: "Example Training College",
      city: "Austin",
      state: "TX",
      zip: "78701",
      school_id: "example_training_college"
    },
    {
      unitid: "999999002",
      institution_name: "Example Training College",
      city: "Dallas",
      state: "TX",
      zip: "75201",
      school_id: "example_training_college"
    }
  ];

  const { schools: expanded, added_count } = buildEdCampusSafetySchoolsFromSourceRows({
    schools: [
      {
        id: "brown_university",
        name: "Brown University",
        city: "Providence",
        state: "RI",
        country: "US",
        source_identifiers: { ed_unitids: ["217156001"] }
      }
    ],
    sourceRows
  });

  assert.equal(added_count, 2);
  assert.equal(expanded.find((school) => school.id === "brown_university").source_identifiers.ed_unitids.includes("217156001"), true);
  assert.equal(expanded.some((school) => school.id === "example_training_college"), true);
  assert.equal(expanded.some((school) => school.id === "example_training_college_999999002"), true);
});

test("buildEdCampusSafetyAggregateCandidates emits neutral publishable candidates for known schools", () => {
  const sourceRows = edCampusSafetyAggregateRowsFromSheet({
    profileId: "ed_vawa_2025",
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
  assert.equal(candidates[0].record_lane, "aggregate_safety_stat");
  assert.equal(candidates[0].date, "2024-01-01");
  assert.equal(candidates[0].date_precision, "year");
  assert.equal(candidates[0].category, "Official aggregate safety statistic");
  assert.deepEqual(candidates[0].affected_communities, ["Campus community"]);
  assert.match(candidates[0].summary, /VAWA aggregate statistic/);
  assert.doesNotMatch(candidates[0].summary, /ranking|score|prevalence|legal finding/i);
  assert.doesNotMatch(candidates[0].import_notes, /ranking|score|prevalence|legal finding|human certification/i);

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
  assert.equal(result.accepted[0].record_lane, "aggregate_safety_stat");
});
