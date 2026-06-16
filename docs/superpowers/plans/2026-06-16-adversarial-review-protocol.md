# Adversarial Review Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, public adversarial review protocol that lets outsiders inspect challenge standards, deterministic challenge queues, bounded challenge packets, and a public challenge ledger without implying rankings, safety scores, severity scores, prevalence estimates, endorsement, or external audit.

**Architecture:** Add one focused challenge library that consumes existing event, source, school, evidence-capsule, robustness, and review-queue artifacts. Generate three new public data artifacts plus a `/challenge/` page, then wire them into validation, hashing, release notes, downloads, sitemap, build output, and QA.

**Tech Stack:** Node.js ES modules, `node:test`, static JSON artifacts, JSON Schema files, existing `assets/app.js` renderer, existing static HTML pages, existing `npm run check` and `npm run build` pipeline.

---

## File Map

- Create: `scripts/challenge-protocol-lib.mjs`
  - Pure functions for challenge standards, reason codes, challenge queues, challenge packets, seed ledger, validation helpers, and prohibited-language checks.
- Create: `scripts/generate-challenge-protocol.mjs`
  - Reads existing artifacts and writes challenge protocol data files.
- Create: `test/challenge-protocol.test.mjs`
  - TDD coverage for standards, queue determinism, packet generation, ledger validation, and prohibited claims.
- Create: `schema/challenge-standards.schema.json`
  - Schema for public challenge standard definitions.
- Create: `schema/challenge-queues.schema.json`
  - Schema for challenge queue and challenge packet artifact.
- Create: `schema/challenge-ledger.schema.json`
  - Schema for static public challenge ledger.
- Create generated: `data/challenge-standards.json`
- Create generated: `data/challenge-queues.json`
- Create generated: `data/challenge-ledger.json`
- Create: `challenge/index.html`
  - Static route rendered by `assets/app.js`.
- Modify: `scripts/lib.mjs`
  - Add path constants for the new artifacts.
- Modify: `package.json`
  - Add test/generation scripts and wire them into `prepare:data` and `check`.
- Modify: `scripts/validate-data.mjs`
  - Load and validate new challenge artifacts against existing events/sources/corrections and challenge standards.
- Modify: `scripts/hash-dataset.mjs`
  - Include challenge artifacts in manifest totals, hashes, and full snapshot hash.
- Modify: `scripts/generate-release-notes.mjs`
  - Include challenge artifact counts, hashes, and links.
- Modify: `scripts/generate-pages.mjs`
  - Add record-level challenge links for records that have generated packets.
- Modify: `assets/app.js`
  - Load challenge artifacts and render the `/challenge/` page plus downloads rows.
- Modify: `scripts/build-static.mjs`
  - Copy `challenge/` into `dist/`.
- Modify: `scripts/generate-sitemap.mjs`
  - Add `/challenge/`.
- Modify: `scripts/qa-site.mjs`
  - Assert route, artifacts, schemas, downloads, and page copy exist.
- Modify: `docs/data-dictionary.md`
  - Document `challenge-standards.json`, `challenge-queues.json`, and `challenge-ledger.json`.
- Modify: `downloads/index.html`
  - Add static fallback links to challenge artifacts and page.
- Modify: `trust/index.html`, `reviewer-brief/index.html`, `journalist-guide/index.html`, `research-guide/index.html`
  - Add restrained links to the challenge protocol where relevant.

---

### Task 1: Write Failing Challenge Protocol Unit Tests

**Files:**
- Create: `test/challenge-protocol.test.mjs`

- [ ] **Step 1: Add the test file**

```js
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

  const broken = structuredClone(queues);
  broken.packets[0].public_claim_limit = "This is the safest school ranking.";
  const errors = validateChallengeArtifacts({ standards, queues: broken, ledger, events, sources, corrections: [] });
  assert.equal(errors.some((error) => error.includes("prohibited")), true);
});
```

- [ ] **Step 2: Run the failing test**

Run:

```sh
npm pkg set scripts.test:challenge-protocol="node --test test/challenge-protocol.test.mjs"
npm run test:challenge-protocol
```

Expected: FAIL with `Cannot find module '../scripts/challenge-protocol-lib.mjs'`.

- [ ] **Step 3: Revert the temporary package script if the test cannot run because the implementation does not exist**

If `npm pkg set` modified `package.json`, keep the new script for Task 4. Do not commit yet.

---

### Task 2: Implement Challenge Protocol Library

**Files:**
- Create: `scripts/challenge-protocol-lib.mjs`
- Test: `test/challenge-protocol.test.mjs`

- [ ] **Step 1: Add the challenge protocol library**

