import test from "node:test";
import assert from "node:assert/strict";
import {
  REVIEW_TIERS,
  reviewTierForCertificationStatus,
  reviewTierLimit,
  reviewTierRank,
  hasProhibitedReviewTierClaim,
  validateReviewTierRecord
} from "../scripts/review-tier-model-lib.mjs";

test("review tiers are ordered from raw import to outside review", () => {
  assert.deepEqual(REVIEW_TIERS, [
    "imported_public_source",
    "source_family_checked",
    "internally_certified",
    "externally_reviewed"
  ]);
  assert.equal(reviewTierRank("imported_public_source") < reviewTierRank("source_family_checked"), true);
  assert.equal(reviewTierRank("source_family_checked") < reviewTierRank("internally_certified"), true);
  assert.equal(reviewTierRank("internally_certified") < reviewTierRank("externally_reviewed"), true);
});

test("certification statuses map to conservative public review tiers", () => {
  assert.equal(reviewTierForCertificationStatus("certified"), "internally_certified");
  assert.equal(reviewTierForCertificationStatus("not_certified"), "imported_public_source");
  assert.equal(reviewTierForCertificationStatus("blocked"), "imported_public_source");
  assert.equal(reviewTierForCertificationStatus("awaiting_review"), "imported_public_source");
});

test("every tier has a visible public limitation", () => {
  for (const tier of REVIEW_TIERS) {
    const limit = reviewTierLimit(tier);
    assert.equal(limit.length > 60, true);
    assert.equal(hasProhibitedReviewTierClaim(limit), false);
  }
});

test("prohibited review-tier claim detector catches bulk-launch overclaims", () => {
  assert.equal(hasProhibitedReviewTierClaim("All records are human reviewed before publication."), true);
  assert.equal(hasProhibitedReviewTierClaim("Every record is externally validated."), true);
  assert.equal(hasProhibitedReviewTierClaim("This database proves the university violated federal law."), true);
  assert.equal(
    hasProhibitedReviewTierClaim("The record must not be used as a comparative campus judgment, risk rating, severity rating, or frequency measure."),
    false
  );
  assert.equal(hasProhibitedReviewTierClaim("Imported public-source records are published with explicit limits."), false);
});

test("validateReviewTierRecord requires tier fields and blocks lower-tier certification language", () => {
  const baseRecord = {
    id: "evt_2026_0001",
    review_tier: "imported_public_source",
    summary: "Public records describe a campus event.",
    description: "According to a public source, a campus event was reported.",
    verification_status: "Verified from public source",
    confidence: "Medium",
    legal_status: "Public-source record; no legal finding by Campus Evidence Lab.",
    limitations: ["Imported public-source record. Source-family and human review may be incomplete."]
  };

  assert.deepEqual(validateReviewTierRecord(baseRecord), []);
  assert.deepEqual(validateReviewTierRecord({ ...baseRecord, review_tier: "unsupported" }), [
    "Event evt_2026_0001 has invalid review_tier unsupported"
  ]);
  assert.equal(
    validateReviewTierRecord({
      ...baseRecord,
      description: "This internally certified record was manually reviewed by Campus Evidence Lab."
    }).some((error) => error.includes("overclaims")),
    true
  );
});
