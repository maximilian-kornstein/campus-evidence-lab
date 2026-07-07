import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOcrOpenInvestigationCandidates,
  ocrOpenInvestigationPageUrl,
  parseOcrDisplayCount,
  parseOcrOpenInvestigationRowsFromText
} from "../scripts/ocr-open-investigations-lib.mjs";

const schools = [
  {
    id: "alabama_a_m_university",
    name: "Alabama A & M University",
    city: "Normal",
    state: "AL",
    country: "US"
  },
  {
    id: "coastal_alabama_community_college",
    name: "Coastal Alabama Community College",
    city: "Bay Minette",
    state: "AL",
    country: "US"
  }
];

const sampleText = `
State\tInstitution\tInstitution Type\tType of Discrimination\tOpen Investigation Date
AL\tALABAMA A & M UNIVERSITY\tPSE\tTitle IX - Retaliation\t08/24/2016
AL\tALABAMA INSTITUTE FOR THE DEAF AND BLIND\tESE\tDisability - Denial of Benefits\t11/13/2024
AL\tCOASTAL ALABAMA COMMUNITY COLLEGE\tPSE\tTitle VI - Racial Harassment\t07/28/2023
Displaying 1 - 20 of 12079 records
`;

test("parseOcrOpenInvestigationRowsFromText parses OCR table rows without filter chrome", () => {
  const rows = parseOcrOpenInvestigationRowsFromText(sampleText);

  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {
    state: "AL",
    institution: "ALABAMA A & M UNIVERSITY",
    institution_type: "PSE",
    discrimination_type: "Title IX - Retaliation",
    open_investigation_date: "08/24/2016"
  });
});

test("parseOcrDisplayCount extracts page window and total record count", () => {
  assert.deepEqual(parseOcrDisplayCount(sampleText), {
    start: 1,
    end: 20,
    total: 12079
  });
});

test("ocrOpenInvestigationPageUrl builds stable paginated source URLs", () => {
  assert.equal(
    ocrOpenInvestigationPageUrl({ page: 2, itemsPerPage: 1000 }),
    "https://ocrcas.ed.gov/open-investigations?field_ois_discrimination_statute=All&field_ois_institution=&field_ois_institution_type=All&field_ois_state=All&field_ois_type_of_discrimination=All&field_open_investigation_date=&field_open_investigation_date_1=&field_open_investigation_date_2=&field_open_investigation_date_3=&items_per_page=1000&page=2"
  );
});

test("buildOcrOpenInvestigationCandidates excludes ESE rows and creates source-bounded PSE candidates", () => {
  const rows = parseOcrOpenInvestigationRowsFromText(sampleText);
  const result = buildOcrOpenInvestigationCandidates({
    rows,
    schools,
    waveId: "ocr-open-investigations-wave-001",
    sourcePageUrl: ocrOpenInvestigationPageUrl({ page: 0, itemsPerPage: 1000 })
  });

  assert.equal(result.candidates.length, 2);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].reason_code, "non_postsecondary_institution");

  const titleIx = result.candidates[0];
  assert.equal(titleIx.manifest_id, "manifest_ocr_open_investigation");
  assert.equal(titleIx.source_family, "ocr_open_investigation");
  assert.equal(titleIx.school_id, "alabama_a_m_university");
  assert.equal(titleIx.date, "2016-08-24");
  assert.equal(titleIx.date_precision, "day");
  assert.equal(titleIx.category, "Title IX compliance");
  assert.deepEqual(titleIx.affected_communities, ["Gender"]);
  assert.match(titleIx.source_locator, /institution=ALABAMA A & M UNIVERSITY/);
  assert.match(titleIx.summary, /listed an open investigation/);
  assert.doesNotMatch(titleIx.summary.toLowerCase(), /violation|liable|finding|proved/);
  assert.match(titleIx.import_notes, /does not mean OCR made a decision or finding/);

  const titleVi = result.candidates[1];
  assert.deepEqual(titleVi.affected_communities, ["Race", "National origin"]);
  assert.equal(titleVi.category, "OCR complaint");
});

test("buildOcrOpenInvestigationCandidates leaves unknown PSE schools for QA quarantine", () => {
  const result = buildOcrOpenInvestigationCandidates({
    rows: [
      {
        state: "ZZ",
        institution: "UNMAPPED UNIVERSITY",
        institution_type: "PSE",
        discrimination_type: "Disability - Accessibility",
        open_investigation_date: "01/02/2024"
      }
    ],
    schools,
    waveId: "ocr-open-investigations-wave-001",
    sourcePageUrl: ocrOpenInvestigationPageUrl({ page: 0, itemsPerPage: 1000 })
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].school_id, "");
  assert.equal(result.candidates[0].institution_name, "UNMAPPED UNIVERSITY");
  assert.equal(result.candidates[0].category, "Disability access");
  assert.deepEqual(result.candidates[0].affected_communities, ["Students with disabilities"]);
});

test("buildOcrOpenInvestigationCandidates caps candidates without truncating non-PSE exclusions", () => {
  const result = buildOcrOpenInvestigationCandidates({
    rows: [
      {
        state: "AL",
        institution: "ALABAMA A & M UNIVERSITY",
        institution_type: "PSE",
        discrimination_type: "Title IX - Retaliation",
        open_investigation_date: "08/24/2016"
      },
      {
        state: "AL",
        institution: "COASTAL ALABAMA COMMUNITY COLLEGE",
        institution_type: "PSE",
        discrimination_type: "Title VI - Racial Harassment",
        open_investigation_date: "07/28/2023"
      },
      {
        state: "AL",
        institution: "ALABAMA INSTITUTE FOR THE DEAF AND BLIND",
        institution_type: "ESE",
        discrimination_type: "Disability - Denial of Benefits",
        open_investigation_date: "11/13/2024"
      }
    ],
    schools,
    waveId: "ocr-open-investigations-wave-001",
    limit: 1
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.excluded.length, 1);
  assert.equal(result.excluded[0].row.institution, "ALABAMA INSTITUTE FOR THE DEAF AND BLIND");
});

test("buildOcrOpenInvestigationCandidates can quarantine unknown PSE schools before wave QA", () => {
  const result = buildOcrOpenInvestigationCandidates({
    rows: [
      {
        state: "AL",
        institution: "ALABAMA A & M UNIVERSITY",
        institution_type: "PSE",
        discrimination_type: "Title IX - Retaliation",
        open_investigation_date: "08/24/2016"
      },
      {
        state: "ZZ",
        institution: "UNMAPPED UNIVERSITY",
        institution_type: "PSE",
        discrimination_type: "Disability - Accessibility",
        open_investigation_date: "01/02/2024"
      }
    ],
    schools,
    waveId: "ocr-open-investigations-wave-001",
    requireKnownSchool: true
  });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].school_id, "alabama_a_m_university");
  assert.equal(result.mapping_quarantine.length, 1);
  assert.match(result.mapping_quarantine[0].candidate_id, /^cand_ocr_[a-f0-9]{18}$/);
  assert.deepEqual(result.mapping_quarantine[0].reason_codes, ["unknown_school"]);
  assert.match(result.mapping_quarantine[0].remediation_action, /Resolve institution identity/);
});