```js
const PROHIBITED_CHALLENGE_PATTERN =
  /externally audited|external audit|externally validated|outside validated|validated by|approved by|endorsed by|safest|most dangerous|best school|worst school|school ranking|safety score|severity score|prevalence estimate|frequency measure/i;

const STANDARD_DEFINITIONS = [
  {
    id: "category_challenge",
    label: "Category challenge",
    applies_when: "The assigned event category may be broader or different from what the linked public source supports.",
    acceptable_counterevidence: [
      "A public source showing the event belongs in a narrower or different Campus Evidence Lab category.",
      "A public source showing the current category relies on language not present in the source basis."
    ],
    insufficient_counterevidence: [
      "A disagreement with the category without a public source.",
      "A preference for different terminology that does not change the source-supported meaning."
    ],
    possible_outcomes: ["category_changed", "category_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["category", "classification_rationale", "limitations"],
    no_overclaiming_warning: "A category challenge is about source fit, not incident severity or institutional quality."
  },
  {
    id: "affected_community_challenge",
    label: "Affected-community challenge",
    applies_when: "Affected-community labels may be broader than the public source supports.",
    acceptable_counterevidence: [
      "A public source identifying a narrower affected community.",
      "A public source showing that a listed community is not supported by the record basis."
    ],
    insufficient_counterevidence: [
      "A claim that the event affected a different group without public support.",
      "A general objection to group labels without evidence tied to the record."
    ],
    possible_outcomes: ["community_label_changed", "community_label_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["affected_communities", "community_rationale", "limitations"],
    no_overclaiming_warning: "Affected-community labels describe source-backed record metadata, not prevalence or campus climate."
  },
  {
    id: "confidence_challenge",
    label: "Confidence challenge",
    applies_when: "The confidence label may not match the current source basis or rationale.",
    acceptable_counterevidence: [
      "A public source adding independent support for the same record.",
      "A public source or source limitation showing current confidence should be lower."
    ],
    insufficient_counterevidence: [
      "A severity argument.",
      "An assertion that a record is important without source-basis evidence."
    ],
    possible_outcomes: ["confidence_raised", "confidence_lowered", "confidence_rationale_updated", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["confidence", "confidence_rationale", "field_support", "limitations"],
    no_overclaiming_warning: "Confidence describes source support, not truth, severity, or legal findings."
  },
  {
    id: "date_precision_challenge",
    label: "Date-precision challenge",
    applies_when: "The date precision may be more exact or less exact than the public source supports.",
    acceptable_counterevidence: [
      "A public source identifying the exact day, month, or only year supported by the record.",
      "A public source showing the current date refers to publication, resolution, or reporting period rather than event timing."
    ],
    insufficient_counterevidence: [
      "A date guess from secondary discussion.",
      "A date from a non-public source that cannot be reviewed."
    ],
    possible_outcomes: ["date_changed", "date_precision_narrowed", "date_precision_broadened", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["date", "date_precision", "description", "limitations"],
    no_overclaiming_warning: "Date precision is a source-support field, not a claim that the underlying event occurred on a more exact date than sources allow."
  },
  {
    id: "institutional_response_challenge",
    label: "Institutional-response challenge",
    applies_when: "The institutional response text or response-depth label may be incomplete, generic, or overstated.",
    acceptable_counterevidence: [
      "A direct public institutional statement or archived page.",
      "A public agency document describing institutional action.",
      "A public source showing no public institutional response was found after reasonable search."
    ],
    insufficient_counterevidence: [
      "Private correspondence.",
      "A general belief that the institution must have responded."
    ],
    possible_outcomes: ["response_text_updated", "response_depth_changed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["institutional_response", "response_depth", "response_date", "limitations"],
    no_overclaiming_warning: "Response depth describes public documentation, not whether an institution acted appropriately."
  },
  {
    id: "legal_status_challenge",
    label: "Legal-status challenge",
    applies_when: "Legal, OCR, procedural, or administrative status may be outdated, imprecise, or too broad.",
    acceptable_counterevidence: [
      "A public docket, OCR page, agency release, court filing, or institutional document updating status.",
      "A public source showing that the current status text should be narrower."
    ],
    insufficient_counterevidence: [
      "A legal conclusion without a public source.",
      "A news summary that does not update the procedural status."
    ],
    possible_outcomes: ["legal_status_updated", "legal_status_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["legal_status", "description", "limitations"],
    no_overclaiming_warning: "Legal-status text is procedural metadata, not a legal finding by Campus Evidence Lab."
  },
  {
    id: "source_sufficiency_challenge",
    label: "Source-sufficiency challenge",
    applies_when: "The record may need another source, a better locator, or narrower language.",
    acceptable_counterevidence: [
      "A better public URL, archived copy, source page, data file locator, or source excerpt pointer.",
      "A public source showing current language should be narrowed."
    ],
    insufficient_counterevidence: [
      "A broken-link report without an alternate public locator.",
      "A source that does not refer to the same record."
    ],
    possible_outcomes: ["source_added", "source_locator_updated", "language_narrowed", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["source_ids", "description", "field_support", "limitations"],
    no_overclaiming_warning: "Source sufficiency is about reviewability of the record, not whether the underlying event is more or less serious."
  },
  {
    id: "inclusion_challenge",
    label: "Inclusion challenge",
    applies_when: "The record may not satisfy the public-source inclusion rule or may be outside current scope.",
    acceptable_counterevidence: [
      "A public source showing the record is outside the current civil-rights or public-source scope.",
      "A public correction showing the source basis does not support inclusion."
    ],
    insufficient_counterevidence: [
      "A request to remove an uncomfortable record without source-basis evidence.",
      "A disagreement with public reporting alone."
    ],
    possible_outcomes: ["record_removed", "record_archived", "record_limited", "closed_no_change", "needs_more_evidence"],
    fields_that_may_change: ["verification_status", "limitations", "changelog"],
    no_overclaiming_warning: "Inclusion means the record fits current source and scope rules; it is not a finding of legal truth."
  }
];

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function eventMap(events) {
  return new Map((events ?? []).map((event) => [event.id, event]));
}

function schoolMap(schools) {
  return new Map((schools ?? []).map((school) => [school.id, school]));
}

function standardsMap(standards) {
  return new Map((standards.standards ?? []).map((standard) => [standard.id, standard]));
}

function reasonCodesForCapsule(capsule) {
  const codes = [];
  if ((capsule.source_basis?.source_count ?? 0) <= 1) codes.push("single_source");
  if (capsule.review_needs?.includes("dataset_cell_locator_review")) codes.push("dataset_cell_locator");
  if (capsule.review_needs?.includes("date_precision_review") || capsule.date_precision === "year") codes.push("date_precision");
  if (capsule.review_needs?.includes("response_depth_review")) codes.push("response_depth");
  if (capsule.review_needs?.includes("explicit_rationale_review")) codes.push("explicit_rationale");
  if (capsule.locator_quality?.code === "metadata_only") codes.push("source_locator");
  if (/ocr|lawsuit|legal|criminal|investigation|title ix|title vi/i.test(`${capsule.category} ${capsule.source_basis?.source_types?.join(" ")}`)) {
    codes.push("legal_or_procedural_language");
  }
  return unique(codes);
}

export function hasProhibitedChallengeClaim(value) {
  return PROHIBITED_CHALLENGE_PATTERN.test(String(value ?? ""));
}

export function buildChallengeStandards({ snapshot_id = "unversioned", generated_at = "2026-06-03" } = {}) {
  return {
    snapshot_id,
    generated_at,
    method:
      "Challenge standards define what public counterevidence can change a Campus Evidence Lab record. They are correction standards, not external audit, endorsement, ranking, severity scoring, safety scoring, or prevalence measurement.",
    standards: STANDARD_DEFINITIONS
  };
}

export function challengeTypesForCapsule(capsule) {
  const types = [];
  const needs = new Set(capsule.review_needs ?? []);
  if (needs.has("date_precision_review") || capsule.date_precision === "year") types.push("date_precision_challenge");
  if (needs.has("response_depth_review")) types.push("institutional_response_challenge");
  if (needs.has("explicit_rationale_review")) types.push("confidence_challenge");
  if (needs.has("dataset_cell_locator_review") || needs.has("source_url_review") || (capsule.source_basis?.source_count ?? 0) <= 1) {
    types.push("source_sufficiency_challenge");
  }
  if (/ocr|lawsuit|legal|criminal|investigation|title ix|title vi/i.test(`${capsule.category} ${capsule.source_basis?.source_types?.join(" ")}`)) {
    types.push("legal_status_challenge");
  }
  if (/other source-backed|public statement|institutional response/i.test(capsule.category ?? "")) {
    types.push("category_challenge");
  }
  return unique(types).filter((type) => STANDARD_DEFINITIONS.some((standard) => standard.id === type));
}

function challengePriority(capsule) {
  const reasonCodes = reasonCodesForCapsule(capsule);
  return reasonCodes.length * 10 + ((capsule.source_basis?.source_count ?? 0) <= 1 ? 5 : 0) + (capsule.date_precision === "year" ? 2 : 0);
}

function queueRecord(capsule, eventsById, schoolsById) {
  const event = eventsById.get(capsule.event_id);
  const school = schoolsById.get(capsule.school_id);
  return {
    event_id: capsule.event_id,
    school_id: capsule.school_id,
    school_name: school?.name ?? capsule.school_id,
    category: capsule.category,
    affected_communities: event?.affected_communities ?? [],
    confidence: capsule.confidence,
    date_precision: capsule.date_precision,
    challenge_types: challengeTypesForCapsule(capsule),
    reason_codes: reasonCodesForCapsule(capsule),
    source_count: capsule.source_basis?.source_count ?? 0,
    import_family: capsule.import_family?.id,
    locator_quality: capsule.locator_quality?.code,
    packet_url: `/challenge/?packet=${encodeURIComponent(capsule.event_id)}`,
    event_url: capsule.event_url,
    workspace_url: capsule.workspace_url
  };
}

function stableQueue(records, predicate, limit, eventsById, schoolsById) {
  return records
    .filter(predicate)
    .sort((a, b) => challengePriority(b) - challengePriority(a) || a.school_id.localeCompare(b.school_id) || a.event_id.localeCompare(b.event_id))
    .slice(0, limit)
    .map((capsule) => queueRecord(capsule, eventsById, schoolsById));
}

function packetForCapsule(capsule, eventsById, schoolsById, standardsById) {
  const event = eventsById.get(capsule.event_id);
  const school = schoolsById.get(capsule.school_id);
  const challengeTypes = challengeTypesForCapsule(capsule);
  const standards = challengeTypes.map((type) => standardsById.get(type)).filter(Boolean);
  return {
    id: `challenge_${capsule.event_id}`,
    event_id: capsule.event_id,
    school_id: capsule.school_id,
    school_name: school?.name ?? capsule.school_id,
    category: capsule.category,
    affected_communities: event?.affected_communities ?? [],
    confidence: capsule.confidence,
    date_precision: capsule.date_precision,
    source_ids: capsule.source_basis?.source_ids ?? [],
    source_types: capsule.source_basis?.source_types ?? [],
    challenge_types: challengeTypes,
    reason_codes: reasonCodesForCapsule(capsule),
    review_questions: standards.map((standard) => `${standard.label}: does the linked public source basis satisfy this standard for ${capsule.event_id}?`),
    acceptable_counterevidence: unique(standards.flatMap((standard) => standard.acceptable_counterevidence)),
    possible_outcomes: unique(standards.flatMap((standard) => standard.possible_outcomes)),
    evidence_capsule_url: `/data/evidence-capsules.json#${encodeURIComponent(capsule.event_id)}`,
    event_url: capsule.event_url,
    workspace_url: capsule.workspace_url,
    submission_packet_url: `/submit/?type=correction&record=${encodeURIComponent(capsule.event_id)}`,
    public_claim_limit:
      "This challenge packet identifies review questions for source-supported correction work. It is not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit."
  };
}

