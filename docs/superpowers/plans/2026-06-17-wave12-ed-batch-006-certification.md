# Wave 12 ED Batch 006 Certification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth frozen ED Campus Safety dataset certification-review wave while preserving strict source-to-record gates and visible unresolved status.

**Architecture:** Reuse the registry-driven ED review generator. Add Batch 006 as a new registry spec, path, wrapper, schema, docs, package script, generated JSON artifact, generated public page, sitemap entry, and updated certification ledger counts. Do not certify any record unless the existing deterministic ED review gates pass.

**Tech Stack:** Node ESM scripts, JSON artifacts, generated static HTML, `node:test`, existing certification ledger and ED review libraries.

---

### Task 1: Batch 006 Registry Contract

**Files:**
- Modify: `test/ed-certification-batch-review.test.mjs`
- Modify: `scripts/ed-certification-review-registry.mjs`
- Modify: `scripts/lib.mjs`

- [ ] **Step 1: Write the failing registry test**

Extend the registry test expected list with:

```js
{
  reviewBatchId: "ed_certification_batch_006",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch006Review",
  route: "/ed-certification-batch-006/",
  artifactName: "ed-certification-batch-006-review.json"
}
```

Also update the lookup test:

```js
assert.equal(reviewSpecByBatchId("ed_certification_batch_006").dataPathKey, "edCertificationBatch006Review");
assert.throws(() => reviewSpecByBatchId("missing_review_batch"), /Unknown ED certification review batch/);
```

- [ ] **Step 2: Verify RED**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: FAIL because Batch 006 is not yet in `ED_CERTIFICATION_REVIEW_SPECS`.

- [ ] **Step 3: Implement registry and path support**

Update Batch 005 to point forward:

```js
nextRoute: "/ed-certification-batch-006/"
```

Add the Batch 006 registry spec:

```js
{
  reviewBatchId: "ed_certification_batch_006",
  sourceBatchId: "ed_dataset_batch_001",
  dataPathKey: "edCertificationBatch006Review",
  route: "/ed-certification-batch-006/",
  outputDir: "ed-certification-batch-006",
  artifactName: "ed-certification-batch-006-review.json",
  pageTitle: "ED Certification Batch 006 Review",
  pageKicker: "Applied ED Batch 006 review",
  previousRoute: "/ed-certification-batch-005/",
  nextRoute: null
}
```

Add the path in `scripts/lib.mjs`:

```js
edCertificationBatch006Review: path.join(rootDir, "data", "ed-certification-batch-006-review.json"),
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
npm run test:ed-certification-batch-review
```

Expected: PASS.

### Task 2: Batch 006 Generation Contract

**Files:**
- Create: `scripts/generate-ed-certification-batch-006-review.mjs`
- Create: `schema/ed-certification-batch-006-review.schema.json`
- Modify: `package.json`

- [ ] **Step 1: Add the thin generator wrapper**

Create `scripts/generate-ed-certification-batch-006-review.mjs`:

```js
import { generateEdCertificationReview } from "./generate-ed-certification-review.mjs";

await generateEdCertificationReview("ed_certification_batch_006");
```

- [ ] **Step 2: Add the schema**

Create `schema/ed-certification-batch-006-review.schema.json` matching the existing ED review schema shape with these Batch 006 constants:

```json
{
  "$id": "https://campusevidencelab.org/schema/ed-certification-batch-006-review.schema.json",
  "title": "Campus Evidence Lab ED Certification Batch 006 Review",
  "properties": {
    "id": { "const": "ed_certification_batch_006_review_v1" },
    "review_batch_id": { "const": "ed_certification_batch_006" },
    "source_batch_id": { "const": "ed_dataset_batch_001" }
  }
}
```

Keep the same required fields used by Batch 005.

- [ ] **Step 3: Wire package scripts**

Add:

```json
"ed-certification-batch-006-review:data": "node scripts/generate-ed-certification-batch-006-review.mjs"
```

Insert Batch 006 after Batch 005 in both `prepare:data` and each generation half of `check`:

```bash
npm run ed-certification-batch-006-review:data && npm run certification:data && npm run certification-batches:data
```

- [ ] **Step 4: Generate Batch 006 and dependent ledgers**

Run:

```bash
npm run ed-certification-batch-006-review:data
npm run certification:data
npm run certification-batches:data
```

Expected: Batch 006 is generated with exact counts; unresolved records remain blocked or not certified rather than forced through.

### Task 3: Documentation And Public Pages

**Files:**
- Create: `docs/ed-certification-batch-006-review.md`
- Modify: `docs/certification-ledger.md`
- Modify: `docs/certification-batches.md`
- Modify: `docs/ed-certification-batch-005-review.md`
- Generated: `ed-certification-batch-006/index.html`, `sitemap.xml`, certification pages, hashes, release notes

- [ ] **Step 1: Inspect exact Batch 006 counts**

Run:

```bash
node - <<'NODE'
const fs = require("fs");
const ledger = JSON.parse(fs.readFileSync("data/certification-ledger.json", "utf8"));
const b6 = JSON.parse(fs.readFileSync("data/ed-certification-batch-006-review.json", "utf8"));
console.log(JSON.stringify({
  ledger: ledger.totals,
  batch006: b6.totals,
  open_gate_counts: b6.open_gate_counts,
  provenance_status_counts: b6.provenance_status_counts,
  blocked: b6.records.filter((r) => r.certification_status === "blocked").map((r) => ({
    event_id: r.event_id,
    school_id: r.school_id,
    reason: r.blocked_reason,
    open_gates: r.open_gates
  }))
}, null, 2));
NODE
```

- [ ] **Step 2: Document the exact Batch 006 result**

Create `docs/ed-certification-batch-006-review.md` using the exact generated counts and blocked reasons. Include:

- records reviewed
- certified
- not certified
- blocked
- blocked record ids and exact locator ambiguity
- what certification means
- what certification does not mean
- freeze rule and certification basis

- [ ] **Step 3: Update aggregate docs**

Update:

- `docs/certification-ledger.md` to say the first six ED review artifacts are applied and to list exact ledger totals.
- `docs/certification-batches.md` to list the first six ED review artifacts.
- `docs/ed-certification-batch-005-review.md` to point forward to Batch 006.

Preserve the public-use limit: no outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

- [ ] **Step 4: Regenerate public artifacts**

Run:

```bash
npm run hash:data
npm run pages:data
npm run sitemap:data
```

Expected: generated pages include `/ed-certification-batch-006/`, certification sidebars link to Batch 006, and sitemap includes Batch 006.

### Task 4: Verification And Commit

**Files:**
- All changed Wave 12 files except unrelated `docs/outreach-email.md`

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
git commit -m "feat: add sixth ED certification review batch"
```
