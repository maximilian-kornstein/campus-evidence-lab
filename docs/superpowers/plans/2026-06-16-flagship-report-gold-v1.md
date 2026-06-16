# Flagship Report Gold V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first flagship thesis artifact and a 25-record gold-review corpus that make Campus Evidence Lab more distinctive, reviewable, and methodologically serious without claiming external validation.

**Architecture:** Add one focused generator library for flagship findings and gold-review packets, backed by schemas, validation, QA, and public pages. The generator consumes existing canonical events, sources, schools, robustness metrics, evidence capsules, and challenge packets; it produces bounded public artifacts that link every claim to records, workspace packets, and challenge routes.

**Tech Stack:** Node.js ES modules, static JSON artifacts, JSON Schema files, existing `assets/app.js` rendering, generated static pages, `node --test`, existing validation/hash/site/accessibility/render QA.

---

## File Structure

- Create `scripts/flagship-report-lib.mjs`: pure functions for building the flagship report artifact, selecting 25 gold-review records, deriving finding support rows, and detecting prohibited claims.
- Create `scripts/generate-flagship-report.mjs`: reads existing data artifacts and writes `data/flagship-report.json` plus `data/gold-record-v1.json`.
- Create `test/flagship-report.test.mjs`: unit tests for bounded thesis language, finding evidence links, gold-review packet shape, and no-overclaiming guardrails.
- Create `schema/flagship-report.schema.json`: validates report metadata, findings, evidence links, limitations, and challenge links.
- Create `schema/gold-record-v1.schema.json`: validates 25 gold-review packets and required rationale fields.
- Modify `scripts/lib.mjs`: add paths for the two new data artifacts.
- Modify `scripts/validate-data.mjs`: read and validate the two new artifacts against canonical event/source/school IDs and claim boundaries.
- Modify `package.json`: add `flagship:data`; wire it into `prepare:data` and `check` before validation/hash/page generation.
- Modify `assets/app.js`: load the two new artifacts and render `/flagship/` and `/gold-records/`.
- Create `flagship/index.html` and `gold-records/index.html`: public static entry points.
- Modify `scripts/build-static.mjs`, `scripts/generate-sitemap.mjs`, and `scripts/qa-site.mjs`: include routes, artifacts, schemas, and link checks.
- Modify `docs/data-dictionary.md`, `docs/reviewer-brief.md`, `docs/research-guide.md` if present, `trust/index.html`, `downloads/index.html`, and `README.md`: describe the new artifacts as review aids, not endorsements or rankings.

---

### Task 1: Define Failing Tests for Flagship and Gold V1

**Files:**
- Create: `test/flagship-report.test.mjs`
- Test command: `npm run test:flagship`

- [ ] **Step 1: Add the test script**

Modify `package.json` scripts to include:

```json
"test:flagship": "node --test test/flagship-report.test.mjs"
```

- [ ] **Step 2: Write the failing tests**

Create `test/flagship-report.test.mjs` with this complete starting suite:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFlagshipReport,
  buildGoldRecordV1,
  containsProhibitedFlagshipClaim
} from "../scripts/flagship-report-lib.mjs";

