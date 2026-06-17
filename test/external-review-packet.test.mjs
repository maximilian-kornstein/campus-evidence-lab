import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExternalReviewPacket,
  hasProhibitedExternalReviewClaim,
  validateExternalReviewPacket
} from "../scripts/external-review-packet-lib.mjs";

const sources = [
  {
    id: "src_ocr",
    title: "OCR resolution announcement",
    publisher: "U.S. Department of Education Office for Civil Rights",
    source_type: "Government release",
    published_date: "2025-01-16",
    accessed_date: "2026-06-03",
    url: "https://example.edu/ocr"
  },
  {
    id: "src_asr",
    title: "Annual Security Report",
    publisher: "Example University",
    source_type: "Annual security report",
    published_date: "2025-10-01",
    accessed_date: "2026-06-03",
    url: "https://example.edu/asr.pdf"
  },
  {
    id: "src_blocked",
    title: "Redirecting university statement",
    publisher: "Example University",
    source_type: "University statement",
    published_date: "2016-11-16",
    accessed_date: "2026-06-03",
    url: "https://example.edu/old"
  }
];

function event(id, sourceId, category = "OCR complaint") {
  return {
    id,
    school_id: `${id}_school`,
    date: "2025-01-16",
    date_precision: "day",
    category,
    affected_communities: ["Jewish"],
    summary: `${id} public source-backed record summary.`,
    description: `${id} public source-backed record description.`,
    source_ids: [sourceId],
    source_types: [sources.find((source) => source.id === sourceId).source_type],
    source_locators: [
      {
        source_id: sourceId,
        locator_type: sourceId === "src_asr" ? "page_table" : "aggregate_item",
        locator: sourceId === "src_asr" ? "Annual Security Report, Hate Crime Statistics table, p. 52" : "OCR item dated January 16, 2025 for Example University",
        page: sourceId === "src_asr" ? "52" : undefined,
        table: sourceId === "src_asr" ? "Hate Crime Statistics" : undefined,
        item_date: sourceId !== "src_asr" ? "2025-01-16" : undefined,
        item_label: sourceId !== "src_asr" ? "Example University resolution agreement" : undefined
      }
    ],
    institutional_response: "The source describes public institutional action; no independent evaluation is made.",
    response_depth: "agency_described_institutional_action",
    legal_status: "Public OCR resolution announcement.",
    verification_status: "Verified from public source",
    confidence: "High",
    classification_rationale: "The category follows the cited public source item and is not a legal conclusion by Campus Evidence Lab.",
    community_rationale: "The affected-community label follows the cited public source wording and does not add a broader inference.",
    confidence_rationale: "High confidence reflects a direct source locator and source-to-record support, not severity."
  };
}

const events = [
  event("evt_certified_1", "src_ocr"),
  event("evt_certified_2", "src_asr", "Harassment or threat"),
  event("evt_blocked", "src_blocked", "Institutional response")
];

const goldStatus = {
  id: "gold_v1_certification_status",
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-03",
  totals: { records: 3, certified: 2, not_certified: 0, blocked: 1 },
  records: [
    {
      event_id: "evt_certified_1",
      certification_status: "certified",
      audit_status: "lower_priority_for_review",
      issue_ids: [],
      gates: {
        source_locator: { status: "pass", detail: "locator present", required_action: "No action required." }
      },
      workspace_url: "/research-workspace/?record_ids=evt_certified_1",
      event_url: "/events/evt_certified_1/",
      challenge_url: "/challenge/?record=evt_certified_1"
    },
    {
      event_id: "evt_certified_2",
      certification_status: "certified",
      audit_status: "lower_priority_for_review",
      issue_ids: [],
      gates: {
        source_locator: { status: "pass", detail: "locator present", required_action: "No action required." }
      },
      workspace_url: "/research-workspace/?record_ids=evt_certified_2",
      event_url: "/events/evt_certified_2/",
      challenge_url: "/challenge/?record=evt_certified_2"
    },
    {
      event_id: "evt_blocked",
      certification_status: "blocked",
      audit_status: "blocked_before_external_packet",
      issue_ids: ["source_redirect_locator_risk"],
      gates: {
        source_locator: { status: "fail", detail: "redirect", required_action: "Repair source." }
      },
      workspace_url: "/research-workspace/?record_ids=evt_blocked",
      event_url: "/events/evt_blocked/",
      challenge_url: "/challenge/?record=evt_blocked"
    }
  ]
};

