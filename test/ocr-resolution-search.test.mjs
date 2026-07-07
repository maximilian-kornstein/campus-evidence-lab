import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOcrResolutionCandidate,
  ocrResolutionSearchPageUrl,
  parseOcrResolutionRows
} from "../scripts/ocr-resolution-search-lib.mjs";

test("parseOcrResolutionRows extracts institution, state, reference, resolved date, and document links", () => {
  const rows = parseOcrResolutionRows([
    {
      text: "ABILENE CHRISTIAN UNIVERSITY (TX) (06172260) 11/03/2017 Letter Agreement Modified",
      links: [
        { text: "Letter", href: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/06172260-a.pdf" },
        { text: "Agreement", href: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/06172260-b.pdf" },
        { text: "Modified", href: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/06172260-b1.pdf" }
      ]
    }
  ]);

  assert.deepEqual(rows[0], {
    institution: "ABILENE CHRISTIAN UNIVERSITY",
    state: "TX",
    ocr_reference: "06172260",
    resolved_date: "11/03/2017",
    letter_url: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/06172260-a.pdf",
    agreement_url: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/06172260-b.pdf",
    modified_agreement_url: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/06172260-b1.pdf"
  });
});

test("parseOcrResolutionRows keeps rows without modified agreements", () => {
  const rows = parseOcrResolutionRows([
    {
      text: "ACADEMY OF ART UNIVERSITY (CA) (09162299) 07/26/2018 Letter Agreement",
      links: [
        { text: "Letter", href: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/09162299-a.pdf" },
        { text: "Agreement", href: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/09162299-b.pdf" }
      ]
    }
  ]);

  assert.equal(rows[0].modified_agreement_url, "");
});

test("ocrResolutionSearchPageUrl builds the postsecondary facet URL", () => {
  assert.equal(
    ocrResolutionSearchPageUrl({ page: 3 }),
    "https://ocrcas.ed.gov/ocr-search?f%5B0%5D=it%3APost%20Secondary&page=3"
  );
});

test("buildOcrResolutionCandidate uses neutral resolution-document wording", () => {
  const candidate = buildOcrResolutionCandidate({
    row: {
      institution: "Brown University",
      state: "RI",
      ocr_reference: "01242116",
      resolved_date: "07/08/2024",
      letter_url: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/01242116-a.pdf",
      agreement_url: "https://ocrcas.ed.gov/sites/default/files/ocr-letters-and-agreements/01242116-b.pdf",
      modified_agreement_url: ""
    },
    school: { id: "brown_university", name: "Brown University" },
    waveId: "ocr-resolution-search-wave-001"
  });

  assert.equal(candidate.candidate_id, "cand_ocr_resolution_01242116");
  assert.equal(candidate.source_family, "ocr_resolution_document");
  assert.equal(candidate.school_id, "brown_university");
  assert.equal(candidate.date, "2024-07-08");
  assert.equal(candidate.date_precision, "day");
  assert.deepEqual(candidate.affected_communities, ["Civil rights"]);
  assert.match(candidate.summary, /OCR resolution documents/);
  assert.doesNotMatch(candidate.summary, /violation|guilty|liable|ranking|score/i);
});
