import test from "node:test";
import assert from "node:assert/strict";
import { buildGovernmentReleaseResponseDepthRepairQueue } from "../scripts/government-release-response-depth-repair-queue-lib.mjs";

test("creates exact repair proposals for flagged government-release response-depth records", () => {
  const queue = buildGovernmentReleaseResponseDepthRepairQueue({
    events: [
      {
        id: "evt_direct",
        school_id: "school_one",
        source_ids: ["src_release"],
        response_depth: "direct_institutional_response",
        institutional_response:
          "The source announces an OCR investigation. The current record does not summarize the institution's response beyond the public government action.",
        field_support: [
          {
            field: "Institutional response",
            source_ids: ["src_release"],
            rationale: 'Response-depth classification is "direct_institutional_response" based on the stored public response text.'
          }
        ]
      },
      {
        id: "evt_missing",
        school_id: "school_two",
        source_ids: ["src_release"],
        institutional_response:
          "The record currently summarizes the public federal finding and accreditor notification; it does not evaluate the completed response."
      }
    ],
    audit: {
      records: [
        {
          event_id: "evt_direct",
          issue_id: "government_release_direct_response_overstatement_risk",
          recommended_response_depth: "limited_public_response_note",
          rationale: "The source family is government-release-like and the response text limits the note to public government action."
        },
        {
          event_id: "evt_missing",
          issue_id: "government_release_missing_response_depth",
          recommended_response_depth: "limited_public_response_note",
          rationale: "The record has stored response text but no explicit response-depth classification."
        }
      ]
    }
  });

  assert.equal(queue.proposed_repairs, 2);
  assert.deepEqual(queue.issue_counts, {
    government_release_direct_response_overstatement_risk: 1,
    government_release_missing_response_depth: 1
  });

  const direct = queue.records.find((record) => record.event_id === "evt_direct");
  assert.equal(direct.current_response_depth, "direct_institutional_response");
  assert.equal(direct.proposed_response_depth, "limited_public_response_note");
  assert.equal(direct.operations[0].op, "replace");
  assert.equal(direct.operations[0].path, "/response_depth");
  assert.equal(direct.operations[1].op, "replace");
  assert.equal(direct.operations[1].path, "/field_support/Institutional response");
  assert.match(direct.operations[1].value.rationale, /does not document a direct institutional response/i);

  const missing = queue.records.find((record) => record.event_id === "evt_missing");
  assert.equal(missing.current_response_depth, null);
  assert.equal(missing.operations[0].op, "add");
  assert.equal(missing.operations[0].path, "/response_depth");
});

test("omits unflagged audit rows and marks missing source event rows as blocked", () => {
  const queue = buildGovernmentReleaseResponseDepthRepairQueue({
    events: [],
    audit: {
      records: [
        {
          event_id: "evt_missing_event",
          issue_id: "government_release_missing_response_depth",
          recommended_response_depth: "limited_public_response_note",
          rationale: "No response-depth classification."
        },
        {
          event_id: "evt_clean",
          issue_id: null,
          recommended_response_depth: "limited_public_response_note"
        }
      ]
    }
  });

  assert.equal(queue.proposed_repairs, 0);
  assert.equal(queue.blocked_repairs, 1);
  assert.equal(queue.records[0].status, "blocked_missing_event_row");
  assert.equal(queue.records.some((record) => record.event_id === "evt_clean"), false);
});

test("keeps repair queue language neutral and non-certifying", () => {
  const queue = buildGovernmentReleaseResponseDepthRepairQueue({ events: [], audit: { records: [] } });
  const text = JSON.stringify(queue);

  assert.equal(queue.public_claim_limit.includes("not certification"), true);
  assert.equal(/\b(?:external validation|endorsement|ranking|prevalence|safety score|severity score|legal truth)\b/i.test(text), false);
});
