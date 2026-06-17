# Wave 16 ED Batches 013-016 Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add thirteenth through sixteenth frozen ED Campus Safety dataset certification-review waves to sharply reduce the remaining ED dataset review debt without weakening certification gates.

**Architecture:** Reuse the registry-driven ED review generator. Add Batch 013, Batch 014, Batch 015, and Batch 016 as sequential registry specs, paths, wrappers, schemas, docs, package scripts, generated JSON artifacts, generated public pages, sitemap entries, and updated certification ledger counts. Generate each batch in dependency order, refreshing certification ledgers and batches between runs so every later wave selects from the next unresolved ED dataset window.

**Tech Stack:** Node ESM scripts, JSON artifacts, generated static HTML, `node:test`, existing certification ledger and ED review libraries.

---

### Task 1: Registry Contract

**Files:**
- Modify: `test/ed-certification-batch-review.test.mjs`
- Modify: `scripts/ed-certification-review-registry.mjs`
- Modify: `scripts/lib.mjs`

- [ ] **Step 1: Write the failing registry test**

Extend the registry expected list with:

```js
{
  reviewBatchId: "ed_certification_batch_013",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch013Review",
  route: "/ed-certification-batch-013/",
  artifactName: "ed-certification-batch-013-review.json"
},
{
  reviewBatchId: "ed_certification_batch_014",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch014Review",
  route: "/ed-certification-batch-014/",
  artifactName: "ed-certification-batch-014-review.json"
},
{
  reviewBatchId: "ed_certification_batch_015",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch015Review",
  route: "/ed-certification-batch-015/",
  artifactName: "ed-certification-batch-015-review.json"
},
{
  reviewBatchId: "ed_certification_batch_016",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch016Review",
  route: "/ed-certification-batch-016/",
  artifactName: "ed-certification-batch-016-review.json"
}
```

Update lookup coverage:

```js
assert.equal(reviewSpecByBatchId("ed_certification_batch_016").dataPathKey, "edCertificationBatch016Review");
assert.throws(() => reviewSpecByBatchId("missing_review_batch"), /Unknown ED certification review batch/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: FAIL because Batch 013-016 are not yet in `ED_CERTIFICATION_REVIEW_SPECS`.

- [ ] **Step 3: Implement registry and path support**

Update Batch 012 to point to `/ed-certification-batch-013/`. Add Batch 013-016 specs with these previous/next routes:

```js
{ reviewBatchId: "ed_certification_batch_013", dataPathKey: "edCertificationBatch013Review", route: "/ed-certification-batch-013/", outputDir: "ed-certification-batch-013", artifactName: "ed-certification-batch-013-review.json", pageTitle: "ED Certification Batch 013 Review", pageKicker: "Applied ED Batch 013 review", previousRoute: "/ed-certification-batch-012/", nextRoute: "/ed-certification-batch-014/" }
{ reviewBatchId: "ed_certification_batch_014", dataPathKey: "edCertificationBatch014Review", route: "/ed-certification-batch-014/", outputDir: "ed-certification-batch-014", artifactName: "ed-certification-batch-014-review.json", pageTitle: "ED Certification Batch 014 Review", pageKicker: "Applied ED Batch 014 review", previousRoute: "/ed-certification-batch-013/", nextRoute: "/ed-certification-batch-015/" }
{ reviewBatchId: "ed_certification_batch_015", dataPathKey: "edCertificationBatch015Review", route: "/ed-certification-batch-015/", outputDir: "ed-certification-batch-015", artifactName: "ed-certification-batch-015-review.json", pageTitle: "ED Certification Batch 015 Review", pageKicker: "Applied ED Batch 015 review", previousRoute: "/ed-certification-batch-014/", nextRoute: "/ed-certification-batch-016/" }
{ reviewBatchId: "ed_certification_batch_016", dataPathKey: "edCertificationBatch016Review", route: "/ed-certification-batch-016/", outputDir: "ed-certification-batch-016", artifactName: "ed-certification-batch-016-review.json", pageTitle: "ED Certification Batch 016 Review", pageKicker: "Applied ED Batch 016 review", previousRoute: "/ed-certification-batch-015/", nextRoute: null }
```

Every added spec also uses `sourceBatchId: "ed_dataset_batch_001"`.

Add paths:

```js
edCertificationBatch013Review: path.join(rootDir, "data", "ed-certification-batch-013-review.json"),
edCertificationBatch014Review: path.join(rootDir, "data", "ed-certification-batch-014-review.json"),
edCertificationBatch015Review: path.join(rootDir, "data", "ed-certification-batch-015-review.json"),
edCertificationBatch016Review: path.join(rootDir, "data", "ed-certification-batch-016-review.json"),
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: PASS.

### Task 2: Generation Contract