const events = [
  {
    id: "evt_alpha",
    school_id: "alpha_university",
    date: "2026-01-15",
    date_precision: "day",
    category: "OCR complaint",
    affected_communities: ["Jewish"],
    source_ids: ["src_ocr", "src_university"],
    source_types: ["Government release", "University statement"],
    confidence: "High",
    verification_status: "Verified from multiple public sources",
    institutional_response: "Alpha University said it would update training and report to OCR.",
    response_date: "2026-01-16",
    classification_rationale: "OCR complaint is retained because the public OCR source describes the matter as an OCR case.",
    community_rationale: "Jewish is retained because the public OCR source describes shared ancestry concerns.",
    confidence_rationale: "High confidence reflects multiple linked public sources and is not a severity score."
  },
  {
    id: "evt_beta",
    school_id: "beta_college",
    date: "2025-01-01",
    date_precision: "year",
    category: "Vandalism",
    affected_communities: ["Religion"],
    source_ids: ["src_dataset"],
    source_types: ["Government dataset"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response: "The record summarizes public dataset fields and does not independently evaluate investigative, disciplinary, or institutional response outcomes."
  },
  {
    id: "evt_gamma",
    school_id: "gamma_college",
    date: "2026-03-01",
    date_precision: "month",
    category: "Harassment or threat",
    affected_communities: ["Race"],
    source_ids: ["src_news"],
    source_types: ["News report"],
    confidence: "Medium",
    verification_status: "Verified from public source",
    institutional_response: ""
  }
];

const schools = [
  { id: "alpha_university", name: "Alpha University", state: "GA" },
  { id: "beta_college", name: "Beta College", state: "MA" },
  { id: "gamma_college", name: "Gamma College", state: "CA" }
];

const sources = [
  { id: "src_ocr", title: "OCR release", source_type: "Government release", url: "https://example.edu/ocr" },
  { id: "src_university", title: "University statement", source_type: "University statement", url: "https://example.edu/statement" },
  { id: "src_dataset", title: "Dataset row", source_type: "Government dataset", url: "https://example.edu/dataset" },
  { id: "src_news", title: "News report", source_type: "News report", url: "https://example.edu/news" }
];

const robustnessMetrics = {
  snapshot_id: "snapshot_test",
  generated_at: "2026-06-16",
  totals: { events: 3, single_source_events: 2, multi_source_events: 1, records_with_explicit_rationales: 1 },
  source_type_concentration: { top_value: { value: "Government dataset", count: 1, percent: 33.33 } },
  date_precision: { year: { count: 1, percent: 33.33 }, day: { count: 1, percent: 33.33 }, month: { count: 1, percent: 33.33 } },
  confidence: { High: { count: 1, percent: 33.33 }, Medium: { count: 2, percent: 66.67 } },
  response_depth: {
    direct_institutional_response: { count: 1, percent: 33.33 },
    limited_public_response_note: { count: 1, percent: 33.33 },
    no_public_response_found: { count: 1, percent: 33.33 }
  },
  review_gaps: {
    single_source_government_dataset: 1,
    year_precision: 1,
    medium_or_low_confidence: 2,
    limited_or_missing_response: 2,
    missing_explicit_rationales: 2
  },
  known_limits: ["Composition metrics describe current records, not prevalence."]
};

const challengeQueues = {
  packets: [
    {
      event_id: "evt_beta",
      event_url: "/events/evt_beta/",
      workspace_url: "/research-workspace/?record_ids=evt_beta",
      submission_packet_url: "/submit/?type=correction&record_id=evt_beta",
      challenge_types: ["date_precision_challenge", "source_sufficiency_challenge"]
    }
  ]
};

test("buildFlagshipReport creates a bounded thesis with evidence-backed findings", () => {
  const report = buildFlagshipReport({
    events,
    schools,
    sources,
    robustnessMetrics,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16", hashes: { full_snapshot: "sha256:test" } }
  });

  assert.equal(report.id, "flagship_public_evidence_infrastructure_v1");
  assert.equal(report.snapshot_id, "snapshot_test");
  assert.equal(report.thesis.includes("evidence infrastructure"), true);
  assert.equal(report.findings.length >= 5, true);
  assert.equal(report.findings.every((finding) => finding.evidence_links.length > 0), true);
  assert.equal(report.findings.every((finding) => finding.challenge_url.startsWith("/challenge/")), true);
  assert.equal(containsProhibitedFlagshipClaim(JSON.stringify(report)), false);
});

test("buildGoldRecordV1 creates exactly bounded review packets with challenge and workspace links", () => {
  const gold = buildGoldRecordV1({
    events,
    schools,
    sources,
    challengeQueues,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-16" },
    limit: 2
  });

  assert.equal(gold.snapshot_id, "snapshot_test");
  assert.equal(gold.records.length, 2);
  assert.equal(gold.records.every((record) => record.status === "gold_v1_review_packet"), true);
  assert.equal(gold.records.every((record) => record.workspace_url.includes("record_ids=")), true);
  assert.equal(gold.records.every((record) => record.event_url.startsWith("/events/")), true);
  assert.equal(gold.records.every((record) => record.review_questions.length >= 4), true);
  assert.equal(gold.records.every((record) => record.public_claim_limit.includes("not outside validation")), true);
  assert.equal(containsProhibitedFlagshipClaim(JSON.stringify(gold)), false);
});

test("containsProhibitedFlagshipClaim rejects ranking, safety, prevalence, and endorsement language", () => {
  assert.equal(containsProhibitedFlagshipClaim("safest school ranking"), true);
  assert.equal(containsProhibitedFlagshipClaim("externally validated by reviewers"), true);
  assert.equal(containsProhibitedFlagshipClaim("prevalence estimate by campus"), true);
  assert.equal(containsProhibitedFlagshipClaim("public evidence infrastructure review artifact"), false);
});
```

- [ ] **Step 3: Run the new test and verify it fails because the module does not exist**

Run:

```sh
npm run test:flagship
```

Expected: FAIL with `Cannot find module '../scripts/flagship-report-lib.mjs'`.

- [ ] **Step 4: Commit the failing tests**

Run:

```sh
git add package.json test/flagship-report.test.mjs
git commit -m "test: define flagship report behavior"
```

---

### Task 2: Implement Flagship and Gold V1 Generators

**Files:**
- Create: `scripts/flagship-report-lib.mjs`
- Create: `scripts/generate-flagship-report.mjs`
- Modify: `scripts/lib.mjs`
- Test: `test/flagship-report.test.mjs`

- [ ] **Step 1: Add data paths**

Modify `scripts/lib.mjs` inside `paths`:

```js
  flagshipReport: path.join(rootDir, "data", "flagship-report.json"),
  goldRecordV1: path.join(rootDir, "data", "gold-record-v1.json"),
```

- [ ] **Step 2: Implement `scripts/flagship-report-lib.mjs`**

Create `scripts/flagship-report-lib.mjs`:

```js
const PROHIBITED_FLAGSHIP_CLAIM_PATTERN =
  /safest|most dangerous|worst school|best school|endorsed by|approved by|validated by|externally validated|outside validated|safety score|severity score|school ranking|prevalence estimate|estimates prevalence|frequency measurement/i;

function compact(items) {
  return items.filter((item) => item !== null && item !== undefined && String(item).trim() !== "");
}

function unique(items) {
  return [...new Set(compact(items).flat())];
}

function sourceMap(sources) {
  return new Map((sources ?? []).map((source) => [source.id, source]));
}

function schoolMap(schools) {
  return new Map((schools ?? []).map((school) => [school.id, school]));
}

function snapshotDate(manifest) {
  return manifest.created_at ?? "2026-06-16";
}

function workspaceUrl(eventId) {
  return `/research-workspace/?record_ids=${encodeURIComponent(eventId)}`;
}

function eventUrl(eventId) {
  return `/events/${encodeURIComponent(eventId)}/`;
}

function correctionUrl(eventId) {
  return `/submit/?type=correction&record_id=${encodeURIComponent(eventId)}`;
}

function challengeUrl(eventId) {
  return `/challenge/?packet=${encodeURIComponent(eventId)}`;
}

function sourceTypesForEvent(event, sourcesById) {
  const linked = (event.source_ids ?? []).map((id) => sourcesById.get(id)?.source_type).filter(Boolean);
  return unique(linked.length ? linked : event.source_types ?? []);
}

function sourceCount(event) {
  return unique(event.source_ids ?? []).length;
}

function isLimitedResponse(value) {
  const text = String(value ?? "").toLowerCase();
  return !text || text.startsWith("the record summarizes ") || text.includes("does not independently evaluate");
}

function recordScore(event, sourcesById) {
  let score = 0;
  if (sourceCount(event) > 1) score += 4;
  if (event.classification_rationale && event.community_rationale && event.confidence_rationale) score += 4;
  if (event.date_precision === "day") score += 2;
  if (event.confidence === "High") score += 2;
  if (!isLimitedResponse(event.institutional_response)) score += 2;
  if (sourceTypesForEvent(event, sourcesById).some((type) => /government|university|court|legal/i.test(type))) score += 2;
  return score;
}

function evidenceLink(id, label, url, note) {
  return { id, label, url, note };
}

function metricFinding(id, title, summary, metric, evidenceLinks) {
  return {
    id,
    title,
    summary,
    metric,
    evidence_links: evidenceLinks,
    use_limit:
      "This finding describes reviewability and documentation structure in the current Campus Evidence Lab snapshot. It is not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit.",
    challenge_url: "/challenge/"
  };
}

export function containsProhibitedFlagshipClaim(value) {
  const text = String(value ?? "");
  const allowedNegation =
    /not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit/i.test(text) ||
    /not outside validation/i.test(text);
  if (allowedNegation) {
    return PROHIBITED_FLAGSHIP_CLAIM_PATTERN.test(text.replace(/not a ranking, safety score, severity score, prevalence estimate, legal finding, endorsement, or external audit/gi, ""));
  }
  return PROHIBITED_FLAGSHIP_CLAIM_PATTERN.test(text);
}

export function buildFlagshipReport({ events, schools = [], sources = [], robustnessMetrics, challengeQueues = {}, manifest = {} }) {
  const challengePacketCount = challengeQueues.packets?.length ?? 0;
  const total = events.length;
  const gaps = robustnessMetrics.review_gaps ?? {};
  const metrics = robustnessMetrics.totals ?? {};

  return {
    id: "flagship_public_evidence_infrastructure_v1",
    title: "The Public Evidence Infrastructure Gap",
    snapshot_id: manifest.snapshot_id ?? robustnessMetrics.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    snapshot_hash: manifest.hashes?.full_snapshot ?? "",
    thesis:
      "Campus civil-rights information is not only a record-count problem; it is an evidence infrastructure problem. The useful unit is a public record that can be traced, challenged, corrected, cited, and bounded against overclaiming.",
    public_claim_limit:
      "This report describes the reviewability of Campus Evidence Lab's current public-source archive. It does not rank schools, score safety, estimate prevalence, make legal findings, claim endorsement, or represent external audit.",
    findings: [
      metricFinding(
        "documentation_over_counts",
        "Documentation matters more than counts",
        `${total} records are useful only when readers can inspect sources, rationale, correction paths, and snapshot hashes.`,
        { value: total, label: "records in current snapshot" },
        [
          evidenceLink("events", "Event dataset", "/data/events.json", "Canonical records."),
          evidenceLink("manifest", "Snapshot manifest", "/data/snapshot-manifest.json", "Hash and totals for the release."),
          evidenceLink("replicate", "Replication guide", "/replicate/", "Commands for reproducing the release.")
        ]
      ),
      metricFinding(
        "source_concentration_requires_review",
        "Source concentration should drive review priorities",
        `The largest source-type share is ${robustnessMetrics.source_type_concentration?.top_value?.value ?? "not available"}, so source mix should be inspected before public reuse.`,
        robustnessMetrics.source_type_concentration?.top_value ?? { value: "unknown", count: 0, percent: 0 },
        [
          evidenceLink("robustness", "Robustness metrics", "/data/robustness-metrics.json", "Source-type and composition metrics."),
          evidenceLink("evidence", "Evidence capsules", "/data/evidence-capsules.json", "Record-level source basis.")
        ]
      ),
      metricFinding(
        "precision_is_a_review_dimension",
        "Date precision is a review dimension",
        `${gaps.year_precision ?? 0} records use year precision and should not be treated like day-level records.`,
        { value: gaps.year_precision ?? 0, label: "year-precision records" },
        [
          evidenceLink("depth", "Evidence-depth queues", "/data/evidence-depth-queues.json", "Date precision follow-up queue."),
          evidenceLink("codebook", "Codebook", "/codebook/", "Date and field definitions.")
        ]
      ),
      metricFinding(
        "response_depth_prevents_false_clarity",
        "Response-depth labels prevent false clarity",
        `${gaps.limited_or_missing_response ?? 0} records have limited or missing public response text and need careful wording before reuse.`,
        { value: gaps.limited_or_missing_response ?? 0, label: "limited or missing public response records" },
        [
          evidenceLink("robustness", "Robustness metrics", "/data/robustness-metrics.json", "Response-depth distribution."),
          evidenceLink("methodology", "Methodology", "/methodology/", "Use limits and response handling.")
        ]
      ),
      metricFinding(
        "adversarial_review_is_infrastructure",
        "Adversarial review is part of the product",
        `${challengePacketCount} challenge packets expose records to source-backed correction instead of asking users to trust the archive.`,
        { value: challengePacketCount, label: "generated challenge packets" },
        [
          evidenceLink("challenge", "Challenge queues", "/data/challenge-queues.json", "Generated packets and queues."),
          evidenceLink("ledger", "Challenge ledger", "/data/challenge-ledger.json", "Open review ledger.")
        ]
      )
    ],
    recommended_next_reviews: [
      "Review the 25-record gold v1 packet against linked public sources.",
      "Invite reviewers to challenge classification, affected-community labels, response-depth labels, and confidence rationale.",
      "Record accepted corrections publicly before expanding the gold corpus."
    ],
    audience_paths: [
      { audience: "journalists", url: "/journalist-guide/", use: "Find source-backed records and avoid prevalence claims." },
      { audience: "reviewers", url: "/reviewer-brief/", use: "Inspect methodology and challenge records." },
      { audience: "researchers", url: "/research-workspace/", use: "Build citation packets from record IDs." },
      { audience: "public users", url: "/research-guide/", use: "Understand what the archive can and cannot support." }
    ]
  };
}

export function buildGoldRecordV1({ events, schools = [], sources = [], challengeQueues = {}, manifest = {}, limit = 25 }) {
  const sourcesById = sourceMap(sources);
  const schoolsById = schoolMap(schools);
  const packetByEventId = new Map((challengeQueues.packets ?? []).map((packet) => [packet.event_id, packet]));
  const selected = [...events]
    .map((event) => ({ event, score: recordScore(event, sourcesById) }))
    .sort((a, b) => b.score - a.score || a.event.id.localeCompare(b.event.id))
    .slice(0, limit)
    .map(({ event, score }) => {
      const school = schoolsById.get(event.school_id);
      const sourceIds = event.source_ids ?? [];
      const linkedSources = sourceIds.map((id) => sourcesById.get(id)).filter(Boolean);
      const challengePacket = packetByEventId.get(event.id);
      return {
        event_id: event.id,
        school_id: event.school_id,
        school_name: school?.name ?? event.school_id,
        status: "gold_v1_review_packet",
        review_score: score,
        category: event.category,
        affected_communities: event.affected_communities ?? [],
        confidence: event.confidence,
        date_precision: event.date_precision,
        source_ids: sourceIds,
        source_titles: linkedSources.map((source) => source.title),
        source_types: sourceTypesForEvent(event, sourcesById),
        event_url: eventUrl(event.id),
        workspace_url: workspaceUrl(event.id),
        challenge_url: challengePacket ? challengeUrl(event.id) : null,
        correction_url: correctionUrl(event.id),
        review_questions: [
          "Does each included source support the school, date, category, affected-community label, and confidence label?",
          "Is the affected-community label as narrow as the public source permits?",
          "Does the institutional-response wording distinguish direct response, agency-described action, limited note, and missing response?",
          "What public counterevidence would require a correction, narrower wording, or removal?"
        ],
        rationale_packet: {
          classification_rationale:
            event.classification_rationale ||
            `Category "${event.category}" is retained from current public-source metadata and must be checked against source text before stronger use.`,
          community_rationale:
            event.community_rationale ||
            `Affected-community labels (${(event.affected_communities ?? []).join(", ") || "none recorded"}) are current metadata labels and should be checked against public source wording.`,
          confidence_rationale:
            event.confidence_rationale ||
            `${event.confidence} confidence reflects current verification metadata and ${sourceCount(event)} linked public source${sourceCount(event) === 1 ? "" : "s"}; it is not a severity, prevalence, or legal-truth score.`,
          response_note:
            event.institutional_response || "No public institutional response text is stored for this record in the current dataset."
        },
        public_claim_limit:
          "Gold v1 review packet status means the record is selected for high-density review. It is not outside validation, endorsement, legal finding, severity score, safety score, ranking, or prevalence evidence."
      };
    });

  return {
    snapshot_id: manifest.snapshot_id ?? "unversioned",
    generated_at: snapshotDate(manifest),
    review_standard: "gold_v1_public_source_review_packet",
    public_claim_limit:
      "Gold v1 packets identify records selected for high-density review. They do not represent outside validation, endorsement, rankings, safety scoring, severity scoring, prevalence estimates, or legal findings.",
    records: selected
  };
}
```

- [ ] **Step 3: Implement `scripts/generate-flagship-report.mjs`**

Create `scripts/generate-flagship-report.mjs`:

```js
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildFlagshipReport, buildGoldRecordV1 } from "./flagship-report-lib.mjs";

