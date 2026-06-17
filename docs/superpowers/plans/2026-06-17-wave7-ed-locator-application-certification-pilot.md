# Wave 7 ED Locator Application Certification Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply ED source-cell locators to a bounded certification batch and allow only genuinely gate-complete ED records to receive an explicit batch-review certification basis.

**Architecture:** Create a standalone ED Batch 001 review artifact generated from the current ED provenance audit, event records, review-debt rows, and certification batch manifest. The full certification ledger consumes that artifact as an explicit basis and gate override, so certification cannot happen merely because a locator exists. Public generated pages expose the batch review results, limits, gate counts, and record-level reasons.

**Tech Stack:** Node ESM scripts, `node:test`, JSON artifacts, existing static HTML generation pipeline.

---

### Task 1: ED Batch Review Library

**Files:**
- Create: `scripts/ed-certification-batch-review-lib.mjs`
- Test: `test/ed-certification-batch-review.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  affectedCommunityForCodeTag,
  categoryForCodeTag,
  buildEdCertificationBatchReview,
  validateEdCertificationBatchReview
} from "../scripts/ed-certification-batch-review-lib.mjs";

test("maps ED code tags to bounded site categories and affected labels", () => {
  assert.equal(categoryForCodeTag("intim-rac24"), "Harassment or threat");
  assert.equal(categoryForCodeTag("vandal-rel24"), "Vandalism");
  assert.equal(categoryForCodeTag("lar-t-sex24"), "Other source-backed civil rights event");
  assert.equal(affectedCommunityForCodeTag("rac"), "Race");
  assert.equal(affectedCommunityForCodeTag("gid"), "LGBTQ+");
});

test("buildEdCertificationBatchReview certifies only records with matched source cells and passing gates", () => {
  const events = [
    {
      id: "evt_cert",
      school_id: "school_a",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response: "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    },
    {
      id: "evt_uncertain",
      school_id: "school_b",
      date: "2024-01-01",
      date_precision: "year",
      category: "Harassment or threat",
      affected_communities: ["Race"],
      institutional_response: "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rac24"]
    },
    {
      id: "evt_blocked",
      school_id: "school_c",
      date: "2024-01-01",
      date_precision: "year",
      category: "Vandalism",
      affected_communities: ["Religion"],
      institutional_response: "The record summarizes a Department of Education Clery/campus-safety dataset cell and does not independently evaluate investigative, disciplinary, or institutional response outcomes.",
      source_ids: ["src_ed"],
      tags: ["ed-campus-safety-data", "vandal-rel24"]
    }
  ];
  const certificationBatches = {
    id: "certification_batches_v1",
    snapshot_id: "snapshot_test",
    generated_at: "2026-06-17",
    batches: [
      {
        id: "ed_dataset_batch_001",
        records: events.map((event) => ({ event_id: event.id, school_id: event.school_id }))
      }
    ]
  };
  const edDatasetProvenanceAudit = {
    records: [
      {
        event_id: "evt_cert",
        school_id: "school_a",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 2,
        provenance_status: "matched",
        locator: { workbook: "Oncampushate222324.xlsx", sheet: "sheet1", row: 12, column: "VANDAL_REL24", column_letter: "NU", cell: "NU12", cell_value: "2", locator: "Oncampushate222324.xlsx > sheet1 row 12 > column VANDAL_REL24 > cell NU12" }
      },
      {
        event_id: "evt_uncertain",
        school_id: "school_b",
        code_tag: "vandal-rac24",
        source_year: "2024",
        expected_column: "VANDAL_RAC24",
        expected_count: 1,
        provenance_status: "matched",
        locator: { workbook: "Oncampushate222324.xlsx", sheet: "sheet1", row: 13, column: "VANDAL_RAC24", column_letter: "NT", cell: "NT13", cell_value: "1", locator: "Oncampushate222324.xlsx > sheet1 row 13 > column VANDAL_RAC24 > cell NT13" }
      },
      {
        event_id: "evt_blocked",
        school_id: "school_c",
        code_tag: "vandal-rel24",
        source_year: "2024",
        expected_column: "VANDAL_REL24",
        expected_count: 1,
        provenance_status: "unmatched",
        locator: null,
        unresolved_reason: "Multiple workbook rows matched school_c, VANDAL_REL24, and count 1."
      }
    ]
  };

  const review = buildEdCertificationBatchReview({
    events,
    certificationBatches,
    edDatasetProvenanceAudit,
    manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" }
  });

  assert.equal(review.totals.records, 3);
  assert.equal(review.status_counts.certified, 1);
  assert.equal(review.status_counts.not_certified, 1);
  assert.equal(review.status_counts.blocked, 1);
  assert.equal(review.records.find((record) => record.event_id === "evt_cert").certification_basis, "ed_dataset_batch_001_internal_source_to_record_review");
  assert.match(review.records.find((record) => record.event_id === "evt_uncertain").not_certified_reason, /category/i);
  assert.match(review.records.find((record) => record.event_id === "evt_blocked").blocked_reason, /Multiple workbook rows/);
  assert.deepEqual(validateEdCertificationBatchReview({ review, events, certificationBatches, manifest: { snapshot_id: "snapshot_test", created_at: "2026-06-17" } }), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ed-certification-batch-review.test.mjs`

