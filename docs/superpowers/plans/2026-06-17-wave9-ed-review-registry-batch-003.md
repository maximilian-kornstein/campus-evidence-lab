# Wave 9 ED Review Registry And Batch 003 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third frozen ED dataset certification-review wave and introduce a small registry so future ED review waves are wired consistently without weakening certification gates.

**Architecture:** Move applied ED review artifact metadata into a registry consumed by the ledger generator, data validator, page generator, sitemap generator, and static build. Add `data/ed-certification-batch-003-review.json` as a named frozen artifact initialized from the next current ED dataset batch window. Each reviewed record still receives `certified`, `not_certified`, or `blocked`; no record is certified unless every source-to-record gate passes.

**Tech Stack:** Node ESM scripts, JSON artifacts, generated static HTML, `node:test`, existing certification and ED batch review libraries.

---

### Task 1: ED Review Registry

**Files:**
- Create: `scripts/ed-certification-review-registry.mjs`
- Modify: `scripts/lib.mjs`
- Test: `test/ed-certification-batch-review.test.mjs`

- [ ] **Step 1: Write the failing registry test**

Add a test that imports the registry and asserts it contains three ordered review specs:

```js
test("ED certification review registry lists applied review artifacts in order", () => {
  assert.deepEqual(
    ED_CERTIFICATION_REVIEW_SPECS.map((spec) => ({
      reviewBatchId: spec.reviewBatchId,
      sourceBatchId: spec.sourceBatchId,
      dataPathKey: spec.dataPathKey,
      route: spec.route,
      artifactName: spec.artifactName
    })),
    [
      {
        reviewBatchId: "ed_dataset_batch_001",
        sourceBatchId: "ed_dataset_batch_001",
        dataPathKey: "edCertificationBatchReview",
        route: "/ed-certification-batch-001/",
        artifactName: "ed-certification-batch-001-review.json"
      },
      {
        reviewBatchId: "ed_certification_batch_002",
        sourceBatchId: "ed_dataset_batch_001",
        dataPathKey: "edCertificationBatch002Review",
        route: "/ed-certification-batch-002/",
        artifactName: "ed-certification-batch-002-review.json"
      },
      {
        reviewBatchId: "ed_certification_batch_003",
        sourceBatchId: "ed_dataset_batch_001",
        dataPathKey: "edCertificationBatch003Review",
        route: "/ed-certification-batch-003/",
        artifactName: "ed-certification-batch-003-review.json"
      }
    ]
  );
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:ed-certification-batch-review`

Expected: FAIL because `scripts/ed-certification-review-registry.mjs` and `paths.edCertificationBatch003Review` do not exist.

- [ ] **Step 3: Implement minimal registry**

Create `scripts/ed-certification-review-registry.mjs` exporting `ED_CERTIFICATION_REVIEW_SPECS`. Add `paths.edCertificationBatch003Review` to `scripts/lib.mjs`.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test:ed-certification-batch-review`

Expected: PASS.

### Task 2: Batch 003 Artifact

**Files:**
- Create: `scripts/generate-ed-certification-batch-003-review.mjs`
- Create: `schema/ed-certification-batch-003-review.schema.json`
- Modify: `package.json`

- [ ] **Step 1: Add generator and schema**

Add a generator that uses:

```js
const reviewBatchId = "ed_certification_batch_003";
const sourceBatchId = "ed_dataset_batch_001";
```

It must read an existing Batch 003 artifact when present to freeze membership. On first run, it initializes from the current `ed_dataset_batch_001` window.

- [ ] **Step 2: Add package script**

Add:

```json
"ed-certification-batch-003-review:data": "node scripts/generate-ed-certification-batch-003-review.mjs"
```

Wire `prepare:data` and `check` so Batch 003 generation runs after Batch 002, followed by `certification:data` and `certification-batches:data`.

- [ ] **Step 3: Generate Batch 003**

Run:

```bash
npm run ed-certification-batch-003-review:data
```

Expected: writes `data/ed-certification-batch-003-review.json` with exact status counts.

### Task 3: Registry-Driven Ledger And Validation

**Files:**
- Modify: `scripts/generate-certification-ledger.mjs`
- Modify: `scripts/validate-data.mjs`
- Test: `test/certification-ledger.test.mjs`

- [ ] **Step 1: Write the failing ingestion test**

Extend the multiple-artifact certification test to include a third review artifact with review batch `ed_certification_batch_003`; assert the ledger consumes it and keeps the batch-specific certification basis.

- [ ] **Step 2: Verify RED**

Run: `npm run test:certification`

Expected: FAIL before the fixture and implementation agree on third-artifact behavior.

- [ ] **Step 3: Implement registry-driven reads**

Use `ED_CERTIFICATION_REVIEW_SPECS` in `generate-certification-ledger.mjs` to read all configured ED review artifacts into `edCertificationBatchReviews`.

Use the same registry in `validate-data.mjs` so every configured artifact is validated with its own `reviewBatchId` and `sourceBatchId`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test:certification
npm run validate:data
```

Expected: PASS after artifacts exist.

### Task 4: Public Pages, Sitemap, Static Build, And Docs

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/build-static.mjs`
- Create: `docs/ed-certification-batch-003-review.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`

- [ ] **Step 1: Generate registry-driven ED review pages**

Read all configured ED review artifacts and generate one page per registry spec. Each page must show totals, status counts, open gates, provenance counts, artifact link, source batch id, and strict public-use limits.

- [ ] **Step 2: Add public route coverage**

Add `/ed-certification-batch-003/` to sitemap and static build output. Link Batch 003 from certification and certification-batches pages.

- [ ] **Step 3: Update docs with exact counts**

Document Batch 003 only after generation. State exact counts and preserve strict limitations.

### Task 5: Regenerate, Verify, Commit

**Files:**
- Generated: `data/ed-certification-batch-003-review.json`
- Generated: `data/certification-ledger.json`
- Generated: `data/certification-batches.json`
- Generated: HTML pages, sitemap, hashes, snapshot manifests

- [ ] **Step 1: Regenerate in dependency order**

Run:

```bash
npm run ed-certification-batch-review:data
npm run certification:data
npm run certification-batches:data
npm run ed-certification-batch-002-review:data
npm run certification:data
npm run certification-batches:data
npm run ed-certification-batch-003-review:data
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
npm run qa:accessibility
npm run qa:render
npm run check
npm run build
```

- [ ] **Step 3: Commit**

Stage Wave 9 files only, leave `docs/outreach-email.md` untouched, and commit with:

```bash
git commit -m "feat: add ED certification review registry"
```