export function buildChallengePackets({ capsules, events = [], schools = [], standards, limit = 75 }) {
  const eventsById = eventMap(events);
  const schoolsById = schoolMap(schools);
  const standardsById = standardsMap(standards);
  return (capsules.records ?? [])
    .filter((capsule) => challengeTypesForCapsule(capsule).length > 0)
    .sort((a, b) => challengePriority(b) - challengePriority(a) || a.school_id.localeCompare(b.school_id) || a.event_id.localeCompare(b.event_id))
    .slice(0, limit)
    .map((capsule) => packetForCapsule(capsule, eventsById, schoolsById, standardsById));
}

export function buildChallengeQueues({ capsules, events = [], schools = [], standards, limit = 25, packetLimit = 75 }) {
  const records = capsules.records ?? [];
  const eventsById = eventMap(events);
  const schoolsById = schoolMap(schools);
  const queues = [
    {
      id: "single_source_high_priority",
      label: "Single-source high-priority review",
      description: "Single-source records where additional public support or narrower language would improve reviewability.",
      records: stableQueue(records, (capsule) => (capsule.source_basis?.source_count ?? 0) <= 1, limit, eventsById, schoolsById)
    },
    {
      id: "broad_label_challenges",
      label: "Broad-label challenges",
      description: "Records with broad category or affected-community labels that deserve label-boundary review.",
      records: stableQueue(records, (capsule) => /other source-backed|religion|race|national origin|ethnicity/i.test(JSON.stringify(capsule)), limit, eventsById, schoolsById)
    },
    {
      id: "response_depth_challenges",
      label: "Institutional-response challenges",
      description: "Records where public response text or response-depth classification should be checked against public sources.",
      records: stableQueue(records, (capsule) => capsule.review_needs?.includes("response_depth_review"), limit, eventsById, schoolsById)
    },
    {
      id: "confidence_rationale_challenges",
      label: "Confidence-rationale challenges",
      description: "Records where confidence labels need explicit source-support rationale.",
      records: stableQueue(records, (capsule) => capsule.review_needs?.includes("explicit_rationale_review"), limit, eventsById, schoolsById)
    },
    {
      id: "dataset_locator_challenges",
      label: "Dataset locator challenges",
      description: "Dataset-derived records where workbook, row, or cell-level provenance should be made clearer.",
      records: stableQueue(records, (capsule) => capsule.review_needs?.includes("dataset_cell_locator_review"), limit, eventsById, schoolsById)
    },
    {
      id: "legal_status_challenges",
      label: "Legal-status challenges",
      description: "Records with legal, OCR, procedural, or investigative language that should be checked for precision.",
      records: stableQueue(records, (capsule) => challengeTypesForCapsule(capsule).includes("legal_status_challenge"), limit, eventsById, schoolsById)
    },
    {
      id: "gold_record_candidates",
      label: "Gold record candidates",
      description: "Records worth upgrading into fully argued examples with alternate interpretations and change criteria.",
      records: stableQueue(records, (capsule) => challengeTypesForCapsule(capsule).length >= 3, limit, eventsById, schoolsById)
    }
  ];

  return {
    snapshot_id: capsules.snapshot_id,
    generated_at: capsules.generated_at,
    method:
      "Challenge queues are deterministic review-workflow queues generated from evidence capsules. Queue order is for review operations only and is not a ranking, severity score, safety score, prevalence estimate, legal finding, endorsement, or external audit.",
    queue_count: queues.length,
    packet_count: Math.min(packetLimit, records.length),
    queues,
    packets: buildChallengePackets({ capsules, events, schools, standards, limit: packetLimit })
  };
}