const reviewDebtLedger = {
  id: "review_debt_ledger_v1",
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-03",
  totals: {
    records: 3,
    source_families: 3,
    blocked: 1,
    high_review_debt: 0,
    medium_review_debt: 0,
    low_review_debt: 0,
    lower_priority_review_debt: 2
  },
  debt_status_counts: { lower_priority_review_debt: 2, blocked: 1 },
  issue_counts: { source_redirect_locator_risk: 1 },
  source_family_counts: { ocr_or_ed_release: 1, annual_security_report: 1, university_statement: 1 },
  records: [
    { event_id: "evt_certified_1", source_family: "ocr_or_ed_release", debt_status: "lower_priority_review_debt", issue_ids: [] },
    { event_id: "evt_certified_2", source_family: "annual_security_report", debt_status: "lower_priority_review_debt", issue_ids: [] },
    { event_id: "evt_blocked", source_family: "university_statement", debt_status: "blocked", issue_ids: ["source_redirect_locator_risk"] }
  ]
};

const challengeQueues = {
  packets: [
    {
      event_id: "evt_certified_1",
      packet_id: "challenge_evt_certified_1",
      challenge_url: "/challenge/?packet=evt_certified_1",
      challenge_types: ["source_sufficiency_challenge", "category_challenge"]
    }
  ]
};

test("buildExternalReviewPacket selects only internally certified Gold v1 records and gives source-to-record verification steps", () => {
  const packet = buildExternalReviewPacket({
    events,
    sources,
    goldStatus,
    reviewDebtLedger,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    limit: 25
  });

  assert.equal(packet.id, "external_review_packet_v1");
  assert.equal(packet.records.length, 2);
  assert.equal(packet.records.some((record) => record.event_id === "evt_blocked"), false);
  assert.equal(packet.records.every((record) => record.gold_v1_certification_status === "certified"), true);
  assert.equal(packet.records.every((record) => record.source_checklist.length >= 6), true);
  assert.equal(packet.records.every((record) => record.replication_steps.some((step) => /locator/i.test(step))), true);
  assert.equal(packet.records.every((record) => record.challenge_url), true);
  assert.equal(packet.review_batches[0].batch_size, 2);
  assert.equal(packet.challenge_templates.length >= 8, true);
  assert.equal(packet.known_limits.unresolved_records.blocked, 1);
  assert.match(packet.public_claim_limit, /must not be described as/i);
});

test("validateExternalReviewPacket rejects unknown records, uncertified rows, missing templates, and overclaims", () => {
  const packet = buildExternalReviewPacket({
    events,
    sources,
    goldStatus,
    reviewDebtLedger,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" },
    limit: 25
  });

  assert.deepEqual(
    validateExternalReviewPacket({
      packet,
      events,
      sources,
      goldStatus,
      reviewDebtLedger,
      manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-03" }
    }),
    []
  );

  const unknown = { ...packet, records: [{ ...packet.records[0], event_id: "evt_missing" }] };
  assert.equal(validateExternalReviewPacket({ packet: unknown, events, sources, goldStatus, reviewDebtLedger }).some((error) => /unknown event/i.test(error)), true);

  const uncertified = { ...packet, records: [{ ...packet.records[0], gold_v1_certification_status: "not_certified" }] };
  assert.equal(validateExternalReviewPacket({ packet: uncertified, events, sources, goldStatus, reviewDebtLedger }).some((error) => /certified/i.test(error)), true);

  const missingTemplates = { ...packet, challenge_templates: packet.challenge_templates.slice(0, 2) };
  assert.equal(validateExternalReviewPacket({ packet: missingTemplates, events, sources, goldStatus, reviewDebtLedger }).some((error) => /challenge templates/i.test(error)), true);

  const overclaim = { ...packet, method: `${packet.method} This is externally validated.` };
  assert.equal(validateExternalReviewPacket({ packet: overclaim, events, sources, goldStatus, reviewDebtLedger }).some((error) => /prohibited/i.test(error)), true);
});

test("hasProhibitedExternalReviewClaim catches review overclaiming language while allowing negated limits", () => {
  assert.equal(hasProhibitedExternalReviewClaim("externally validated public evidence dossier"), true);
  assert.equal(hasProhibitedExternalReviewClaim("This is not external validation or endorsement."), false);
});
