import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChallengeLedger,
  buildChallengePackets,
  buildChallengeQueues,
  buildChallengeStandards,
  challengeTypesForCapsule,
  hasProhibitedChallengeClaim,
  validateChallengeArtifacts
} from "../scripts/challenge-protocol-lib.mjs";

const capsules = {
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-03",
  records: [
    {
      event_id: "evt_2026_0001",
      school_id: "alpha_university",
      category: "OCR complaint",
      confidence: "Medium",
      date_precision: "day",
      import_family: { id: "ocr_government_release", label: "OCR or government release" },
      locator_quality: { code: "source_page", label: "Source page locator" },
      source_basis: {
        source_count: 1,
        source_ids: ["src_ocr"],
        source_types: ["Government release"],
        primary_source: {
          id: "src_ocr",
          title: "OCR release",
          publisher: "U.S. Department of Education Office for Civil Rights",
          source_type: "Government release",
          published_date: "2025-01-16",
          url: "https://example.edu/ocr"
        }
      },
      field_evidence: [
        { field: "category", source_ids: ["src_ocr"], support_level: "linked_public_source", support_note: "Category is supported by source metadata." }
      ],
      review_needs: ["single_source_review", "explicit_rationale_review", "response_depth_review"],
      workspace_url: "/research-workspace/?record=evt_2026_0001",
      event_url: "/events/evt_2026_0001/",
      public_claim_limit: "Review aid only; not outside validation or legal truth."
    },
    {
      event_id: "evt_2026_0002",
      school_id: "beta_college",
      category: "Vandalism",
      confidence: "Medium",
      date_precision: "year",
      import_family: { id: "ed_campus_safety_dataset", label: "Education campus-safety dataset" },
      locator_quality: { code: "dataset_file", label: "Dataset file locator" },
      source_basis: {
        source_count: 1,
        source_ids: ["src_dataset"],
        source_types: ["Government dataset"],
        primary_source: {
          id: "src_dataset",
          title: "Campus Safety and Security Data Analysis Cutting Tool 2025 Excel data files",
          publisher: "U.S. Department of Education Office of Postsecondary Education",
          source_type: "Government dataset",
          published_date: "2025-01-01",
          url: "https://example.edu/dataset.zip"
        }
      },
      field_evidence: [
        { field: "date", source_ids: ["src_dataset"], support_level: "linked_public_source", support_note: "Date is represented at year precision." }
      ],
      review_needs: ["dataset_cell_locator_review", "single_source_review", "date_precision_review", "explicit_rationale_review"],
      workspace_url: "/research-workspace/?record=evt_2026_0002",
      event_url: "/events/evt_2026_0002/",
      public_claim_limit: "Review aid only; not outside validation or legal truth."
    }
  ]
};

const events = [
  {
    id: "evt_2026_0001",
    school_id: "alpha_university",
    date: "2025-01-16",
    date_precision: "day",
    affected_communities: ["Jewish", "Muslim"],
    category: "OCR complaint",
    summary: "OCR announced a public resolution.",
    description: "OCR announced a public resolution involving shared ancestry concerns.",
    source_ids: ["src_ocr"],
    institutional_response: "The record summarizes OCR public material and does not independently evaluate institutional action.",
    legal_status: "OCR resolution agreement announced",
    confidence: "Medium"
  },
  {
    id: "evt_2026_0002",
    school_id: "beta_college",
    date: "2023-01-01",
    date_precision: "year",
    affected_communities: ["Religion"],
    category: "Vandalism",
    summary: "ED data listed a hate-crime statistics row.",
    description: "Department of Education campus safety data listed one reported incident in a workbook cell.",
    source_ids: ["src_dataset"],
    institutional_response: "The record summarizes a Department of Education dataset cell and does not independently evaluate institutional response outcomes.",
    legal_status: "Reported in Department of Education campus safety hate-crime statistics",
    confidence: "Medium"
  }
];

const schools = [
  { id: "alpha_university", name: "Alpha University", city: "Atlanta", state: "GA", country: "USA" },
  { id: "beta_college", name: "Beta College", city: "Boston", state: "MA", country: "USA" }
];

const sources = [
  { id: "src_ocr", title: "OCR release", url: "https://example.edu/ocr", publisher: "OCR", source_type: "Government release" },
  { id: "src_dataset", title: "ED data", url: "https://example.edu/dataset.zip", publisher: "ED", source_type: "Government dataset" }
];

