import test from "node:test";
import assert from "node:assert/strict";
import {
  columnTagToHeader,
  edWorkbookNameForEvent,
  eventDatasetCount,
  matchEventToWorkbookRow,
  scopeTagForEvent,
  slugifyInstitution
} from "../scripts/ed-dataset-provenance-lib.mjs";

const event = {
  id: "evt_2026_0081",
  school_id: "university_of_alaska_anchorage",
  date: "2024-01-01",
  date_precision: "year",
  description:
    "According to the Department of Education Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files, the Oncampushate222324.xlsx workbook listed 2 reported on-campus hate-crime statistics for University of Alaska Anchorage in 2024: Destruction/damage/vandalism characterized by LGBTQ+.",
  source_ids: ["src_ed_campus_safety_2025_hate_crime_data_files"],
  tags: ["ed-campus-safety-data", "clery", "hate-crime-statistics", "on-campus", "vandal-sex24"]
};

test("columnTagToHeader reconstructs ED workbook column headers from event tags", () => {
  assert.equal(columnTagToHeader("vandal-sex24"), "VANDAL_SEX24");
  assert.equal(columnTagToHeader("agg-a-rac22"), "AGG_A_RAC22");
  assert.equal(columnTagToHeader("lar-t-rel23"), "LAR_T_REL23");
});

test("event helpers extract workbook, count, scope, and institution slug", () => {
  assert.equal(edWorkbookNameForEvent(event), "Oncampushate222324.xlsx");
  assert.equal(eventDatasetCount(event), 2);
  assert.equal(scopeTagForEvent(event), "on-campus");
  assert.equal(slugifyInstitution("University of Alaska Anchorage"), event.school_id);
});

test("matchEventToWorkbookRow returns exact row, column, and cell candidate", () => {
  const workbook = {
    workbook: "Oncampushate222324.xlsx",
    sheet: "sheet1",
    headers: [
      { value: "UNITID", column: "A", cell: "A1" },
      { value: "INSTNM", column: "B", cell: "B1" },
      { value: "CITY", column: "F", cell: "F1" },
      { value: "STABBR", column: "G", cell: "G1" },
      { value: "VANDAL_SEX24", column: "DS", cell: "DS1" }
    ],
    rows: [
      {
        row: 42,
        cells: {
          UNITID: { value: "102553", column: "A", cell: "A42" },
          INSTNM: { value: "University of Alaska Anchorage", column: "B", cell: "B42" },
          CITY: { value: "Anchorage", column: "F", cell: "F42" },
          STABBR: { value: "AK", column: "G", cell: "G42" },
          VANDAL_SEX24: { value: "2", column: "DS", cell: "DS42" }
        }
      }
    ]
  };

  assert.deepEqual(matchEventToWorkbookRow(event, workbook), {
    status: "matched",
    workbook: "Oncampushate222324.xlsx",
    sheet: "sheet1",
    row: 42,
    column: "VANDAL_SEX24",
    column_letter: "DS",
    cell: "DS42",
    cell_value: "2",
    source_year: "2024",
    scope: "on-campus",
    school_name: "University of Alaska Anchorage"
  });
});

test("matchEventToWorkbookRow explains unresolved matches without guessing", () => {
  const workbook = {
    workbook: "Oncampushate222324.xlsx",
    sheet: "sheet1",
    headers: [{ value: "INSTNM", column: "B", cell: "B1" }],
    rows: []
  };

  const result = matchEventToWorkbookRow(event, workbook);
  assert.equal(result.status, "unmatched");
  assert.match(result.reason, /missing column/i);
});

test("matchEventToWorkbookRow uses event location to resolve duplicate institution rows", () => {
  const duplicateEvent = {
    ...event,
    location: "Anchorage, AK"
  };
  const workbook = {
    workbook: "Oncampushate222324.xlsx",
    sheet: "sheet1",
    headers: [
      { value: "INSTNM", column: "B", cell: "B1" },
      { value: "CITY", column: "F", cell: "F1" },
      { value: "STABBR", column: "G", cell: "G1" },
      { value: "VANDAL_SEX24", column: "DS", cell: "DS1" }
    ],
    rows: [
      {
        row: 42,
        cells: {
          INSTNM: { value: "University of Alaska Anchorage", column: "B", cell: "B42" },
          CITY: { value: "Anchorage", column: "F", cell: "F42" },
          STABBR: { value: "AK", column: "G", cell: "G42" },
          VANDAL_SEX24: { value: "2", column: "DS", cell: "DS42" }
        }
      },
      {
        row: 43,
        cells: {
          INSTNM: { value: "University of Alaska Anchorage", column: "B", cell: "B43" },
          CITY: { value: "Juneau", column: "F", cell: "F43" },
          STABBR: { value: "AK", column: "G", cell: "G43" },
          VANDAL_SEX24: { value: "2", column: "DS", cell: "DS43" }
        }
      }
    ]
  };

  assert.equal(matchEventToWorkbookRow(duplicateEvent, workbook).cell, "DS42");
});