**Files:**
- Create: `scripts/generate-ed-certification-batch-013-review.mjs`
- Create: `scripts/generate-ed-certification-batch-014-review.mjs`
- Create: `scripts/generate-ed-certification-batch-015-review.mjs`
- Create: `scripts/generate-ed-certification-batch-016-review.mjs`
- Create: `schema/ed-certification-batch-013-review.schema.json`
- Create: `schema/ed-certification-batch-014-review.schema.json`
- Create: `schema/ed-certification-batch-015-review.schema.json`
- Create: `schema/ed-certification-batch-016-review.schema.json`
- Modify: `package.json`

- [ ] **Step 1: Add generator wrappers**

Each wrapper imports `generateEdCertificationReview` from `./generate-ed-certification-review.mjs` and calls it with the matching batch id:

```js
await generateEdCertificationReview("ed_certification_batch_013");
await generateEdCertificationReview("ed_certification_batch_014");
await generateEdCertificationReview("ed_certification_batch_015");
await generateEdCertificationReview("ed_certification_batch_016");
```

- [ ] **Step 2: Add schemas**

Create four schemas matching the Batch 012 schema shape. Constants must be:

```json
{ "id": { "const": "ed_certification_batch_013_review_v1" }, "review_batch_id": { "const": "ed_certification_batch_013" } }
{ "id": { "const": "ed_certification_batch_014_review_v1" }, "review_batch_id": { "const": "ed_certification_batch_014" } }
{ "id": { "const": "ed_certification_batch_015_review_v1" }, "review_batch_id": { "const": "ed_certification_batch_015" } }
{ "id": { "const": "ed_certification_batch_016_review_v1" }, "review_batch_id": { "const": "ed_certification_batch_016" } }
```

Each schema keeps `source_batch_id` const `ed_dataset_batch_001`.

- [ ] **Step 3: Wire package scripts**

Add scripts `ed-certification-batch-013-review:data` through `ed-certification-batch-016-review:data`. Insert this sequence after Batch 012 in `prepare:data` and both generation halves of `check`:

```bash
npm run ed-certification-batch-013-review:data && npm run certification:data && npm run certification-batches:data && npm run ed-certification-batch-014-review:data && npm run certification:data && npm run certification-batches:data && npm run ed-certification-batch-015-review:data && npm run certification:data && npm run certification-batches:data && npm run ed-certification-batch-016-review:data && npm run certification:data && npm run certification-batches:data
```

- [ ] **Step 4: Generate in order**

Run Batch 013, refresh ledgers, Batch 014, refresh ledgers, Batch 015, refresh ledgers, Batch 016, refresh ledgers. Do not certify ambiguous source rows.

### Task 3: Documentation And Public Pages

**Files:**
- Create docs for Batch 013-016.
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`
- Modify: `docs/ed-certification-batch-012-review.md`
- Generated: batch pages, certification pages, hashes, release notes, sitemap

- [ ] **Step 1: Inspect exact counts**

Run:

```bash
node - <<'NODE'
const fs = require("fs");
const ledger = JSON.parse(fs.readFileSync("data/certification-ledger.json", "utf8"));
for (const id of ["013", "014", "015", "016"]) {
  const review = JSON.parse(fs.readFileSync(`data/ed-certification-batch-${id}-review.json`, "utf8"));
  console.log(JSON.stringify({
    id,
    ledger: ledger.totals,
    totals: review.totals,
    open_gate_counts: review.open_gate_counts,
    provenance_status_counts: review.provenance_status_counts,
    blocked: review.records.filter((r) => r.certification_status === "blocked").map((r) => ({
      event_id: r.event_id,
      school_id: r.school_id,
      reason: r.blocked_reason,
      open_gates: r.open_gates
    }))
  }, null, 2));
}
NODE
```

- [ ] **Step 2: Document exact results**

For each batch doc, include records reviewed, certified, not certified, blocked, blocked record ids and exact locator ambiguity, what certification means, what certification does not mean, and the freeze rule with certification basis.

- [ ] **Step 3: Update aggregate docs**

Update `docs/certification-ledger.md` to report exact totals after Batch 016, `docs/certification-batches.md` to list the first sixteen applied ED reviews, and `docs/ed-certification-batch-012-review.md` to point forward to Batch 013.

- [ ] **Step 4: Regenerate public artifacts**

Run:

```bash
npm run hash:data
npm run pages:data
npm run sitemap:data
```

Expected: generated pages and sitemap include `/ed-certification-batch-013/` through `/ed-certification-batch-016/`.

### Task 4: Verification And Commit

**Files:**
- All changed Wave 16 files except unrelated `docs/outreach-email.md`

- [ ] **Step 1: Run targeted verification**

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
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run check
npm run build
```

- [ ] **Step 3: Stage scoped files only**

Run:

```bash
git status --porcelain | awk '{print substr($0,4)}' | grep -v '^docs/outreach-email\.md$' | xargs git add --
git diff --cached --check
```

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "feat: add thirteenth through sixteenth ED certification review batches"
```
