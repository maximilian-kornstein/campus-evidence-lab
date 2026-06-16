import test from "node:test";
import assert from "node:assert/strict";
import { buildAuditProfile, auditProfileForExport } from "../assets/audit-profile.js";

const source = {
  id: "src_test_2026",
  title: "University public notice",
  url: "https://example.edu/notice",
  publisher: "Example University",
  source_type: "University statement",
  published_date: "2026-01-15",
  accessed_date: "2026-06-16"
};

const baseRecord = {
  id: "evt_2026_9999",
  school_id: "example_university",
  date: "2026-01-15",
  date_precision: "day",
  location: "Example City, NY",
  affected_communities: ["Jewish"],
  category: "Institutional response",
  summary: "Example University issued a public response to a documented civil-rights matter.",
  description: "According to Example University, the school issued a public response to a documented civil-rights matter.",
  source_ids: ["src_test_2026"],
  source_types: ["University statement"],
  institutional_response: "Example University said it would update its review process and publish additional guidance.",
  response_date: "2026-01-15",
  legal_status: "No legal finding is stated in the linked public source.",
  verification_status: "Verified from public source",
  confidence: "High",
  tags: ["example"],
  created_at: "2026-06-16",
  updated_at: "2026-06-16",
  record_hash: "sha256:test",
  changelog: [{ date: "2026-06-16", note: "Test record." }]
};

test("buildAuditProfile derives conservative review text from existing event fields", () => {
  const profile = buildAuditProfile(baseRecord, [source]);

  assert.equal(profile.sourceBasis, "1 linked public source: University statement.");
  assert.match(profile.classificationRationale, /Institutional response/);
  assert.match(profile.communityRationale, /Jewish/);
  assert.match(profile.confidenceRationale, /High/);
  assert.match(profile.confidenceRationale, /source support, not severity/);
  assert.ok(profile.limitations.includes("This record is not a school ranking, safety score, severity score, or prevalence estimate."));
  assert.ok(profile.limitations.includes("The record reflects public-source documentation available to Campus Evidence Lab, not a complete account of private reports or lived experience."));
  assert.deepEqual(
    profile.fieldSupport.map((row) => row.field),
    ["School", "Date", "Location", "Category", "Affected communities", "Description", "Institutional response", "Legal status"]
  );
  assert.deepEqual(profile.fieldSupport[0].sourceIds, ["src_test_2026"]);
});

test("buildAuditProfile uses explicit rationale fields when present", () => {
  const profile = buildAuditProfile(
    {
      ...baseRecord,
      classification_rationale: "Explicit category rationale from reviewer.",
      community_rationale: "Explicit community rationale from reviewer.",
      confidence_rationale: "Explicit confidence rationale from reviewer.",
      limitations: ["Explicit limitation."],
      field_support: [
        {
          field: "Category",
          source_ids: ["src_test_2026"],
          rationale: "Explicit field support."
        }
      ]
    },
    [source]
  );

  assert.equal(profile.classificationRationale, "Explicit category rationale from reviewer.");
  assert.equal(profile.communityRationale, "Explicit community rationale from reviewer.");
  assert.equal(profile.confidenceRationale, "Explicit confidence rationale from reviewer.");
  assert.deepEqual(profile.limitations, ["Explicit limitation."]);
  assert.deepEqual(profile.fieldSupport, [
    {
      field: "Category",
      sourceIds: ["src_test_2026"],
      sourceTitles: ["University public notice"],
      rationale: "Explicit field support."
    }
  ]);
});

test("buildAuditProfile omits optional field-support rows when optional fields are blank", () => {
  const profile = buildAuditProfile(
    {
      ...baseRecord,
      location: "",
      institutional_response: "",
      legal_status: ""
    },
    [source]
  );

  assert.deepEqual(
    profile.fieldSupport.map((row) => row.field),
    ["School", "Date", "Category", "Affected communities", "Description"]
  );
});

test("auditProfileForExport returns machine-readable audit fields without mutating the record", () => {
  const record = structuredClone(baseRecord);
  const exported = auditProfileForExport(record, [source]);

  assert.equal(record.classification_rationale, undefined);
  assert.equal(exported.source_basis, "1 linked public source: University statement.");
  assert.equal(exported.field_support.length, 8);
  assert.equal(exported.field_support[0].source_ids[0], "src_test_2026");
  assert.equal(exported.limitations.length, 3);
});
