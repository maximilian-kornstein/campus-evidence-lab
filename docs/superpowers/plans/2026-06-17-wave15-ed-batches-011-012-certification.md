# Wave 15 ED Batches 011-012 Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add eleventh and twelfth frozen ED Campus Safety dataset certification-review waves while preserving strict source-to-record gates and visible unresolved status.

**Architecture:** Reuse the registry-driven ED review generator. Add Batch 011 and Batch 012 as sequential registry specs, paths, wrappers, schemas, docs, package scripts, generated JSON artifacts, generated public pages, sitemap entries, and updated certification ledger counts. Generate Batch 011 first, regenerate certification ledgers and batches, then generate Batch 012 so the second wave is selected from the next unresolved ED review window.

**Tech Stack:** Node ESM scripts, JSON artifacts, generated static HTML, `node:test`, existing certification ledger and ED review libraries.

---

### Task 1: Batch 011-012 Registry Contract

**Files:**
- Modify: `test/ed-certification-batch-review.test.mjs`
- Modify: `scripts/ed-certification-review-registry.mjs`
- Modify: `scripts/lib.mjs`

- [ ] **Step 1: Write the failing registry test**

Extend the registry test expected list with:

```js
{
  reviewBatchId: "ed_certification_batch_011",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch011Review",
  route: "/ed-certification-batch-011/",
  artifactName: "ed-certification-batch-011-review.json"
},
{
  reviewBatchId: "ed_certification_batch_012",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch012Review",
  route: "/ed-certification-batch-012/",
  artifactName: "ed-certification-batch-012-review.json"
}
```

Update the lookup test:

```js
assert.equal(reviewSpecByBatchId("ed_certification_batch_012").dataPathKey, "edCertificationBatch012Review");
assert.throws(() => reviewSpecByBatchId("missing_review_batch"), /Unknown ED certification review batch/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: FAIL because Batch 011 and Batch 012 are not yet in `ED_CERTIFICATION_REVIEW_SPECS`.

- [ ] **Step 3: Implement registry and path support**

Update Batch 010 to point forward:

```js
nextRoute: "/ed-certification-batch-011/"
```

Add the Batch 011 registry spec:

```js
{
  reviewBatchId: "ed_certification_batch_011",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch011Review",
  route: "/ed-certification-batch-011/",
  outputDir: "ed-certification-batch-011",
  artifactName: "ed-certification-batch-011-review.json",
  pageTitle: "ED Certification Batch 011 Review",
  pageKicker: "Applied ED Batch 011 review",
  previousRoute: "/ed-certification-batch-010/",
  nextRoute: "/ed-certification-batch-012/"
}
```

Add the Batch 012 registry spec:

```js
{
  reviewBatchId: "ed_certification_batch_012",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch012Review",
  route: "/ed-certification-batch-012/",
  outputDir: "ed-certification-batch-012",
  artifactName: "ed-certification-batch-012-review.json",
  pageTitle: "ED Certification Batch 012 Review",
  pageKicker: "Applied ED Batch 012 review",
  previousRoute: "/ed-certification-batch-011/",
  nextRoute: null
}
```

Add paths in `scripts/lib.mjs`:

```js
edCertificationBatch011Review: path.join(rootDir, "data", "ed-certification-batch-011-review.json"),
edCertificationBatch012Review: path.join(rootDir, "data", "ed-certification-batch-012-review.json"),
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: PASS.

### Task 2: Batch 011-012 Generation Contract

**Files:**
- Create: `scripts/generate-ed-certification-batch-011-review.mjs`
- Create: `scripts/generate-ed-certification-batch-012-review.mjs`
- Create: `schema/ed-certification-batch-011-review.schema.json`
- Create: `schema/ed-certification-batch-012-review.schema.json`
- Modify: `package.json`

- [ ] **Step 1: Add thin generator wrappers**

Create `scripts/generate-ed-certification-batch-011-review.mjs`:

```js
import { generateEdCertificationReview } from "./generate-ed-certification-review.mjs";

await generateEdCertificationReview("ed_certification_batch_011");
```

Create `scripts/generate-ed-certification-batch-012-review.mjs`:

