# Wave 8 ED Batch 002 Certification Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the second frozen ED dataset certification-review wave without weakening the Batch 001 freeze rule or silently mass-certifying later records.

**Architecture:** Generalize the ED batch-review library so review artifacts have explicit review ids, source batch ids, frozen membership, and batch-specific certification bases. Generate `data/ed-certification-batch-002-review.json` from the current highest-priority ED dataset work window, merge reviewed rows from Batch 001 and Batch 002 into the full certification ledger, and expose Batch 002 on public pages with exact certified/not-certified/blocked counts.

**Tech Stack:** Node ESM scripts, `node:test`, JSON artifacts, existing generated static HTML pipeline.

---

### Task 1: Generalize ED Batch Review IDs

**Files:**
- Modify: `scripts/ed-certification-batch-review-lib.mjs`
- Test: `test/ed-certification-batch-review.test.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that call `buildEdCertificationBatchReview` with:

```js
{
  reviewBatchId: "ed_certification_batch_002",
  sourceBatchId: "ed_dataset_batch_001"
}
```

Assert:

- review id is `ed_certification_batch_002_review_v1`;
- every record has `review_batch_id: "ed_certification_batch_002"`;
- certified rows use `ed_certification_batch_002_internal_source_to_record_review`;
- frozen existing review membership is preserved even if `certificationBatches.batches[].records` changes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ed-certification-batch-review`

Expected: FAIL because the current library hardcodes Batch 001 ids and basis.

- [ ] **Step 3: Implement minimal generalization**

Add helper functions for `artifactIdForReviewBatch`, `certificationBasisForReviewBatch`, `reviewNumberLabel`, and source-batch selection. Preserve Batch 001 output compatibility.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ed-certification-batch-review`

Expected: PASS.

### Task 2: Generate Batch 002 Artifact

**Files:**
- Create: `scripts/generate-ed-certification-batch-002-review.mjs`
- Modify: `scripts/lib.mjs`
- Modify: `package.json`
- Create: `schema/ed-certification-batch-002-review.schema.json`

- [ ] **Step 1: Add path and script**

Add `paths.edCertificationBatch002Review` pointing to `data/ed-certification-batch-002-review.json`.

Add package scripts:

```json
"ed-certification-batch-002-review:data": "node scripts/generate-ed-certification-batch-002-review.mjs"
```

- [ ] **Step 2: Generate Batch 002**

The generator reads existing Batch 002 review when present to freeze membership. On first run, it initializes from `sourceBatchId: "ed_dataset_batch_001"` because the moving batch manifest now places the next highest-priority unreviewed ED records there.

- [ ] **Step 3: Run generator**

Run: `npm run ed-certification-batch-002-review:data`

Expected: writes `data/ed-certification-batch-002-review.json` with visible certified/not-certified/blocked counts.

### Task 3: Ledger Consumes Multiple ED Review Artifacts

**Files:**
- Modify: `scripts/generate-certification-ledger.mjs`
- Modify: `scripts/certification-ledger-lib.mjs`
- Test: `test/certification-ledger.test.mjs`

- [ ] **Step 1: Write failing test**

Add a fixture with two ED review artifacts and assert the ledger consumes both records, keeps batch-specific certification bases, and rejects duplicate reviewed event ids.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:certification`

Expected: FAIL because the current generator/library consumes only one ED review artifact.

- [ ] **Step 3: Implement multi-review ingestion**

Accept `edCertificationBatchReviews` as an array or merged object. Merge rows by event id, reject duplicate review rows, and preserve `source_locator`, `not_certified_reason`, `blocked_reason`, and batch-specific gates.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:certification`

Expected: PASS.

### Task 4: Public Pages And Docs

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/build-static.mjs`
- Create: `docs/ed-certification-batch-002-review.md`
- Modify: `docs/ed-certification-batch-001-review.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`

- [ ] **Step 1: Add Batch 002 page**

Generate `/ed-certification-batch-002/` with totals, claim limits, status counts, gate counts, provenance counts, and record-level reasons.

- [ ] **Step 2: Link and copy page**

Add the page to sitemap and static build copy paths. Link it from the certification dashboard and Batch 001 page.

- [ ] **Step 3: Document strict interpretation**

State that Batch 002 is a second frozen internal review wave, not external validation and not all-record manual review.

### Task 5: Regenerate, Verify, Commit

**Files:**
- Generated: `data/ed-certification-batch-002-review.json`
- Generated: `data/certification-ledger.json`
- Generated: `data/certification-batches.json`
- Generated: HTML pages, sitemap, hashes

- [ ] **Step 1: Regenerate in dependency order**

Run:

```bash
npm run ed-certification-batch-review:data
npm run certification:data
npm run certification-batches:data
npm run ed-certification-batch-002-review:data
npm run certification:data
npm run certification-batches:data
npm run hash:data
npm run pages:data
npm run sitemap:data
```

- [ ] **Step 2: Full verification**

Run:

```bash
npm run test:ed-certification-batch-review
npm run test:certification
npm run test:certification-batches
node scripts/hash-dataset.mjs --check
npm run validate:data
npm run qa:site
npm run check
npm run build
```

- [ ] **Step 3: Commit**

Stage Wave 8 files only, leave `docs/outreach-email.md` untouched, and commit with:

```bash
git commit -m "feat: add second ED certification batch review"
```