test("buildChallengeStandards defines the first eight challenge standards", () => {
  const standards = buildChallengeStandards({ snapshot_id: "snapshot_test", generated_at: "2026-06-03" });
  assert.equal(standards.standards.length, 8);
  assert.deepEqual(
    standards.standards.map((standard) => standard.id),
    [
      "category_challenge",
      "affected_community_challenge",
      "confidence_challenge",
      "date_precision_challenge",
      "institutional_response_challenge",
      "legal_status_challenge",
      "source_sufficiency_challenge",
      "inclusion_challenge"
    ]
  );
  assert.equal(hasProhibitedChallengeClaim(JSON.stringify(standards)), false);
});

test("hasProhibitedChallengeClaim catches audit, endorsement, score, and prevalence overclaims", () => {
  assert.equal(hasProhibitedChallengeClaim("externally audited challenge protocol"), true);
  assert.equal(hasProhibitedChallengeClaim("endorsed by reviewers"), true);
  assert.equal(hasProhibitedChallengeClaim("campus safety score"), true);
  assert.equal(hasProhibitedChallengeClaim("incident severity score"), true);
  assert.equal(hasProhibitedChallengeClaim("prevalence estimate by school"), true);
  assert.equal(hasProhibitedChallengeClaim("review queue for adversarial source checks"), false);
});

test("challengeTypesForCapsule maps review needs into applicable adversarial challenge types", () => {
  assert.deepEqual(challengeTypesForCapsule(capsules.records[1]), [
    "date_precision_challenge",
    "confidence_challenge",
    "source_sufficiency_challenge"
  ]);
});

test("buildChallengeQueues produces deterministic review-order queues and packets", () => {
  const standards = buildChallengeStandards({ snapshot_id: "snapshot_test", generated_at: "2026-06-03" });
  const queues = buildChallengeQueues({ capsules, events, schools, standards, limit: 2, packetLimit: 2 });
  assert.equal(queues.snapshot_id, "snapshot_test");
  assert.equal(queues.queues.length, 7);
  assert.equal(queues.packets.length, 2);
  assert.deepEqual(
    queues.queues.find((queue) => queue.id === "dataset_locator_challenges").records.map((record) => record.event_id),
    ["evt_2026_0002"]
  );
  assert.equal(queues.packets[0].public_claim_limit.includes("not a ranking"), true);
  assert.equal(hasProhibitedChallengeClaim(JSON.stringify(queues)), false);
});

test("buildChallengePackets creates bounded packets with questions and counterevidence standards", () => {
  const standards = buildChallengeStandards({ snapshot_id: "snapshot_test", generated_at: "2026-06-03" });
  const packets = buildChallengePackets({ capsules, events, schools, standards, limit: 1 });
  assert.equal(packets.length, 1);
  assert.equal(packets[0].challenge_types.length > 0, true);
  assert.equal(packets[0].review_questions.length > 0, true);
  assert.equal(packets[0].acceptable_counterevidence.length > 0, true);
});

test("buildChallengeLedger seeds open challenge entries without claiming external submissions", () => {
  const standards = buildChallengeStandards({ snapshot_id: "snapshot_test", generated_at: "2026-06-03" });
  const queues = buildChallengeQueues({ capsules, events, schools, standards, limit: 2, packetLimit: 2 });
  const ledger = buildChallengeLedger({ challengeQueues: queues, corrections: [] });
  assert.equal(ledger.entries.length, 2);
  assert.equal(ledger.entries.every((entry) => entry.status === "open_for_review"), true);
  assert.equal(ledger.entries.every((entry) => entry.submitted_evidence_summary.includes("Seeded")), true);
  assert.equal(hasProhibitedChallengeClaim(JSON.stringify(ledger)), false);
});

test("validateChallengeArtifacts catches missing references and prohibited claims", () => {
  const standards = buildChallengeStandards({ snapshot_id: "snapshot_test", generated_at: "2026-06-03" });
  const queues = buildChallengeQueues({ capsules, events, schools, standards, limit: 2, packetLimit: 2 });
  const ledger = buildChallengeLedger({ challengeQueues: queues, corrections: [] });
  assert.deepEqual(validateChallengeArtifacts({ standards, queues, ledger, events, sources, corrections: [] }), []);

  const missingReference = structuredClone(queues);
  missingReference.packets[0].event_id = "evt_missing";
  const missingReferenceErrors = validateChallengeArtifacts({ standards, queues: missingReference, ledger, events, sources, corrections: [] });
  assert.equal(missingReferenceErrors.some((error) => /event_id|missing|reference|unknown/i.test(error)), true);

  const prohibitedClaim = structuredClone(queues);
  prohibitedClaim.packets[0].public_claim_limit = "This is the safest school ranking.";
  const prohibitedClaimErrors = validateChallengeArtifacts({ standards, queues: prohibitedClaim, ledger, events, sources, corrections: [] });
  assert.equal(prohibitedClaimErrors.some((error) => error.includes("prohibited")), true);
});