export function buildChallengeLedger({ challengeQueues, corrections = [] }) {
  const correctionIds = new Set((corrections ?? []).map((correction) => correction.id));
  const entries = (challengeQueues.packets ?? []).slice(0, 25).map((packet) => ({
    id: `ledger_${packet.id}`,
    challenge_id: packet.id,
    event_id: packet.event_id,
    challenge_type: packet.challenge_types[0],
    status: "open_for_review",
    submitted_evidence_summary: "Seeded from deterministic challenge packet generation; no external submission is represented.",
    decision_summary: "Open for public-source review under the published challenge standards.",
    resulting_correction_ids: [],
    resulting_event_ids: [packet.event_id],
    updated_at: challengeQueues.generated_at,
    public_limitations:
      "Ledger seed entries identify open review questions. They do not represent external submissions, findings, endorsement, or validation."
  }));

  return {
    snapshot_id: challengeQueues.snapshot_id,
    updated_at: challengeQueues.generated_at,
    method:
      "The challenge ledger records adversarial review packet status and outcomes. Initial entries are seeded open packets, not external submissions or external audit.",
    statuses: ["draft_packet", "open_for_review", "under_review", "accepted", "partially_accepted", "rejected", "needs_more_evidence", "closed_no_change"],
    entries: entries.map((entry) => ({
      ...entry,
      resulting_correction_ids: entry.resulting_correction_ids.filter((id) => correctionIds.has(id))
    }))
  };
}

export function validateChallengeArtifacts({ standards, queues, ledger, events = [], sources = [], corrections = [] }) {
  const errors = [];
  const eventIds = new Set(events.map((event) => event.id));
  const sourceIds = new Set(sources.map((source) => source.id));
  const correctionIds = new Set(corrections.map((correction) => correction.id));
  const standardIds = new Set((standards.standards ?? []).map((standard) => standard.id));
  const statusIds = new Set(ledger.statuses ?? []);

  for (const artifact of [standards, queues, ledger]) {
    if (hasProhibitedChallengeClaim(JSON.stringify(artifact))) {
      errors.push("Challenge artifact contains prohibited credibility, ranking, safety, severity, or prevalence language.");
    }
  }

  for (const standard of standards.standards ?? []) {
    if (!standard.id || !standardIds.has(standard.id)) errors.push(`Challenge standard ${standard.id} is not registered.`);
    for (const field of ["label", "applies_when", "no_overclaiming_warning"]) {
      if (!standard[field]) errors.push(`Challenge standard ${standard.id} missing ${field}`);
    }
    for (const field of ["acceptable_counterevidence", "insufficient_counterevidence", "possible_outcomes", "fields_that_may_change"]) {
      if (!Array.isArray(standard[field]) || standard[field].length === 0) errors.push(`Challenge standard ${standard.id} missing ${field}`);
    }
  }

  for (const queue of queues.queues ?? []) {
    if (/worst|best|most dangerous|safest|ranking|score/i.test(`${queue.id} ${queue.label}`)) {
      errors.push(`Challenge queue ${queue.id} uses score-like or ranking language.`);
    }
    for (const record of queue.records ?? []) {
      if (!eventIds.has(record.event_id)) errors.push(`Challenge queue ${queue.id} references unknown event ${record.event_id}`);
      for (const type of record.challenge_types ?? []) {
        if (!standardIds.has(type)) errors.push(`Challenge queue ${queue.id} uses unknown challenge type ${type}`);
      }
    }
  }

  for (const packet of queues.packets ?? []) {
    if (!eventIds.has(packet.event_id)) errors.push(`Challenge packet ${packet.id} references unknown event ${packet.event_id}`);
    for (const sourceId of packet.source_ids ?? []) {
      if (!sourceIds.has(sourceId)) errors.push(`Challenge packet ${packet.id} references unknown source ${sourceId}`);
    }
    for (const type of packet.challenge_types ?? []) {
      if (!standardIds.has(type)) errors.push(`Challenge packet ${packet.id} uses unknown challenge type ${type}`);
    }
    if (!packet.public_claim_limit) errors.push(`Challenge packet ${packet.id} missing public_claim_limit`);
  }

  for (const entry of ledger.entries ?? []) {
    if (!eventIds.has(entry.event_id)) errors.push(`Challenge ledger entry ${entry.id} references unknown event ${entry.event_id}`);
    if (!standardIds.has(entry.challenge_type)) errors.push(`Challenge ledger entry ${entry.id} uses unknown challenge type ${entry.challenge_type}`);
    if (!statusIds.has(entry.status)) errors.push(`Challenge ledger entry ${entry.id} uses unsupported status ${entry.status}`);
    if ((entry.status === "accepted" || entry.status === "rejected" || entry.status === "partially_accepted" || entry.status === "closed_no_change") && !entry.decision_summary) {
      errors.push(`Challenge ledger entry ${entry.id} needs a decision summary`);
    }
    for (const correctionId of entry.resulting_correction_ids ?? []) {
      if (!correctionIds.has(correctionId)) errors.push(`Challenge ledger entry ${entry.id} references unknown correction ${correctionId}`);
    }
  }

  return errors;
}
```

- [ ] **Step 2: Run the focused test**

Run:

```sh
npm run test:challenge-protocol
```

Expected: PASS.

- [ ] **Step 3: Commit**

```sh
git add scripts/challenge-protocol-lib.mjs test/challenge-protocol.test.mjs package.json package-lock.json
git commit -m "test: define challenge protocol behavior"
```

---

### Task 3: Add Generator, Data Paths, Schemas, And Generated Artifacts

**Files:**
- Create: `scripts/generate-challenge-protocol.mjs`
- Modify: `scripts/lib.mjs`
- Create: `schema/challenge-standards.schema.json`
- Create: `schema/challenge-queues.schema.json`
- Create: `schema/challenge-ledger.schema.json`
- Generate: `data/challenge-standards.json`
- Generate: `data/challenge-queues.json`
- Generate: `data/challenge-ledger.json`
- Modify: `package.json`

- [ ] **Step 1: Add paths**

In `scripts/lib.mjs`, add these entries after `sourceProvenanceQueues`:

```js
  challengeStandards: path.join(rootDir, "data", "challenge-standards.json"),
  challengeQueues: path.join(rootDir, "data", "challenge-queues.json"),
  challengeLedger: path.join(rootDir, "data", "challenge-ledger.json"),
