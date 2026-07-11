import test from "node:test";
import assert from "node:assert/strict";
import {
  applyComplaint, canDistribute, classifyOutcome, compileSignal, dedupeTriggers, evidenceOpenRate,
  evaluateEvidenceEligibility, holdoutAssignment, idempotencyKey, matchInstitutions, normalizeTrigger,
} from "../scripts/signals/core.mjs";

const source = { id: "src_1", title: "Official release", url: "https://example.edu/release", publisher: "Example University", source_type: "University statement" };
const event = {
  id: "evt_1", school_id: "example_university", date: "2026-01-02", date_precision: "day", category: "OCR complaint",
  summary: "Example University announced a voluntary agreement with the Office for Civil Rights.", description: "The university published the agreement.",
  source_ids: ["src_1"], source_types: ["University statement"], response_depth: "direct_institutional_response", institutional_response: "The university described training and reporting commitments.", response_date: "2026-01-02",
  classification_rationale: "The source names an OCR agreement.", community_rationale: "No broader label is inferred.", confidence_rationale: "The item-specific source supports this description.",
  field_support: [{ field: "Category", source_ids: ["src_1"] }, { field: "Confidence", source_ids: ["src_1"] }, { field: "Institutional response", source_ids: ["src_1"] }], record_hash: "sha256:abc", tags: ["ocr"],
};
const certification = { certification_status: "certified", open_gates: [] };
const audit = { highest_severity: "none", issue_count: 0 };
const school = { id: "example_university", name: "Example University", state: "NY" };

test("normalizes, deduplicates, and exactly matches triggers", () => {
  const trigger = normalizeTrigger({ title: " Example University update ", url: "https://news.test/a/#top", publishedAt: "2026-01-03", topics: ["OCR", "ocr"] });
  assert.equal(trigger.url, "https://news.test/a");
  assert.deepEqual(trigger.topics, ["ocr"]);
  assert.equal(dedupeTriggers([trigger, trigger]).length, 1);
  assert.deepEqual(matchInstitutions(trigger, [school]), [{ school_id: school.id, confidence: "exact_name" }]);
});

test("eligibility passes complete certified evidence and rejects thin or social-only evidence", () => {
  assert.equal(evaluateEvidenceEligibility({ event, certification, audit, sources: [source] }).eligible, true);
  const thin = evaluateEvidenceEligibility({ event: { ...event, classification_rationale: "", source_ids: ["social"] }, certification, audit, sources: [{ ...source, id: "social", url: "https://twitter.com/example/status/1" }] });
  assert.equal(thin.eligible, false);
  assert.ok(thin.reason_codes.includes("missing_explicit_rationale"));
  assert.ok(thin.reason_codes.includes("social_only_or_private_source"));
});

test("compiler creates fully supported bounded Signal and rejects institution mismatch", () => {
  const eligibility = evaluateEvidenceEligibility({ event, certification, audit, sources: [source] });
  const trigger = normalizeTrigger({ title: "Example University update", url: "https://news.test/a", institution_ids: [school.id], topics: ["ocr"] });
  const compiled = compileSignal({ trigger, event, school, sources: [source], eligibility, siteUrl: "https://cel.test" });
  assert.equal(compiled.accepted, true);
  assert.equal(compiled.signal.bounded_claims.every((claim) => claim.supporting_record_ids.includes(event.id)), true);
  assert.match(compiled.signal.claim_limit, /not a finding/i);
  assert.match(compiled.signal.distribution_copy.bluesky_original, /Sources, response status, limits/);
  assert.ok(compiled.signal.distribution_copy.bluesky_original.length <= 300);
  const mismatch = compileSignal({ trigger: { ...trigger, institution_ids: ["other"] }, event, school, sources: [source], eligibility });
  assert.deepEqual(mismatch.reason_codes, ["trigger_institution_mismatch"]);
});

test("distribution policy enforces shadow, caps, cooldowns, kill switch, and idempotency", () => {
  const eligibility = evaluateEvidenceEligibility({ event, certification, audit, sources: [source] });
  const compiled = compileSignal({ trigger: { title: "Update", url: "https://news.test", institution_ids: [school.id] }, event, school, sources: [source], eligibility }).signal;
  assert.ok(canDistribute({ signal: compiled, channel: "bluesky", controls: { global_pause: false, approved_shadow_count: 30 } }).reason_codes.includes("shadow_or_unapproved_signal"));
  const approved = { ...compiled, status: "approved" };
  assert.equal(canDistribute({ signal: approved, channel: "bluesky", controls: { global_pause: false, approved_shadow_count: 30 } }).allowed, true);
  assert.ok(canDistribute({ signal: approved, channel: "bluesky", controls: { global_pause: true, approved_shadow_count: 30 } }).reason_codes.includes("global_pause"));
  const history = [{ channel: "bluesky", result: "sent", institution_id: school.id, attempted_at: new Date().toISOString() }];
  assert.ok(canDistribute({ signal: approved, channel: "bluesky", controls: { global_pause: false, approved_shadow_count: 30 }, history }).reason_codes.includes("institution_cooldown"));
  assert.equal(idempotencyKey(approved.id, "bluesky"), idempotencyKey(approved.id, "bluesky"));
});

test("complaints pause distribution and metrics distinguish claimable outcomes", () => {
  const paused = applyComplaint({ id: "sig_1", status: "published" }, { category: "privacy", received_at: "2026-01-01T00:00:00Z" });
  assert.equal(paused.status, "paused");
  assert.equal(paused.correction_status, "contested");
  assert.equal(classifyOutcome({ attribution: "direct", evidence_url: "https://news.test/story" }).publicly_claimable, true);
  assert.equal(classifyOutcome({ attribution: "plausible", evidence_url: "https://news.test/story" }).publicly_claimable, false);
  assert.equal(evidenceOpenRate({ attributableVisitors: 100, visitorsOpeningSource: 7 }), 0.07);
  assert.ok(["active_distribution", "passive_holdout"].includes(holdoutAssignment("sig_1")));
});
