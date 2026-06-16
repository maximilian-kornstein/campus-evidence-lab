import test from "node:test";
import assert from "node:assert/strict";
import { responseDepthDisplayProfile, responseDisplayProfile } from "../assets/record-display.js";

test("responseDisplayProfile shows substantive institutional responses", () => {
  const profile = responseDisplayProfile({
    institutional_response: "The university said it would revise its policies and provide training.",
    response_date: "2025-01-15"
  });

  assert.equal(profile.shouldShow, true);
  assert.equal(profile.heading, "Public institutional response");
  assert.equal(profile.response, "The university said it would revise its policies and provide training.");
});

test("responseDisplayProfile shows response notes when response date exists but response text is limited", () => {
  const profile = responseDisplayProfile({
    institutional_response: "The record currently summarizes the public federal finding and accreditor notification; it does not evaluate Harvard's response.",
    response_date: "2025-06-30"
  });

  assert.equal(profile.shouldShow, true);
  assert.equal(profile.heading, "Public response note");
  assert.match(profile.response, /Harvard's response/);
});

test("responseDisplayProfile hides limited notes without a response date", () => {
  const profile = responseDisplayProfile({
    institutional_response: "The record currently summarizes the public OCR letter action. It does not evaluate the institution's completed response."
  });

  assert.equal(profile.shouldShow, false);
});

test("responseDepthDisplayProfile labels direct, agency-described, limited, and missing response states", () => {
  assert.equal(
    responseDepthDisplayProfile({ institutional_response: "Alpha University said it would update training and continue reporting to OCR." }).label,
    "Direct institutional response"
  );
  assert.equal(
    responseDepthDisplayProfile({ institutional_response: "OCR announced that Delta College entered a voluntary resolution agreement." }).label,
    "Agency-described institutional action"
  );
  assert.equal(
    responseDepthDisplayProfile({
      institutional_response:
        "The record summarizes public dataset fields and does not independently evaluate investigative, disciplinary, or institutional response outcomes."
    }).label,
    "Limited public response note"
  );
  assert.equal(responseDepthDisplayProfile({ institutional_response: "" }).label, "No public response found");
});