const [events, schools, sources, robustnessMetrics, challengeQueues, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.robustnessMetrics),
  readJson(paths.challengeQueues),
  readJson(paths.manifest)
]);

const flagshipReport = buildFlagshipReport({ events, schools, sources, robustnessMetrics, challengeQueues, manifest });
const goldRecordV1 = buildGoldRecordV1({ events, schools, sources, challengeQueues, manifest, limit: 25 });

await Promise.all([writeJson(paths.flagshipReport, flagshipReport), writeJson(paths.goldRecordV1, goldRecordV1)]);

console.log(`Generated flagship report with ${flagshipReport.findings.length} findings and ${goldRecordV1.records.length} gold v1 packets.`);
```

- [ ] **Step 4: Run the tests and generator**

Run:

```sh
npm run test:flagship
node scripts/generate-flagship-report.mjs
```

Expected:

```text
# pass 3
Generated flagship report with 5 findings and 25 gold v1 packets.
```

- [ ] **Step 5: Commit the generator implementation**

Run:

```sh
git add scripts/lib.mjs scripts/flagship-report-lib.mjs scripts/generate-flagship-report.mjs data/flagship-report.json data/gold-record-v1.json package.json
git commit -m "feat: generate flagship review artifacts"
```

---

### Task 3: Add Schemas and Data Validation

**Files:**
- Create: `schema/flagship-report.schema.json`
- Create: `schema/gold-record-v1.schema.json`
- Modify: `scripts/validate-data.mjs`
- Modify: `scripts/qa-site.mjs`

- [ ] **Step 1: Add flagship report schema**

Create `schema/flagship-report.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Campus Evidence Lab Flagship Report",
  "type": "object",
  "additionalProperties": false,
  "required": ["id", "title", "snapshot_id", "generated_at", "thesis", "public_claim_limit", "findings", "recommended_next_reviews", "audience_paths"],
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "title": { "type": "string", "minLength": 1 },
    "snapshot_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "snapshot_hash": { "type": "string" },
    "thesis": { "type": "string", "minLength": 80 },
    "public_claim_limit": { "type": "string", "minLength": 80 },
    "findings": {
      "type": "array",
      "minItems": 5,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "title", "summary", "metric", "evidence_links", "use_limit", "challenge_url"],
        "properties": {
          "id": { "type": "string", "minLength": 1 },
          "title": { "type": "string", "minLength": 1 },
          "summary": { "type": "string", "minLength": 1 },
          "metric": {
            "type": "object",
            "additionalProperties": true,
            "required": ["value", "label"],
            "properties": {
              "value": {},
              "label": { "type": "string", "minLength": 1 }
            }
          },
          "evidence_links": {
            "type": "array",
            "minItems": 1,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": ["id", "label", "url", "note"],
              "properties": {
                "id": { "type": "string", "minLength": 1 },
                "label": { "type": "string", "minLength": 1 },
                "url": { "type": "string", "minLength": 1 },
                "note": { "type": "string", "minLength": 1 }
              }
            }
          },
          "use_limit": { "type": "string", "minLength": 80 },
          "challenge_url": { "type": "string", "minLength": 1 }
        }
      }
    },
    "recommended_next_reviews": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "audience_paths": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["audience", "url", "use"],
        "properties": {
          "audience": { "type": "string", "minLength": 1 },
          "url": { "type": "string", "minLength": 1 },
          "use": { "type": "string", "minLength": 1 }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Add gold v1 schema**

Create `schema/gold-record-v1.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Campus Evidence Lab Gold Record V1",
  "type": "object",
  "additionalProperties": false,
  "required": ["snapshot_id", "generated_at", "review_standard", "public_claim_limit", "records"],
  "properties": {
    "snapshot_id": { "type": "string", "minLength": 1 },
    "generated_at": { "type": "string", "pattern": "^\\d{4}-\\d{2}-\\d{2}$" },
    "review_standard": { "type": "string", "minLength": 1 },
    "public_claim_limit": { "type": "string", "minLength": 80 },
    "records": {
      "type": "array",
      "minItems": 25,
      "maxItems": 25,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "event_id",
          "school_id",
          "school_name",
          "status",
          "review_score",
          "category",
          "affected_communities",
          "confidence",
          "date_precision",
          "source_ids",
          "source_titles",
          "source_types",
          "event_url",
          "workspace_url",
          "challenge_url",
          "correction_url",
          "review_questions",
          "rationale_packet",
          "public_claim_limit"
        ],
        "properties": {
          "event_id": { "type": "string", "minLength": 1 },
          "school_id": { "type": "string", "minLength": 1 },
          "school_name": { "type": "string", "minLength": 1 },
          "status": { "type": "string", "const": "gold_v1_review_packet" },
          "review_score": { "type": "number" },
          "category": { "type": "string", "minLength": 1 },
          "affected_communities": { "type": "array", "items": { "type": "string" } },
          "confidence": { "type": "string", "minLength": 1 },
          "date_precision": { "type": "string", "minLength": 1 },
          "source_ids": { "type": "array", "items": { "type": "string" } },
          "source_titles": { "type": "array", "items": { "type": "string" } },
          "source_types": { "type": "array", "items": { "type": "string" } },
          "event_url": { "type": "string", "minLength": 1 },
          "workspace_url": { "type": "string", "minLength": 1 },
          "challenge_url": { "anyOf": [{ "type": "string", "minLength": 1 }, { "type": "null" }] },
          "correction_url": { "type": "string", "minLength": 1 },
          "review_questions": { "type": "array", "minItems": 4, "items": { "type": "string", "minLength": 1 } },
          "rationale_packet": {
            "type": "object",
            "additionalProperties": false,
            "required": ["classification_rationale", "community_rationale", "confidence_rationale", "response_note"],
            "properties": {
              "classification_rationale": { "type": "string", "minLength": 1 },
              "community_rationale": { "type": "string", "minLength": 1 },
              "confidence_rationale": { "type": "string", "minLength": 1 },
              "response_note": { "type": "string", "minLength": 1 }
            }
          },
          "public_claim_limit": { "type": "string", "minLength": 80 }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Validate references and overclaiming in `scripts/validate-data.mjs`**

Import `containsProhibitedFlagshipClaim`:

```js
import { containsProhibitedFlagshipClaim } from "./flagship-report-lib.mjs";
```

Read the artifacts:

```js
const flagshipReport = await readJson(paths.flagshipReport);
const goldRecordV1 = await readJson(paths.goldRecordV1);
```

Add validation after challenge artifact validation:

```js
if (flagshipReport.snapshot_id !== manifest.snapshot_id) {
  errors.push("flagship-report snapshot_id must match the current manifest");
}
if (goldRecordV1.snapshot_id !== manifest.snapshot_id) {
  errors.push("gold-record-v1 snapshot_id must match the current manifest");
}
if (containsProhibitedFlagshipClaim(JSON.stringify(flagshipReport)) || containsProhibitedFlagshipClaim(JSON.stringify(goldRecordV1))) {
  errors.push("flagship or gold v1 artifact contains prohibited ranking, safety, prevalence, validation, or endorsement language");
}
for (const finding of flagshipReport.findings ?? []) {
  if (!Array.isArray(finding.evidence_links) || finding.evidence_links.length === 0) {
    errors.push(`flagship finding ${finding.id} must include evidence links`);
  }
  if (!finding.challenge_url?.startsWith("/challenge/")) {
    errors.push(`flagship finding ${finding.id} must link to challenge workflow`);
  }
}
for (const record of goldRecordV1.records ?? []) {
  if (!eventIds.has(record.event_id)) errors.push(`gold-record-v1 references unknown event ${record.event_id}`);
  if (!schoolIds.has(record.school_id)) errors.push(`gold-record-v1 references unknown school ${record.school_id}`);
  for (const sourceId of record.source_ids ?? []) {
    if (!sourceIds.has(sourceId)) errors.push(`gold-record-v1 ${record.event_id} references unknown source ${sourceId}`);
  }
  if (!record.workspace_url?.includes("record_ids=")) errors.push(`gold-record-v1 ${record.event_id} workspace_url must select record_ids`);
  if (!record.correction_url?.includes("record_id=")) errors.push(`gold-record-v1 ${record.event_id} correction_url must prefill record_id`);
}
```

- [ ] **Step 4: Add QA existence checks**

Modify `scripts/qa-site.mjs` artifact list to include:

```js
"data/flagship-report.json",
"data/gold-record-v1.json",
"schema/flagship-report.schema.json",
"schema/gold-record-v1.schema.json",
"flagship/index.html",
"gold-records/index.html"
```

Add content checks:

```js
for (const flagshipCopy of ["The Public Evidence Infrastructure Gap", "not a ranking", "challenge", "gold v1"]) {
  await mustContain("flagship/index.html", flagshipCopy);
}
for (const goldCopy of ["Gold Record V1", "not outside validation", "Review packet", "data/gold-record-v1.json"]) {
  await mustContain("gold-records/index.html", goldCopy);
}
```

- [ ] **Step 5: Run validation**

Run:

```sh
node scripts/generate-flagship-report.mjs
npm run validate:data
```

Expected:

```text
Generated flagship report with 5 findings and 25 gold v1 packets.
Data validation passed: 4000 events, 947 schools, 25 sources, 0 corrections.
```

- [ ] **Step 6: Commit schemas and validation**

Run:

```sh
git add schema/flagship-report.schema.json schema/gold-record-v1.schema.json scripts/validate-data.mjs scripts/qa-site.mjs data/flagship-report.json data/gold-record-v1.json
git commit -m "feat: validate flagship review artifacts"
```

---

### Task 4: Wire Generation, Hashing, and Release Pipeline

**Files:**
- Modify: `package.json`
- Modify: `scripts/hash-dataset.mjs`
- Modify: `scripts/generate-release-notes.mjs`
- Modify: `docs/data-dictionary.md`

- [ ] **Step 1: Add the generation script**

Modify `package.json`:

```json
"flagship:data": "node scripts/generate-flagship-report.mjs"
```

In `prepare:data`, run `flagship:data` after `challenge:protocol` and before the second `hash:data`.

In `check`, run `flagship:data` after every `challenge:protocol` invocation and before `validate:data` or `hash:data`.

- [ ] **Step 2: Include new artifacts in snapshot hashing**

Open `scripts/hash-dataset.mjs` and add the two artifacts to the full snapshot payload next to other review artifacts:

```js
flagship_report: await readJson(paths.flagshipReport),
gold_record_v1: await readJson(paths.goldRecordV1),
```

Expected effect: the full snapshot hash changes when flagship findings or gold v1 packets change.

- [ ] **Step 3: Include new artifacts in release notes**

Modify `scripts/generate-release-notes.mjs` so the Evidence Depth section includes:

```js
"- Flagship report: `/data/flagship-report.json`",
"- Gold Record V1 packets: `/data/gold-record-v1.json`",
```

- [ ] **Step 4: Update data dictionary**

Append to `docs/data-dictionary.md`:

```md
## flagship-report.json

- id: stable flagship report identifier.
- title: public report title.
- thesis: bounded public argument about evidence infrastructure.
- findings: evidence-backed findings with metrics, links, use limits, and challenge route.
- recommended_next_reviews: next review actions that would strengthen the report.
- audience_paths: public routes for journalists, reviewers, researchers, and public users.

## gold-record-v1.json

- snapshot_id: snapshot the gold v1 packets are tied to.
- review_standard: current packet standard.
- records: 25 records selected for high-density review.
- rationale_packet: classification, community, confidence, and response rationale for reviewer inspection.
- review_questions: questions reviewers should answer against linked public sources.
- public_claim_limit: caveat that packet inclusion is not outside validation, endorsement, ranking, safety scoring, severity scoring, prevalence estimation, or legal finding.
```

- [ ] **Step 5: Run pipeline through hash check**

Run:

```sh
npm run robustness:data
npm run evidence:capsules
npm run challenge:protocol
npm run flagship:data
npm run validate:data
npm run hash:data
node scripts/hash-dataset.mjs --check
```

Expected: validation passes and hash check reports `Integrity check passed: sha256:<hash>`.

- [ ] **Step 6: Commit pipeline integration**

Run:

```sh
git add package.json scripts/hash-dataset.mjs scripts/generate-release-notes.mjs docs/data-dictionary.md data/snapshot-manifest.json data/snapshots/snapshot_2026_06_03_4000_records.json data/flagship-report.json data/gold-record-v1.json
git commit -m "feat: include flagship artifacts in release pipeline"
```

---

### Task 5: Add Public Flagship and Gold Record Pages

**Files:**
- Create: `flagship/index.html`
- Create: `gold-records/index.html`
- Modify: `assets/app.js`
- Modify: `scripts/build-static.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/qa-render.mjs`

- [ ] **Step 1: Add static page shells**

Create `flagship/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flagship Report / Campus Evidence Lab</title>
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body data-page="flagship">
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="../">
          <span class="brand__name">Campus Evidence Lab</span>
          <span class="brand__tag">Public evidence infrastructure</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a href="../" data-nav="dashboard">Dashboard</a>
          <a href="../flagship/" data-nav="flagship">Flagship</a>
          <a href="../gold-records/" data-nav="gold-records">Gold V1</a>
          <a href="../challenge/" data-nav="challenge">Challenge</a>
          <a href="../robustness/" data-nav="robustness">Robustness</a>
          <a href="../downloads/" data-nav="downloads">Data</a>
        </nav>
      </div>
    </header>
    <main class="main">
      <p class="page-kicker">Flagship Report</p>
      <h1 class="page-title page-title--small">The Public Evidence Infrastructure Gap</h1>
      <p class="page-intro">A bounded, source-linked thesis about why reviewable public evidence matters more than raw record counts.</p>
      <div id="flagship-root" data-error-root>
        <section class="section section--tight">
          <h2 class="section-title">Report artifacts</h2>
          <p><a href="../data/flagship-report.json">Flagship report JSON</a> / <a href="../challenge/">Challenge workflow</a></p>
        </section>
      </div>
    </main>
    <footer class="site-footer">Campus Evidence Lab / Flagship report is bounded by public-source limitations</footer>
    <script type="module" src="../assets/app.js"></script>
  </body>
</html>
```

Create `gold-records/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gold Record V1 / Campus Evidence Lab</title>
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body data-page="gold-records">
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="../">
          <span class="brand__name">Campus Evidence Lab</span>
          <span class="brand__tag">Public evidence infrastructure</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a href="../" data-nav="dashboard">Dashboard</a>
          <a href="../flagship/" data-nav="flagship">Flagship</a>
          <a href="../gold-records/" data-nav="gold-records">Gold V1</a>
          <a href="../challenge/" data-nav="challenge">Challenge</a>
          <a href="../research-workspace/" data-nav="research-workspace">Workspace</a>
          <a href="../downloads/" data-nav="downloads">Data</a>
        </nav>
      </div>
    </header>
    <main class="main">
      <p class="page-kicker">Gold Record V1</p>
      <h1 class="page-title page-title--small">Twenty-five records selected for high-density review.</h1>
      <p class="page-intro">Gold v1 packets are review packets, not outside validation. They show the source basis, rationale questions, challenge paths, and correction paths for records worth inspecting closely.</p>
      <div id="gold-records-root" data-error-root>
        <section class="section section--tight">
          <h2 class="section-title">Review packet artifacts</h2>
          <p><a href="../data/gold-record-v1.json">Gold Record V1 JSON</a> / <a href="../data/flagship-report.json">Flagship report JSON</a></p>
        </section>
      </div>
    </main>
    <footer class="site-footer">Campus Evidence Lab / Gold v1 means selected for review, not endorsed</footer>
    <script type="module" src="../assets/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Load artifacts in `assets/app.js`**

Add to `DATA_PATHS`:

```js
  flagshipReport: sitePath("/data/flagship-report.json"),
  goldRecordV1: sitePath("/data/gold-record-v1.json"),
```

Add to default `state`:

```js
  flagshipReport: { findings: [], audience_paths: [] },
  goldRecordV1: { records: [] },
```

Add to the main `Promise.all` data load:

```js
flagshipReport,
goldRecordV1,
```

Assign:

```js
state.flagshipReport = flagshipReport;
state.goldRecordV1 = goldRecordV1;
```

- [ ] **Step 3: Render flagship page**

Add this function near `renderChallenge()`:

```js
function renderFlagship() {
  const root = document.querySelector("#flagship-root");
  if (!root) return;
  const report = state.flagshipReport;
  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">${escapeHtml(report.title)}</h2>
        <p class="section-note">Snapshot ${escapeHtml(report.snapshot_id ?? "")}</p>
      </div>
      <p class="section-copy">${escapeHtml(report.thesis ?? "")}</p>
      <p class="section-copy">${escapeHtml(report.public_claim_limit ?? "")}</p>
    </section>
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Findings</h2>
        <p class="section-note">Each finding links to data artifacts and the challenge workflow.</p>
      </div>
      <div class="action-grid">
        ${(report.findings ?? [])
          .map(
            (finding) => `
              <div class="action-link">
                <span>${escapeHtml(finding.title)}</span>
                <span>
                  ${escapeHtml(finding.summary)}<br>
                  Metric: ${escapeHtml(String(finding.metric?.value ?? ""))} ${escapeHtml(finding.metric?.label ?? "")}<br>
                  ${(finding.evidence_links ?? []).map((link) => `<a href="${sitePath(link.url)}">${escapeHtml(link.label)}</a>`).join(" / ")} / <a href="${sitePath(finding.challenge_url)}">Challenge</a>
                </span>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Next Reviews</h2>
        <p class="section-note">Ways to make the thesis stronger.</p>
      </div>
      <ul>${(report.recommended_next_reviews ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      <p><a href="${sitePath("/gold-records/")}">Open Gold Record V1</a> / <a href="${sitePath("/data/flagship-report.json")}">Open JSON</a></p>
    </section>
  `;
}
```

- [ ] **Step 4: Render gold records page**

Add:

```js
function renderGoldRecords() {
  const root = document.querySelector("#gold-records-root");
  if (!root) return;
  const records = state.goldRecordV1.records ?? [];
  root.innerHTML = `
    <section class="section section--tight">
      <div class="metric-grid metric-grid--dashboard">
        ${metric(String(records.length), "Gold v1 packets")}
        ${metric(escapeHtml(state.goldRecordV1.generated_at ?? ""), "Generated")}
        ${metric(escapeHtml(state.goldRecordV1.review_standard ?? ""), "Review standard")}
      </div>
      <p class="section-copy">${escapeHtml(state.goldRecordV1.public_claim_limit ?? "")}</p>
    </section>
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Review Packets</h2>
        <p class="section-note">Selected records for source-by-source review.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>School</th>
              <th>Category</th>
              <th>Sources</th>
              <th>Review Links</th>
            </tr>
          </thead>
          <tbody>
            ${records
              .map(
                (record) => `
                  <tr>
                    <td class="mono">${escapeHtml(record.event_id)}</td>
                    <td>${escapeHtml(record.school_name)}</td>
                    <td>${escapeHtml(record.category)}</td>
                    <td>${escapeHtml((record.source_types ?? []).join("; "))}</td>
                    <td><a href="${sitePath(record.event_url)}">Record</a> / <a href="${sitePath(record.workspace_url)}">Workspace</a>${record.challenge_url ? ` / <a href="${sitePath(record.challenge_url)}">Challenge</a>` : ""} / <a href="${sitePath(record.correction_url)}">Correction</a></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
    <section class="section section--tight">
      <p><a href="${sitePath("/data/gold-record-v1.json")}">Open gold v1 JSON</a> / <a href="${sitePath("/flagship/")}">Open flagship report</a></p>
    </section>
  `;
}
```

Call both functions from the existing route dispatcher:

```js
renderFlagship();
renderGoldRecords();
```

- [ ] **Step 5: Include static routes in deployment and sitemap**

Add `"flagship"` and `"gold-records"` to `scripts/build-static.mjs` `publicPaths`.

Add `"/flagship/"` and `"/gold-records/"` to `scripts/generate-sitemap.mjs` `staticPaths`.

- [ ] **Step 6: Add render QA cases**

Modify `scripts/qa-render.mjs` route checks:

```js
{
  route: "/flagship/",
  file: "flagship/index.html",
  textChecks: ["The Public Evidence Infrastructure Gap", "Findings", "Gold Record V1"],
  linkChecks: ["/data/flagship-report.json", "/challenge/", "/gold-records/"]
},
{
  route: "/gold-records/",
  file: "gold-records/index.html",
  textChecks: ["Gold Record V1", "Review Packets", "not outside validation"],
  linkChecks: ["/data/gold-record-v1.json", "/flagship/", "/research-workspace/"]
}
```

- [ ] **Step 7: Run render/site checks**

Run:

```sh
npm run flagship:data
npm run pages:data
npm run sitemap:data
npm run qa:site
npm run qa:render
```

Expected: site QA passes and render QA includes the two new pages.

- [ ] **Step 8: Commit public pages**

Run:

```sh
git add flagship gold-records assets/app.js scripts/build-static.mjs scripts/generate-sitemap.mjs scripts/qa-render.mjs scripts/qa-site.mjs sitemap.xml
git commit -m "feat: publish flagship and gold v1 pages"
```

---

### Task 6: Update Public Docs and Navigation Surfaces

**Files:**
- Modify: `README.md`
- Modify: `docs/reviewer-brief.md`
- Modify: `docs/citation.md`
- Modify: `docs/review-workflow.md`
- Modify: `trust/index.html`
- Modify: `downloads/index.html`
- Modify: `journalist-guide/index.html`
- Modify: `research-guide/index.html`

- [ ] **Step 1: Update README foundation list**

Add bullets:

```md
- flagship report artifact tying reviewability findings to data, challenge routes, and use limits
- Gold Record V1 review packets for 25 records selected for high-density source review
```

Add route sentence:

```md
The flagship report is published at `/flagship/`, and the Gold Record V1 review corpus is published at `/gold-records/`.
```

- [ ] **Step 2: Update reviewer brief**

In `docs/reviewer-brief.md`, add a section:

```md
## Gold Record V1 Review Packet

Reviewers who want a bounded task can start with Gold Record V1:

- 25 selected records.
- source, classification, community, confidence, response-depth, challenge, and correction links.
- review questions for public-source checking.
- explicit boundary that packet inclusion is not endorsement or outside validation.

Public route:
https://maximilian-kornstein.github.io/campus-evidence-lab/gold-records/
```

- [ ] **Step 3: Update citation guidance**

In `docs/citation.md`, add:

```md
For the flagship report, cite:

- Campus Evidence Lab, "The Public Evidence Infrastructure Gap"
- report URL
- snapshot ID
- full snapshot hash
- access date

Gold Record V1 packets should be cited as review packets, not validated findings.
```

- [ ] **Step 4: Update trust/download/journalist/research pages**

Add links to `/flagship/` and `/gold-records/` with this exact boundary language:

```html
<p>Flagship and Gold Record V1 artifacts are review aids. They do not rank schools, score safety, estimate prevalence, make legal findings, claim endorsement, or represent external audit.</p>
```

- [ ] **Step 5: Run content QA**

Run:

```sh
npm run qa:content
npm run qa:site
```

Expected: both pass.

- [ ] **Step 6: Commit documentation updates**

Run:

```sh
git add README.md docs/reviewer-brief.md docs/citation.md docs/review-workflow.md trust/index.html downloads/index.html journalist-guide/index.html research-guide/index.html
git commit -m "docs: explain flagship and gold v1 review artifacts"
```

---

### Task 7: Regenerate Release Artifacts and Verify End to End

**Files:**
- Generated: `data/*.json`, `data/*.csv`, generated school/event/source/brief pages, `RELEASE_NOTES.md`, `sitemap.xml`, `rss.xml`, `robots.txt`, `dist/`

- [ ] **Step 1: Run full data preparation**

Run:

```sh
npm run prepare:data
```

Expected: generation completes, including `flagship:data`, release notes, pages, and sitemap.

- [ ] **Step 2: Run full verification**

Run:

```sh
npm run check
```

Expected:

```text
Data validation passed: 4000 events, 947 schools, 25 sources, 0 corrections.
Content QA passed
Data quality QA passed
Integrity check passed: sha256:<hash>
Site QA passed
Accessibility QA passed for 5036 or more HTML pages.
Render QA passed
```

The HTML page count may increase above 5036 because `/flagship/` and `/gold-records/` are added.

- [ ] **Step 3: Run production build**

Run:

```sh
npm run build
```

Expected: source and `dist` site QA, accessibility QA, and render QA all pass.

- [ ] **Step 4: Run direct artifact probes**

Run:

```sh
node - <<'NODE'
import { readFileSync } from 'node:fs';
const report = JSON.parse(readFileSync('data/flagship-report.json', 'utf8'));
const gold = JSON.parse(readFileSync('data/gold-record-v1.json', 'utf8'));
const eventIds = new Set(JSON.parse(readFileSync('data/events.json', 'utf8')).map((event) => event.id));
const bad = [];
if (report.findings.length < 5) bad.push('flagship report has fewer than five findings');
for (const finding of report.findings) {
  if (!finding.evidence_links?.length) bad.push(`finding ${finding.id} lacks evidence links`);
  if (!finding.challenge_url?.startsWith('/challenge/')) bad.push(`finding ${finding.id} lacks challenge route`);
}
if (gold.records.length !== 25) bad.push(`gold v1 has ${gold.records.length} records`);
for (const record of gold.records) {
  if (!eventIds.has(record.event_id)) bad.push(`unknown event ${record.event_id}`);
  if (!record.workspace_url.includes('record_ids=')) bad.push(`bad workspace URL ${record.event_id}`);
  if (!record.correction_url.includes('record_id=')) bad.push(`bad correction URL ${record.event_id}`);
  if (!record.public_claim_limit.includes('not outside validation')) bad.push(`missing validation boundary ${record.event_id}`);
}
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({
  findings: report.findings.length,
  gold_records: gold.records.length,
  snapshot_id: report.snapshot_id
}, null, 2));
NODE
```

Expected JSON:

```json
{
  "findings": 5,
  "gold_records": 25,
  "snapshot_id": "snapshot_2026_06_03_4000_records"
}
```

- [ ] **Step 5: Commit final generated state**

Run:

```sh
git add -A
git commit -m "chore: refresh flagship release artifacts"
```

---

## Self-Review Checklist

- Spec coverage: The plan covers flagship thesis, 25-record gold v1 corpus, challenge/review links, docs, validation, generated pages, hash checks, accessibility/render QA, and build verification.
- Scope control: This plan does not add new event records and does not claim external validation. It creates review artifacts and pages from existing public-source metadata.
- Type consistency: `flagshipReport`, `goldRecordV1`, `flagship-report.json`, and `gold-record-v1.json` names are consistent across library, generator, schemas, validation, app loading, QA, and docs.
- Claim safety: Every public artifact carries a boundary against rankings, safety scoring, severity scoring, prevalence estimates, legal findings, endorsement, and external audit.