```

- [ ] **Step 2: Add the generator**

```js
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildChallengeLedger, buildChallengeQueues, buildChallengeStandards } from "./challenge-protocol-lib.mjs";

const [events, schools, sources, corrections, evidenceCapsules, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.corrections),
  readJson(paths.evidenceCapsules),
  readJson(paths.manifest)
]);

const generatedAt = manifest.created_at ?? evidenceCapsules.generated_at ?? "2026-06-03";
const snapshotId = manifest.snapshot_id ?? evidenceCapsules.snapshot_id ?? "unversioned";

const challengeStandards = buildChallengeStandards({ snapshot_id: snapshotId, generated_at: generatedAt });
const challengeQueues = buildChallengeQueues({
  capsules: evidenceCapsules,
  events,
  schools,
  standards: challengeStandards,
  limit: 25,
  packetLimit: 75
});
const challengeLedger = buildChallengeLedger({ challengeQueues, corrections });

await Promise.all([
  writeJson(paths.challengeStandards, challengeStandards),
  writeJson(paths.challengeQueues, challengeQueues),
  writeJson(paths.challengeLedger, challengeLedger)
]);

console.log(
  `Generated ${challengeStandards.standards.length} challenge standards, ${challengeQueues.queues.length} challenge queues, ${challengeQueues.packets.length} challenge packets, and ${challengeLedger.entries.length} ledger entries.`
);
```

- [ ] **Step 3: Add schemas**

Create `schema/challenge-standards.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Campus Evidence Lab Challenge Standards",
  "type": "object",
  "required": ["snapshot_id", "generated_at", "method", "standards"],
  "properties": {
    "snapshot_id": { "type": "string" },
    "generated_at": { "type": "string" },
    "method": { "type": "string" },
    "standards": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "id",
          "label",
          "applies_when",
          "acceptable_counterevidence",
          "insufficient_counterevidence",
          "possible_outcomes",
          "fields_that_may_change",
          "no_overclaiming_warning"
        ],
        "properties": {
          "id": { "type": "string" },
          "label": { "type": "string" },
          "applies_when": { "type": "string" },
          "acceptable_counterevidence": { "type": "array", "items": { "type": "string" } },
          "insufficient_counterevidence": { "type": "array", "items": { "type": "string" } },
          "possible_outcomes": { "type": "array", "items": { "type": "string" } },
          "fields_that_may_change": { "type": "array", "items": { "type": "string" } },
          "no_overclaiming_warning": { "type": "string" }
        }
      }
    }
  }
}
```

Create `schema/challenge-queues.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Campus Evidence Lab Challenge Queues",
  "type": "object",
  "required": ["snapshot_id", "generated_at", "method", "queue_count", "packet_count", "queues", "packets"],
  "properties": {
    "snapshot_id": { "type": "string" },
    "generated_at": { "type": "string" },
    "method": { "type": "string" },
    "queue_count": { "type": "number" },
    "packet_count": { "type": "number" },
    "queues": { "type": "array" },
    "packets": { "type": "array" }
  }
}
```

Create `schema/challenge-ledger.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Campus Evidence Lab Challenge Ledger",
  "type": "object",
  "required": ["snapshot_id", "updated_at", "method", "statuses", "entries"],
  "properties": {
    "snapshot_id": { "type": "string" },
    "updated_at": { "type": "string" },
    "method": { "type": "string" },
    "statuses": { "type": "array", "items": { "type": "string" } },
    "entries": { "type": "array" }
  }
}
```

- [ ] **Step 4: Wire package scripts**

Modify `package.json` scripts:

```json
"test:challenge-protocol": "node --test test/challenge-protocol.test.mjs",
"challenge:protocol": "node scripts/generate-challenge-protocol.mjs"
```

Add `npm run test:challenge-protocol` after `npm run test:evidence-capsules` in `check`.

Add `npm run challenge:protocol` after `npm run evidence:capsules` in `prepare:data`.

Add `npm run challenge:protocol` after both `npm run evidence:capsules` calls in `check`.

- [ ] **Step 5: Generate artifacts**

Run:

```sh
npm run evidence:capsules
npm run challenge:protocol
npm run test:challenge-protocol
```

Expected: generated data files exist and the focused tests pass.

- [ ] **Step 6: Commit**

```sh
git add scripts/lib.mjs scripts/generate-challenge-protocol.mjs schema/challenge-standards.schema.json schema/challenge-queues.schema.json schema/challenge-ledger.schema.json data/challenge-standards.json data/challenge-queues.json data/challenge-ledger.json package.json package-lock.json
git commit -m "feat: generate adversarial challenge artifacts"
```

---

### Task 4: Add Validation, Hashing, And Release Notes

**Files:**
- Modify: `scripts/validate-data.mjs`
- Modify: `scripts/hash-dataset.mjs`
- Modify: `scripts/generate-release-notes.mjs`
- Modify generated: `data/snapshot-manifest.json`
- Modify generated: `data/snapshots/snapshot_2026_06_03_4000_records.json`
- Modify generated: `RELEASE_NOTES.md`

- [ ] **Step 1: Validate challenge artifacts**

In `scripts/validate-data.mjs`, import:

```js
import { hasProhibitedChallengeClaim, validateChallengeArtifacts } from "./challenge-protocol-lib.mjs";
```

Add `challengeStandards`, `challengeQueues`, and `challengeLedger` to the Promise destructuring and reads:

```js
  challengeStandards,
  challengeQueues,
  challengeLedger,
```

```js
  readJson(paths.challengeStandards),
  readJson(paths.challengeQueues),
  readJson(paths.challengeLedger),
```

After the existing evidence capsule validation block, add:

```js
errors.push(...validateChallengeArtifacts({ standards: challengeStandards, queues: challengeQueues, ledger: challengeLedger, events, sources, corrections }));

