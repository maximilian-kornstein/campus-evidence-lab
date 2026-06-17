import test from "node:test";
import assert from "node:assert/strict";
import { buildGovernmentReleaseResponseDepthAudit } from "../scripts/government-release-response-depth-audit-lib.mjs";

const sources = [
  {
    id: "src_government_release",
    title: "Agency opens investigation",
    source_type: "Government release",
    publisher: "U.S. Department of Education"
  },
  {
    id: "src_university_statement",
    title: "University response",
    source_type: "University statement",
    publisher: "Example University"
  }
];

test("flags government-release records labeled as direct institutional response when text limits response to government action", () => {
  const audit = buildGovernmentReleaseResponseDepthAudit({
    events: [
      {
        id: "evt_direct_overstatement",
        school_id: "school_one",
        source_ids: ["src_government_release"],
        source_types: ["Government release"],
        response_depth: "direct_institutional_response",
        institutional_response:
          "The source announces an OCR investigation. The current record does not summarize the institution's response beyond the public government action."
      },
      {
        id: "evt_limited_ok",
        school_id: "school_two",
        source_ids: ["src_government_release"],
        source_types: ["Government release"],
        response_depth: "limited_public_response_note",
        institutional_response: "The record summarizes a public OCR letter action and does not evaluate the institution's completed response."
      },
      {
        id: "evt_university_statement",
        school_id: "school_three",
        source_ids: ["src_university_statement"],
        source_types: ["University statement"],
        response_depth: "direct_institutional_response",
        institutional_response: "The university issued a direct public response."
      }
    ],
    sources
  });

  assert.equal(audit.records.length, 2);
  assert.equal(audit.flagged_records, 1);
  assert.deepEqual(audit.issue_counts, {
    government_release_direct_response_overstatement_risk: 1
  });

  const flagged = audit.records.find((record) => record.event_id === "evt_direct_overstatement");
  assert.equal(flagged.issue_id, "government_release_direct_response_overstatement_risk");
  assert.equal(flagged.current_response_depth, "direct_institutional_response");
  assert.equal(flagged.recommended_response_depth, "limited_public_response_note");
  assert.match(flagged.required_action, /Do not certify/);
});

test("flags government-release records with response text but no response-depth classification", () => {
  const audit = buildGovernmentReleaseResponseDepthAudit({
    events: [
      {
        id: "evt_missing_depth",
        school_id: "school_one",
        source_ids: ["src_government_release"],
        source_types: ["Government release"],
        institutional_response:
          "The record currently summarizes the public federal finding and accreditor notification; it does not evaluate the completed response."
      }
    ],
    sources
  });

  assert.equal(audit.flagged_records, 1);
  assert.equal(audit.records[0].issue_id, "government_release_missing_response_depth");
  assert.equal(audit.records[0].recommended_response_depth, "limited_public_response_note");
});

test("rejects prohibited validation and scoring language in generated audit text", () => {
  const audit = buildGovernmentReleaseResponseDepthAudit({ events: [], sources });
  const text = JSON.stringify(audit);

  assert.equal(/\b(?:external validation|safety score|school ranking|legal truth)\b/i.test(text), false);
  assert.equal(audit.public_claim_limit.includes("not certification"), true);
});
