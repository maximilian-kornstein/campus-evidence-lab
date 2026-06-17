# Wave 6 ED Provenance And Batch Manifests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare strict 4,000-record review by freezing certification v1, reconstructing ED dataset source-cell provenance into a separate audit artifact, and creating source-family batch manifests without mass-certifying records.

**Architecture:** Keep the certification ledger as the public status layer. Add a separate ED provenance audit that maps ED dataset records to official workbook/sheet/row/column/cell candidates when official zip packages are supplied, plus a certification batch manifest that divides records into source-family batches with explicit completion rules. Do not mutate event records or certification statuses during this wave.

**Tech Stack:** Node.js ESM scripts, `node:test`, JSON artifacts, existing validation/hash/release/static-page pipeline, official ED zip packages supplied locally or downloaded outside the committed repo.

---

### Task 1: Freeze Certification Rules V1

**Files:**
- Modify: `docs/full-database-certification-rulebook.md`
- Modify: `docs/source-family-review-playbooks.md`
- Create: `docs/certification-batch-completion-rules.md`

- [ ] Add `certification_rules_v1` as the named standard.
- [ ] Document that later standard changes require a new version.
- [ ] Document that the goal is a defensible final state for every record, not certifying all records.
- [ ] Document batch completion rules: every row must be certified, not_certified, blocked, or awaiting_review with exact gates.

### Task 2: ED Dataset Provenance Tests And Library

**Files:**
- Create: `test/ed-dataset-provenance.test.mjs`
- Create: `scripts/ed-dataset-provenance-lib.mjs`
- Create: `scripts/generate-ed-dataset-provenance.mjs`
- Generate: `data/ed-dataset-provenance-audit.json`
- Create: `schema/ed-dataset-provenance-audit.schema.json`

- [ ] Write tests for tag-to-column reconstruction, event count parsing, workbook extraction from descriptions, and row/cell matching.
- [ ] Implement pure matching helpers first.
- [ ] Implement workbook parsing using official `.xlsx` files extracted from ED zip packages.
- [ ] Generate a separate provenance audit artifact. Do not add `source_locators` to events in this wave.

### Task 3: Certification Batch Manifest Tests And Library

**Files:**
- Create: `test/certification-batches.test.mjs`
- Create: `scripts/certification-batches-lib.mjs`
- Create: `scripts/generate-certification-batches.mjs`
- Generate: `data/certification-batches.json`
- Create: `schema/certification-batches.schema.json`

- [ ] Write tests proving records are grouped by source family and bounded batches.
- [ ] Include ED dataset, ASR, OCR/government release, university statement, public notice/news-like, and blocked/problem groups.
- [ ] Include completion rules and exact status counts per batch.

### Task 4: Pipeline And Public Surfaces

**Files:**
- Modify: `scripts/lib.mjs`
- Modify: `scripts/validate-data.mjs`
- Modify: `scripts/hash-dataset.mjs`
- Modify: `scripts/generate-release-notes.mjs`
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/build-static.mjs`
- Modify: `scripts/qa-site.mjs`
- Modify: `package.json`
- Create: `ed-provenance/index.html`
- Create: `certification-batches/index.html`
- Modify: `downloads/index.html`
- Modify: `docs/data-dictionary.md`

- [ ] Add npm scripts for focused tests and artifact generation.
- [ ] Include batch manifests in `check`; keep ED provenance generation manual unless official packages are available.
- [ ] Hash and validate both artifacts.
- [ ] Publish pages that make limits visible.

### Task 5: Verification

**Files:**
- Generated artifacts and pages

- [ ] Run focused tests.
- [ ] Generate ED provenance from official local zip packages.
- [ ] Generate certification batches.
- [ ] Run `npm run validate:data`.
- [ ] Run `npm run check`.
- [ ] Run `npm run build`.