if (hasProhibitedChallengeClaim(JSON.stringify(challengeStandards))) errors.push("Challenge standards contain prohibited overclaiming language");
if (hasProhibitedChallengeClaim(JSON.stringify(challengeQueues))) errors.push("Challenge queues contain prohibited overclaiming language");
if (hasProhibitedChallengeClaim(JSON.stringify(challengeLedger))) errors.push("Challenge ledger contains prohibited overclaiming language");
```

- [ ] **Step 2: Include challenge artifacts in hashing**

In `scripts/hash-dataset.mjs`, add the three artifacts to reads:

```js
  challengeStandards,
  challengeQueues,
  challengeLedger
```

Add hashes:

```js
const challengeStandardsHash = sha256(challengeStandards);
const challengeQueuesHash = sha256(challengeQueues);
const challengeLedgerHash = sha256(challengeLedger);
```

Add totals:

```js
    challenge_standards: challengeStandards.standards.length,
    challenge_queues: challengeQueues.queues.length,
    challenge_packets: challengeQueues.packets.length,
    challenge_ledger_entries: challengeLedger.entries.length
```

Add manifest hashes:

```js
    challenge_standards: challengeStandardsHash,
    challenge_queues: challengeQueuesHash,
    challenge_ledger: challengeLedgerHash,
```

Add these hashes into the `full_snapshot` object.

- [ ] **Step 3: Update release notes**

In `scripts/generate-release-notes.mjs`, add bullet rows in Dataset Counts:

```js
  bullet("Challenge standards", manifest.totals.challenge_standards),
  bullet("Challenge queues", manifest.totals.challenge_queues),
  bullet("Challenge packets", manifest.totals.challenge_packets),
  bullet("Challenge ledger entries", manifest.totals.challenge_ledger_entries),
```

Add hash rows:

```js
  bullet("Challenge standards", `\`${manifest.hashes.challenge_standards}\``),
  bullet("Challenge queues", `\`${manifest.hashes.challenge_queues}\``),
  bullet("Challenge ledger", `\`${manifest.hashes.challenge_ledger}\``),
```

Add a section after Evidence Depth & Robustness:

```js
  "## Adversarial Review Protocol",
  "",
  "- Challenge arena: `/challenge/`",
  "- Challenge standards: `/data/challenge-standards.json`",
  "- Challenge queues and packets: `/data/challenge-queues.json`",
  "- Challenge ledger: `/data/challenge-ledger.json`",
  "- Challenge artifacts are public review workflow aids. They do not represent external audit, endorsement, ranking, safety scoring, severity scoring, prevalence estimates, legal findings, or institutional quality judgments.",
  "",
```

- [ ] **Step 4: Regenerate and test**

Run:

```sh
npm run challenge:protocol
npm run validate:data
npm run hash:data
node scripts/hash-dataset.mjs --check
npm run release-notes:data
```

Expected: validation passes, hash check passes, release notes include challenge counts and hashes.

- [ ] **Step 5: Commit**

```sh
git add scripts/validate-data.mjs scripts/hash-dataset.mjs scripts/generate-release-notes.mjs data/snapshot-manifest.json data/snapshots/snapshot_2026_06_03_4000_records.json RELEASE_NOTES.md
git commit -m "feat: validate and hash challenge protocol artifacts"
```

---

### Task 5: Render The Public Challenge Arena

**Files:**
- Create: `challenge/index.html`
- Modify: `assets/app.js`
- Modify: `scripts/build-static.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify generated: `sitemap.xml`

- [ ] **Step 1: Add static route**

Create `challenge/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Challenge Arena / Campus Evidence Lab</title>
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body data-page="challenge">
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="../">
          <span class="brand__name">Campus Evidence Lab</span>
          <span class="brand__tag">Public evidence infrastructure</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a href="../" data-nav="dashboard">Dashboard</a>
          <a href="../events/" data-nav="events">Events</a>
          <a href="../sources/" data-nav="sources">Sources</a>
          <a href="../challenge/" data-nav="challenge">Challenge</a>
          <a href="../robustness/" data-nav="robustness">Robustness</a>
          <a href="../reviewer-queue/" data-nav="reviewer-queue">Review</a>
          <a href="../methodology/" data-nav="methodology">Methodology</a>
          <a href="../downloads/" data-nav="downloads">Data</a>
        </nav>
      </div>
    </header>
    <main class="main">
      <p class="page-kicker">Adversarial Review</p>
      <h1 class="page-title page-title--small">Challenge the record, not by trust but by evidence.</h1>
      <p class="page-intro">The challenge arena publishes the standards, queues, packets, and ledger used to inspect weak or ambiguous records. It is a correction workflow, not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit.</p>
      <div id="challenge-root" data-error-root></div>
    </main>
    <footer class="site-footer">Campus Evidence Lab / Public challenge standards</footer>
    <script type="module" src="../assets/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Load challenge data in `assets/app.js`**

Add to `DATA_PATHS`:

```js
  challengeStandards: sitePath("/data/challenge-standards.json"),
  challengeQueues: sitePath("/data/challenge-queues.json"),
  challengeLedger: sitePath("/data/challenge-ledger.json"),
```

Add to `state`:

```js
  challengeStandards: { standards: [] },
  challengeQueues: { queues: [], packets: [] },
  challengeLedger: { entries: [] },
```

Add to `loadData()` fetches and assignments:

```js
    challengeStandards,
    challengeQueues,
    challengeLedger,
```

```js
    fetchJson(DATA_PATHS.challengeStandards),
    fetchJson(DATA_PATHS.challengeQueues),
    fetchJson(DATA_PATHS.challengeLedger),
```

```js
  state.challengeStandards = challengeStandards;
  state.challengeQueues = challengeQueues;
  state.challengeLedger = challengeLedger;