Expected: FAIL because `scripts/ed-certification-batch-review-lib.mjs` does not exist.

- [ ] **Step 3: Implement library**

Implement deterministic code-tag category and affected-label mapping, per-record gate review, certified/not-certified/blocked status calculation, count summaries, and validator coverage checks.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ed-certification-batch-review.test.mjs`

Expected: PASS with three test records classified as certified, not certified, and blocked.

### Task 2: Generator, Schema, and Pipeline

**Files:**
- Create: `scripts/generate-ed-certification-batch-review.mjs`
- Create: `schema/ed-certification-batch-review.schema.json`
- Modify: `scripts/lib.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add generator path and script**

Add `paths.edCertificationBatchReview` for `data/ed-certification-batch-001-review.json`. Add `ed-certification-batch-review:data` and `test:ed-certification-batch-review` package scripts.

- [ ] **Step 2: Wire the generator before certification ledger generation**

Update `prepare:data` and `check` so ED batch review runs after `certification-batches:data` has produced the batch manifest and before the final certification ledger run that consumes the review artifact.

- [ ] **Step 3: Generate artifact**

Run: `npm run ed-certification-batch-review:data`

Expected: `data/ed-certification-batch-001-review.json` contains one reviewed row for each record in `ed_dataset_batch_001`.

### Task 3: Certification Ledger Consumption

**Files:**
- Modify: `scripts/certification-ledger-lib.mjs`
- Modify: `scripts/generate-certification-ledger.mjs`
- Modify: `test/certification-ledger.test.mjs`

- [ ] **Step 1: Write failing ledger test**

Add a fixture batch review with one certified ED record. Assert the ledger row becomes `certified`, has `ed_dataset_batch_001_internal_source_to_record_review`, includes source locator review detail, and has no open gates. Add a not-certified fixture and assert it stays `not_certified`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:certification`

Expected: FAIL because `buildCertificationLedger` does not consume batch review records.

- [ ] **Step 3: Implement explicit batch-review consumption**

Accept optional `edCertificationBatchReview`, map by `event_id`, override gates only from exact `gate_reviews`, set certification basis only for certified reviewed rows, and force `blocked`/`not_certified` statuses for those reviewed outcomes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:certification`

Expected: PASS.

### Task 4: Public Pages and Docs

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Create: `docs/ed-certification-batch-001-review.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`
- Modify: `docs/full-database-certification-rulebook.md`
- Modify: `docs/source-family-review-playbooks.md`

- [ ] **Step 1: Add public page data**

Read the ED batch review artifact in `generate-pages.mjs` and generate `/ed-certification-batch-001/` with totals, claim limits, status counts, gate counts, and record rows.

- [ ] **Step 2: Update docs with strict limits**

Document that source-cell locators are necessary but not sufficient, Batch 001 is internal review, and certification means all deterministic gates passed under `certification_rules_v1`.

### Task 5: Regeneration, QA, and Commit

**Files:**
- Generated: `data/ed-certification-batch-001-review.json`
- Generated: `data/certification-ledger.json`
- Generated: `data/certification-batches.json`
- Generated: static HTML pages and hash artifacts

- [ ] **Step 1: Regenerate data in dependency order**

Run: `npm run ed-certification-batch-review:data && npm run certification:data && npm run certification-batches:data && npm run hash:data && npm run pages:data`

- [ ] **Step 2: Full verification**

Run: `npm run test:ed-certification-batch-review && npm run test:certification && npm run test:certification-batches && node scripts/hash-dataset.mjs --check && npm run validate:data && npm run qa:site && npm run check && npm run build`

- [ ] **Step 3: Inspect and commit**

Run: `git status --short`, stage Wave 7 files only, and commit with `feat: add ED batch certification review`.
