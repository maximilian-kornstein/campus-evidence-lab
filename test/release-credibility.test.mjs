import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_CREDIBILITY_STATUSES,
  REQUIRED_REPLICATION_COMMANDS,
  hasProhibitedCredibilityClaim,
  validateCredibilityStatus,
  validateReleaseVerification,
  validateReleases
} from "../scripts/release-credibility-lib.mjs";

test("release metadata requires snapshot, commands, and known limits", () => {
  const errors = validateReleases({
    version: "0.1.0",
    updated_at: "2026-06-16",
    releases: [
      {
        id: "release_2026_06_public_evidence_infrastructure",
        name: "2026-06 Public Evidence Infrastructure Release",
        date: "2026-06-16",
        snapshot_id: "snapshot_2026_06_03_4000_records",
        snapshot_hash: "sha256:abc",
        event_count: 4000,
        school_count: 947,
        source_count: 25,
        release_notes_url: "/RELEASE_NOTES.md",
        replication_url: "/replicate/",
        verification_commands: ["npm ci", "npm run check", "npm run build"],
        known_limits: ["This release documents public-source records and does not measure underlying frequency."]
      }
    ]
  });

  assert.deepEqual(errors, []);
});

test("release verification rejects external-validation claims", () => {
  const errors = validateReleaseVerification({
    version: "0.1.0",
    generated_at: "2026-06-16",
    snapshot_id: "snapshot_2026_06_03_4000_records",
    snapshot_hash: "sha256:abc",
    status: "passed",
    commands: [
      { command: "npm run check", status: "passed" },
      { command: "npm run build", status: "passed" }
    ],
    tool_versions: {
      node: "v22.0.0",
      npm: "10.0.0"
    },
    notes: "This release was endorsed by external reviewers."
  });

  assert.ok(errors.some((error) => error.includes("external validation")));
});

test("credibility statuses are explicit and bounded", () => {
  assert.ok(ALLOWED_CREDIBILITY_STATUSES.has("review_requested"));
  assert.ok(ALLOWED_CREDIBILITY_STATUSES.has("public_acknowledgment_approved"));

  const errors = validateCredibilityStatus({
    version: "0.1.0",
    updated_at: "2026-06-16",
    entries: [
      {
        id: "credibility_2026_0001",
        status: "review_completed",
        display_name: "Example Reviewer",
        scope: "Reviewed a 25-record source sample.",
        permission_to_display: true,
        endorsement_language_approved: false,
        public_note: "Review completed; this does not imply endorsement."
      }
    ]
  });

  assert.deepEqual(errors, []);
});

test("prohibited credibility claim detector catches endorsement and ranking language", () => {
  assert.equal(hasProhibitedCredibilityClaim("This project is endorsed by Example Organization."), true);
  assert.equal(hasProhibitedCredibilityClaim("These data identify the safest schools."), true);
  assert.equal(hasProhibitedCredibilityClaim("This release documents public-source records and known limits."), false);
});

test("required replication commands are stable", () => {
  assert.deepEqual(REQUIRED_REPLICATION_COMMANDS, ["npm ci", "npm run check", "npm run build"]);
});