```

- [ ] **Step 3: Add render function**

Add near `renderEvidence()`:

```js
function renderChallenge() {
  const root = document.querySelector("#challenge-root");
  if (!root) return;

  const standards = state.challengeStandards?.standards ?? [];
  const queues = state.challengeQueues?.queues ?? [];
  const packets = state.challengeQueues?.packets ?? [];
  const ledgerEntries = state.challengeLedger?.entries ?? [];
  const featuredPackets = packets.slice(0, 8);

  root.innerHTML = `
    <section class="section section--tight">
      <div class="metrics-grid">
        ${metric(String(standards.length), "Challenge standards")}
        ${metric(String(queues.length), "Review queues")}
        ${metric(String(packets.length), "Challenge packets")}
        ${metric(String(ledgerEntries.length), "Ledger entries")}
      </div>
      <p class="section-note">Challenge queues are deterministic review-workflow aids. They do not rank schools, estimate prevalence, score safety, score severity, make legal findings, imply endorsement, or claim external audit.</p>
    </section>
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Challenge Standards</h2>
        <p class="section-note">What public counterevidence can change</p>
      </div>
      <div class="card-grid">
        ${standards
          .map(
            (standard) => `
              <article class="record-card">
                <h3>${escapeHtml(standard.label)}</h3>
                <p>${escapeHtml(standard.applies_when)}</p>
                <p><strong>May change:</strong> ${escapeHtml((standard.fields_that_may_change ?? []).join(", "))}</p>
                <p class="section-note">${escapeHtml(standard.no_overclaiming_warning)}</p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Adversarial Queues</h2>
        <p class="section-note">Review order only</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Queue</th>
              <th>Records</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            ${queues
              .map(
                (queue) => `
                  <tr>
                    <td>${escapeHtml(queue.label)}</td>
                    <td>${queue.records?.length ?? 0}</td>
                    <td>${escapeHtml(queue.description)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Featured Challenge Packets</h2>
        <p class="section-note">A bounded first set for public-source review</p>
      </div>
      <div class="record-list">
        ${featuredPackets
          .map(
            (packet) => `
              <article class="record-card">
                <h3><a href="${sitePath(packet.event_url)}">${escapeHtml(packet.school_name)}</a></h3>
                <p>${escapeHtml(packet.category)} / ${escapeHtml(packet.confidence)} confidence / ${escapeHtml(packet.date_precision)} precision</p>
                <p><strong>Challenge types:</strong> ${escapeHtml(packet.challenge_types.join(", "))}</p>
                <p><strong>Review questions:</strong> ${escapeHtml(packet.review_questions.slice(0, 2).join(" "))}</p>
                <p><a href="${sitePath(packet.workspace_url)}">Open research workspace</a> / <a href="${sitePath(packet.submission_packet_url)}">Prepare correction packet</a></p>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Artifacts</h2>
        <p class="section-note">Machine-readable protocol files</p>
      </div>
      <ul class="source-list">
        <li><a href="${sitePath("/data/challenge-standards.json")}">Challenge standards JSON</a></li>
        <li><a href="${sitePath("/data/challenge-queues.json")}">Challenge queues and packets JSON</a></li>
        <li><a href="${sitePath("/data/challenge-ledger.json")}">Challenge ledger JSON</a></li>
        <li><a href="${sitePath("/schema/challenge-standards.schema.json")}">Challenge standards schema</a></li>
        <li><a href="${sitePath("/schema/challenge-queues.schema.json")}">Challenge queues schema</a></li>
        <li><a href="${sitePath("/schema/challenge-ledger.schema.json")}">Challenge ledger schema</a></li>
        <li><a href="${sitePath("/evidence/")}">Evidence provenance page</a></li>
        <li><a href="${sitePath("/docs/contributing.md")}">Contribution standards</a></li>
      </ul>
    </section>
  `;
}
```

Call it in the app router:

```js
  if (page === "challenge") {
    renderChallenge();
  }
```

- [ ] **Step 4: Add route to build and sitemap**

In `scripts/build-static.mjs`, add:

```js
  "challenge",
```

In `scripts/generate-sitemap.mjs`, add:

```js
  "/challenge/",
```

- [ ] **Step 5: Regenerate sitemap and render smoke test**

Run:

```sh
npm run sitemap:data
npm run qa:render
```

Expected: `qa:render` includes the challenge route after Task 6 updates QA, or continues passing until QA is updated.

- [ ] **Step 6: Commit**

```sh
git add challenge/index.html assets/app.js scripts/build-static.mjs scripts/generate-sitemap.mjs sitemap.xml
git commit -m "feat: add public challenge arena"
```

---

### Task 6: Add Record-Level Challenge Links And Public Download/Docs Links

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify generated: `events/*/index.html`
- Modify: `downloads/index.html`
- Modify: `docs/data-dictionary.md`
- Modify: `trust/index.html`
- Modify: `reviewer-brief/index.html`
- Modify: `journalist-guide/index.html`
- Modify: `research-guide/index.html`
- Modify: `assets/app.js`

- [ ] **Step 1: Add event-page challenge links only for generated packets**

In `scripts/generate-pages.mjs`, load `paths.challengeQueues` and create a packet event set:

```js
const challengeQueues = await readJson(paths.challengeQueues);
const challengePacketEventIds = new Set((challengeQueues.packets ?? []).map((packet) => packet.event_id));
```

In the event page action/link block, add:

```js
${challengePacketEventIds.has(event.id) ? `<a href="../../challenge/?packet=${encodeURIComponent(event.id)}">Challenge this record</a>` : ""}
```

- [ ] **Step 2: Add downloads page links**

In `downloads/index.html`, add to Direct Files:

```html
<li><a href="../data/challenge-standards.json" download>Challenge standards</a></li>
<li><a href="../data/challenge-queues.json" download>Challenge queues and packets</a></li>
<li><a href="../data/challenge-ledger.json" download>Challenge ledger</a></li>
<li><a href="../challenge/">Adversarial review challenge arena</a></li>
```

In the method and trust review description, add `challenge arena`:

```html
<dd>Use the <a href="../trust/">Trust &amp; Review Packet</a>, <a href="../quality/">Quality page</a>, <a href="../challenge/">challenge arena</a>, <a href="../robustness/">evidence robustness dashboard</a>, <a href="../evidence/">evidence provenance page</a>, <a href="../codebook/">public codebook</a>, <a href="../coverage/">coverage limits</a>, changelog, release notes, and schema files.</dd>
```

- [ ] **Step 3: Add dynamic downloads rows**

In `assets/app.js` `renderDownloads()`, add:

```js
${downloadRow("Challenge Standards JSON", sitePath("/data/challenge-standards.json"), `${state.challengeStandards.standards.length} challenge standards`)}
${downloadRow("Challenge Queues JSON", sitePath("/data/challenge-queues.json"), `${state.challengeQueues.queues.length} queues and ${state.challengeQueues.packets.length} packets`)}
${downloadRow("Challenge Ledger JSON", sitePath("/data/challenge-ledger.json"), `${state.challengeLedger.entries.length} ledger entries`)}
${downloadRow("Challenge Arena", sitePath("/challenge/"), "Public adversarial review workflow", false)}
```

In schema rows, add:

```js
${downloadRow("Challenge Standards Schema", sitePath("/schema/challenge-standards.schema.json"), "Challenge standard fields")}
${downloadRow("Challenge Queues Schema", sitePath("/schema/challenge-queues.schema.json"), "Challenge queue and packet fields")}
${downloadRow("Challenge Ledger Schema", sitePath("/schema/challenge-ledger.schema.json"), "Challenge ledger fields")}
```

- [ ] **Step 4: Document data dictionary**

Append to `docs/data-dictionary.md`:

```md
## challenge-standards.json

- snapshot_id: snapshot the standards are tied to.
- generated_at: date the standards artifact was generated.
- method: public explanation of what the standards do and do not claim.
- standards: challenge standards defining acceptable counterevidence, insufficient counterevidence, possible outcomes, fields that may change, and no-overclaiming warnings.

## challenge-queues.json

- snapshot_id: snapshot the queues are tied to.
- generated_at: date the queue artifact was generated.
- method: public explanation that queues are review workflow aids, not rankings, severity scores, safety scores, prevalence estimates, legal findings, endorsement, or external audit.
- queues: deterministic adversarial review queues with reason codes and record links.
- packets: bounded record-level challenge packets with review questions, acceptable counterevidence, possible outcomes, evidence capsule links, submission packet links, and public claim limits.

## challenge-ledger.json

- snapshot_id: snapshot the ledger is tied to.
- updated_at: latest ledger update date.
- method: public explanation that initial entries are seeded open packets, not external submissions.
- statuses: supported challenge status values.
- entries: challenge packet status rows with event IDs, challenge types, decision summaries, correction links, and public limitations.
```

- [ ] **Step 5: Add public cross-links**

Use restrained one-sentence links:

```html
<p class="section-note">Records selected for adversarial review are published in the <a href="../challenge/">challenge arena</a>; queue order is for review workflow only.</p>
```

Add this to pages where it fits naturally:

- `trust/index.html`
- `reviewer-brief/index.html`
- `journalist-guide/index.html`
- `research-guide/index.html`

- [ ] **Step 6: Regenerate pages**

Run:

```sh
npm run pages:data
```

Expected: generated event pages include `Challenge this record` only for packet records.

- [ ] **Step 7: Commit**

```sh
git add scripts/generate-pages.mjs events downloads/index.html docs/data-dictionary.md trust/index.html reviewer-brief/index.html journalist-guide/index.html research-guide/index.html assets/app.js
git commit -m "feat: link challenge protocol across public review surfaces"
```

---

### Task 7: Add Site QA And Content Guardrails

**Files:**
- Modify: `scripts/qa-site.mjs`
- Modify: `scripts/qa-content.mjs`
- Modify generated artifacts from QA-driven fixes if needed

- [ ] **Step 1: Extend site QA route and artifact checks**

In `scripts/qa-site.mjs`, add route:

```js
"challenge/index.html",
```

Add artifacts:

```js
"data/challenge-standards.json",
"data/challenge-queues.json",
"data/challenge-ledger.json",
"schema/challenge-standards.schema.json",
"schema/challenge-queues.schema.json",
"schema/challenge-ledger.schema.json",
```

Add page-copy checks:

```js
for (const challengeCopy of [
  "Adversarial Review",
  "Challenge Standards",
  "Adversarial Queues",
  "Challenge standards JSON",
  "not a ranking",
  "external audit"
]) {
  await mustContain("challenge/index.html", challengeCopy);
}

for (const downloadCopy of [
  "Challenge standards",
  "Challenge queues and packets",
  "Challenge ledger",
  "Adversarial review challenge arena"
]) {
  await mustContain("downloads/index.html", downloadCopy);
}
```

- [ ] **Step 2: Extend content QA prohibited claims**

If `scripts/qa-content.mjs` has a prohibited-claims array, add:

```js
"externally audited",
"external audit confirmed",
"school ranking",
"safety score",
"severity score",
"prevalence estimate"
```

Keep allowed-context checks for sentences that explicitly say CLE does not make these claims.

- [ ] **Step 3: Run focused QA**

Run:

```sh
npm run qa:site
npm run qa:content
```

Expected: both pass.

- [ ] **Step 4: Commit**

```sh
git add scripts/qa-site.mjs scripts/qa-content.mjs
git commit -m "test: guard challenge protocol public claims"
```

---

### Task 8: Full Verification, Generated Site, And Final Checkpoint

**Files:**
- Generated files from `npm run check`
- Generated files from `npm run build`

- [ ] **Step 1: Run full check**

Run:

```sh
npm run check
```

Expected: all tests, validation, data generation, hash checks, QA, accessibility, and render checks pass.

- [ ] **Step 2: Run build**

Run:

```sh
npm run build
```

Expected: build completes, `dist/` is generated, and dist QA passes.

- [ ] **Step 3: Run final integrity checks**

Run:

```sh
node scripts/hash-dataset.mjs --check
npm run validate:data
rg -n "externally audited|external audit confirmed|approved by|endorsed by|safest|most dangerous|best school|worst school|school ranking|safety score|severity score|prevalence estimate" data challenge docs assets RELEASE_NOTES.md || true
node - <<'NODE'
const fs = require('fs');
const standards = JSON.parse(fs.readFileSync('data/challenge-standards.json', 'utf8'));
const queues = JSON.parse(fs.readFileSync('data/challenge-queues.json', 'utf8'));
const ledger = JSON.parse(fs.readFileSync('data/challenge-ledger.json', 'utf8'));
console.log(JSON.stringify({
  challenge_standards: standards.standards.length,
  challenge_queues: queues.queues.length,
  challenge_packets: queues.packets.length,
  challenge_ledger_entries: ledger.entries.length
}, null, 2));
NODE
```

Expected:

- Hash check passes.
- Data validation passes.
- Any `rg` matches are only explicit no-overclaiming disclaimers.
- Counts show 8 standards, 7 queues, 50 to 100 packets, and seeded ledger entries.

- [ ] **Step 4: Commit final generated state**

```sh
git status --short
git add -A
git commit -m "feat: publish adversarial review protocol"
git status --short
```

Expected: clean worktree after commit.

---

## Self-Review Notes

- Spec coverage: The plan covers challenge standards, deterministic queues, bounded packets, seed ledger, public `/challenge/` page, record-level links, validation, no-overclaiming guardrails, hash/release integration, docs, downloads, sitemap, build output, QA, and full verification.
- Scope boundary: The plan does not add live moderation, anonymous public submissions, external-audit claims, rankings, severity scoring, safety scoring, prevalence estimates, or automated fact-finding beyond existing public-source artifacts.
- TDD path: Task 1 creates the failing test before the library. Later tasks use focused tests first, then full `npm run check` and `npm run build`.
- Risk: `assets/app.js` is already large. This plan keeps the rendering addition local and does not refactor unrelated UI code.