```js
import { generateEdCertificationReview } from "./generate-ed-certification-review.mjs";

await generateEdCertificationReview("ed_certification_batch_012");
```

- [ ] **Step 2: Add schemas**

Create Batch 011 and Batch 012 schemas matching the existing ED review schema shape, with these constants:

```json
{
  "$id": "https://campusevidencelab.org/schema/ed-certification-batch-011-review.schema.json",
  "title": "Campus Evidence Lab ED Certification Batch 011 Review",
  "properties": {
    "id": { "const": "ed_certification_batch_011_review_v1" },
    "review_batch_id": { "const": "ed_certification_batch_011" },
    "source_batch_id": { "const": "ed_dataset_batch_001" }
  }
}
```

```json
{
  "$id": "https://campusevidencelab.org/schema/ed-certification-batch-012-review.schema.json",
  "title": "Campus Evidence Lab ED Certification Batch 012 Review",
  "properties": {
    "id": { "const": "ed_certification_batch_012_review_v1" },
    "review_batch_id": { "const": "ed_certification_batch_012" },
    "source_batch_id": { "const": "ed_dataset_batch_001" }
  }
}
```

Keep the same required fields used by Batch 010.

- [ ] **Step 3: Wire package scripts**

Add:

```json
"ed-certification-batch-011-review:data": "node scripts/generate-ed-certification-batch-011-review.mjs",
"ed-certification-batch-012-review:data": "node scripts/generate-ed-certification-batch-012-review.mjs"
```

Insert Batch 011 then Batch 012 after Batch 010 in `prepare:data` and each generation half of `check`:

```bash
npm run ed-certification-batch-011-review:data && npm run certification:data && npm run certification-batches:data && npm run ed-certification-batch-012-review:data && npm run certification:data && npm run certification-batches:data
```

- [ ] **Step 4: Generate Batch 011, then Batch 012 in dependency order**

Run:

```bash
npm run ed-certification-batch-011-review:data
npm run certification:data
npm run certification-batches:data
npm run ed-certification-batch-012-review:data
npm run certification:data
npm run certification-batches:data
```

Expected: both batches are generated with exact counts; unresolved records remain blocked or not certified rather than forced through.

### Task 3: Documentation And Public Pages

**Files:**
- Create: `docs/ed-certification-batch-011-review.md`
- Create: `docs/ed-certification-batch-012-review.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`
- Modify: `docs/ed-certification-batch-010-review.md`
- Generated: `ed-certification-batch-011/index.html`, `ed-certification-batch-012/index.html`, `sitemap.xml`, certification pages, hashes, release notes

- [ ] **Step 1: Inspect exact Batch 011-012 counts**

Run:

```bash
node - <<'NODE'
const fs = require("fs");
const ledger = JSON.parse(fs.readFileSync("data/certification-ledger.json", "utf8"));
for (const id of ["011", "012"]) {
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

- [ ] **Step 2: Document the exact Batch 011 and Batch 012 results**

Create one doc per batch using the exact generated counts and blocked reasons. Each doc must include records reviewed, certified, not certified, blocked, blocked record ids with exact locator ambiguity, what certification means, what certification does not mean, and the freeze rule with certification basis.

- [ ] **Step 3: Update aggregate docs**

Update:

- `docs/certification-ledger.md` to say the first twelve ED review artifacts are applied and to list exact ledger totals.
- `docs/certification-batches.md` to list the first twelve ED review artifacts.
- `docs/ed-certification-batch-010-review.md` to point forward to Batch 011.

Preserve the public-use limit: no outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

- [ ] **Step 4: Regenerate public artifacts**

Run:

```bash
npm run hash:data
npm run pages:data
npm run sitemap:data
```

Expected: generated pages include `/ed-certification-batch-011/` and `/ed-certification-batch-012/`, certification sidebars link to both, and sitemap includes both.

### Task 4: Verification And Commit

**Files:**
- All changed Wave 15 files except unrelated `docs/outreach-email.md`

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

Expected: `docs/outreach-email.md` remains unstaged.

- [ ] **Step 4: Commit**

Run:

```bash
git commit -m "feat: add eleventh and twelfth ED certification review batches"
```
