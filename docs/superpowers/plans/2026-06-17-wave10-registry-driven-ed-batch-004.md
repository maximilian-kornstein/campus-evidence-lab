# Wave 10 Registry-Driven ED Batch 004 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make applied ED certification-review waves registry-driven, then add a fourth frozen ED review artifact without weakening certification gates.

**Architecture:** Add a generic ED review generator that reads `ED_CERTIFICATION_REVIEW_SPECS` instead of requiring one bespoke script per batch. Add Batch 004 to the registry and generate its artifact from the current next ED dataset review window. Update generated pages and docs so the public site shows all configured ED review waves with exact counts and strict limits.

**Tech Stack:** Node ESM scripts, JSON artifacts, generated static HTML, `node:test`, existing certification ledger and ED review libraries.

---

### Task 1: Registry Batch 004 Contract

**Files:**
- Modify: `scripts/ed-certification-review-registry.mjs`
- Modify: `scripts/lib.mjs`
- Test: `test/ed-certification-batch-review.test.mjs`

- [ ] **Step 1: Write the failing registry test**

Extend the existing registry test so the expected list includes:

```js
{
  reviewBatchId: "ed_certification_batch_004",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch004Review",
  route: "/ed-certification-batch-004/",
  artifactName: "ed-certification-batch-004-review.json"
}
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: FAIL because Batch 004 is not yet in the registry.

- [ ] **Step 3: Implement registry/path support**

Add the Batch 004 registry spec and `paths.edCertificationBatch004Review`.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: PASS.

### Task 2: Generic ED Review Generator

**Files:**
- Create: `scripts/generate-ed-certification-review.mjs`
- Modify: `scripts/generate-ed-certification-batch-review.mjs`
- Modify: `scripts/generate-ed-certification-batch-002-review.mjs`
- Modify: `scripts/generate-ed-certification-batch-003-review.mjs`
- Create: `scripts/generate-ed-certification-batch-004-review.mjs`
- Test: `test/ed-certification-batch-review.test.mjs`

- [ ] **Step 1: Write the failing generator test**

Add a test that imports `reviewSpecByBatchId` and asserts:

```js
assert.equal(reviewSpecByBatchId("ed_certification_batch_004").dataPathKey, "edCertificationBatch004Review");
assert.throws(() => reviewSpecByBatchId("missing_review_batch"), /Unknown ED certification review batch/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: FAIL because `reviewSpecByBatchId` does not exist.

- [ ] **Step 3: Implement generator helper**

Export `reviewSpecByBatchId(reviewBatchId)` from `scripts/ed-certification-review-registry.mjs`.

Create `scripts/generate-ed-certification-review.mjs` exporting `generateEdCertificationReview(reviewBatchId)` and supporting CLI usage:

```bash
node scripts/generate-ed-certification-review.mjs ed_certification_batch_004
```

The helper must:

- resolve the review spec by `reviewBatchId`;
- read `events`, `certificationBatches`, `edDatasetProvenanceAudit`, existing artifact if present, and `manifest`;
- call `buildEdCertificationBatchReview`;
- validate with `validateEdCertificationBatchReview`;
- write to `paths[spec.dataPathKey]`;
- print exact generated counts.

- [ ] **Step 4: Convert batch-specific scripts**

Replace each batch-specific script with:

```js
import { generateEdCertificationReview } from "./generate-ed-certification-review.mjs";

await generateEdCertificationReview("<review batch id>");
```

- [ ] **Step 5: Verify GREEN**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: PASS.

### Task 3: Registry-Driven Public ED Review Pages

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/build-static.mjs`

- [ ] **Step 1: Replace hardcoded ED review reads**

Read all ED review artifacts with:

```js
const edCertificationReviews = await Promise.all(
  ED_CERTIFICATION_REVIEW_SPECS.map((spec) => readJson(paths[spec.dataPathKey]))
);
```

- [ ] **Step 2: Replace hardcoded ED review page generation**

Generate one page per spec/review pair. Each page must include:

- status counts
- open gate counts
- provenance counts
- reviewed records table
- snapshot
- standard
- review batch id
- source batch id
- records, certified, not certified, blocked
- JSON artifact link
- previous/next ED review links when present
- strict public-use limit

- [ ] **Step 3: Preserve certification-page links**

Certification and certification-batches sidebars must list every ED review spec from the registry, including Batch 004.

- [ ] **Step 4: Keep sitemap/static build registry-driven**

Ensure sitemap and static build continue using `ED_CERTIFICATION_REVIEW_SPECS`.

### Task 4: Batch 004 Artifact, Docs, And Verification

**Files:**
- Create: `schema/ed-certification-batch-004-review.schema.json`
- Create: `docs/ed-certification-batch-004-review.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`
- Modify: `docs/ed-certification-batch-003-review.md`
- Modify: `package.json`
- Generated: `data/ed-certification-batch-004-review.json`, pages, sitemap, hashes

- [ ] **Step 1: Add schema and package script**

Add:

```json
"ed-certification-batch-004-review:data": "node scripts/generate-ed-certification-batch-004-review.mjs"
```

Wire `prepare:data` and `check` so Batch 004 generation runs after Batch 003 and then regenerates `certification:data` and `certification-batches:data`.

- [ ] **Step 2: Generate in dependency order**

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
npm run ed-certification-batch-004-review:data
npm run certification:data
npm run certification-batches:data
```

- [ ] **Step 3: Inspect exact counts**

Run:

```bash
node - <<'NODE'
const fs = require("fs");
const ledger = JSON.parse(fs.readFileSync("data/certification-ledger.json", "utf8"));
const b4 = JSON.parse(fs.readFileSync("data/ed-certification-batch-004-review.json", "utf8"));
console.log(JSON.stringify({ ledger: ledger.totals, batch004: b4.totals, blocked: b4.records.filter((r) => r.certification_status === "blocked").map((r) => ({ event_id: r.event_id, reason: r.blocked_reason })) }, null, 2));
NODE
```

- [ ] **Step 4: Update docs from exact counts**

Document the exact Batch 004 result. Preserve the limits: internal source-to-record review only, no external validation, ranking, prevalence, safety scoring, severity scoring, or legal finding.

- [ ] **Step 5: Regenerate public artifacts**

Run:

```bash
npm run hash:data
npm run pages:data
npm run sitemap:data
```

- [ ] **Step 6: Verify**

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

- [ ] **Step 7: Commit**

Stage Wave 10 files only, leave `docs/outreach-email.md` untouched, and commit with:

```bash
git commit -m "feat: add registry-driven ED review generation"
```
