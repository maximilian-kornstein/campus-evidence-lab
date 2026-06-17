# Wave 17 Non-ED Source-Family Review Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add strict generic source-family certification review artifacts and complete a small non-ED pilot without overstating certainty.

**Architecture:** The existing certification ledger already consumes Gold v1 and ED batch-review bases. This wave adds a parallel generic review-basis input for non-ED source families, preserves the same deterministic gate model, and applies only bounded records with explicit gate reviews. The pilot certifies only records whose artifact supplies passing gates; unsupported or ambiguous records remain awaiting, blocked, or not certified.

**Tech Stack:** Node.js ESM scripts, JSON artifacts, JSON Schema, Node test runner, generated static pages.

---

### Task 1: Add Generic Source-Family Review Basis To The Ledger

**Files:**
- Modify: `test/certification-ledger.test.mjs`
- Modify: `scripts/certification-ledger-lib.mjs`

- [ ] **Step 1: Write the failing test**

Add a test showing that `buildCertificationLedger` accepts `sourceFamilyCertificationReviews`, applies a reviewed non-ED record, preserves source locator details, and rejects duplicate reviewed events:

```js
test("buildCertificationLedger consumes generic source-family review artifacts without ED-only assumptions", () => {
  const sourceFamilyReview = {
    id: "source_family_certification_review_001",
    records: [
      {
        event_id: "evt_gold",
        source_family: "university_statement",
        certification_status: "certified",
        certification_basis: "source_family_review_001_internal_source_to_record_review",
        source_locator: {
          locator_type: "public_statement",
          source_id: "src_statement",
          locator: "Campus response update, published 2025-02-01"
        },
        open_gates: [],
        gate_reviews: Object.fromEntries(
          [
            "source_availability",
            "source_locator_specificity",
            "institution_support",
            "date_precision_support",
            "category_fit",
            "affected_label_boundary",
            "response_depth_classification",
            "rationale_specificity",
            "overclaim_risk"
          ].map((gateId) => [
            gateId,
            {
              status: "pass",
              detail: `${gateId} passed in source-family review.`,
              required_action: "No deterministic action required for this reviewed gate."
            }
          ])
        )
      }
    ]
  };

  const ledger = buildCertificationLedger({
    events,
    sources,
    reviewDebtLedger,
    goldV1CertificationStatus: { records: [] },
    sourceFamilyCertificationReviews: [sourceFamilyReview],
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" },
    batchLimit: 2
  });

  const reviewed = ledger.records.find((record) => record.event_id === "evt_gold");
  assert.equal(reviewed.certification_status, "certified");
  assert.equal(reviewed.certification_basis, "source_family_review_001_internal_source_to_record_review");
  assert.equal(reviewed.batch_review_status, "certified");
  assert.equal(reviewed.source_locator.locator_type, "public_statement");

  assert.throws(
    () =>
      buildCertificationLedger({
        events,
        sources,
        reviewDebtLedger,
        goldV1CertificationStatus: { records: [] },
        sourceFamilyCertificationReviews: [sourceFamilyReview, sourceFamilyReview],
        manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" },
        batchLimit: 2
      }),
    /duplicate source-family review row/
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:certification`

Expected: FAIL because `sourceFamilyCertificationReviews` is ignored and the row is not certified.

- [ ] **Step 3: Implement generic review-basis support**

In `scripts/certification-ledger-lib.mjs`, add source-family review artifact indexing and merge it with ED review rows:

```js
function certificationBasis(goldStatus, batchReview) {
  if (goldStatus?.certification_status === "certified") return "gold_v1_internal_source_to_record_review";
  if (batchReview?.certification_status === "certified") return batchReview.certification_basis ?? null;
  return null;
}
```

```js
function batchReviewsByEventId({ edCertificationBatchReview, edCertificationBatchReviews, sourceFamilyCertificationReviews }) {
  const rowsByEventId = new Map();
  const addArtifact = (artifact, duplicateLabel) => {
    for (const row of artifact.records ?? []) {
      if (rowsByEventId.has(row.event_id)) throw new Error(`duplicate ${duplicateLabel} review row for ${row.event_id}`);
      rowsByEventId.set(row.event_id, row);
    }
  };
  // Add existing ED artifacts and generic source-family artifacts.
  return rowsByEventId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:certification`

Expected: PASS.

### Task 2: Wire A Bounded Non-ED Pilot Artifact

**Files:**
- Create: `data/source-family-certification-review-001.json`
- Create: `schema/source-family-certification-review.schema.json`
- Modify: `scripts/lib.mjs`
- Modify: `scripts/generate-certification-ledger.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add schema and path**

Add `sourceFamilyCertificationReview001` to `scripts/lib.mjs` and add a JSON Schema requiring artifact id, review batch id, public claim limit, status counts, and records with `event_id`, `source_family`, `certification_status`, `certification_basis`, `source_locator`, `gate_reviews`, and `open_gates`.

- [ ] **Step 2: Create the pilot artifact**

Create a bounded artifact over records with only `rationale_specificity` open. Each row must include explicit source-family, source locator, and all nine gate reviews. Use `certified` only where every gate passes.

- [ ] **Step 3: Update ledger generation**

Read the new artifact in `scripts/generate-certification-ledger.mjs` and pass it as `sourceFamilyCertificationReviews`.

- [ ] **Step 4: Run data generation**

Run: `npm run certification:data && npm run certification-batches:data`

Expected: certification counts increase only by the reviewed pilot rows, and no ED blocked rows change.

### Task 3: Public Docs And Page Surfacing

**Files:**
- Create: `docs/source-family-certification-review-001.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`
- Modify: `scripts/generate-pages.mjs`

- [ ] **Step 1: Document the pilot**

Create a short doc explaining that the pilot is internal source-to-record review, not external validation, ranking, prevalence, safety scoring, severity scoring, endorsement, or legal truth.

- [ ] **Step 2: Surface review bases**

Update generated certification pages so non-ED source-family review artifacts appear alongside ED review artifacts, with neutral wording and downloadable data links.

### Task 4: Verification And Commit

**Files:**
- Generated pages and hashes from the normal data pipeline.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
npm run test:certification
npm run test:certification-batches
```

- [ ] **Step 2: Run generation and QA**

Run:

```bash
npm run hash:data
npm run pages:data
npm run sitemap:data
npm run validate:data
npm run qa:site
npm run qa:accessibility
npm run qa:render
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run check
npm run build
```

- [ ] **Step 4: Commit scoped changes**

Stage only Campus Evidence Lab certification files, keep `docs/outreach-email.md` unstaged, run `git diff --cached --check`, then commit:

```bash
git commit -m "feat: add first non-ED source-family certification pilot"
```

## Self-Review

Spec coverage: The plan adds reusable non-ED certification infrastructure, a bounded pilot, public docs/pages, and verification while preserving the no-overclaim rule.

Placeholder scan: No TBD/TODO placeholders remain.

Type consistency: The plan uses `sourceFamilyCertificationReviews` as the new input name and `source_family_certification_review_001` as the artifact id throughout.
