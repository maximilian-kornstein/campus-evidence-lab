# Wave 5 Full-Database Certification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build strict full-database certification infrastructure without claiming that all records have been manually certified.

**Architecture:** Add an additive certification layer generated from existing events, sources, source audit data, record-quality audit rows, review-debt rows, Gold v1 status, and public review artifacts. The layer produces one certification row per record, explicit gate statuses, source-family playbooks, a bounded Batch 001 pilot, and public/internal pages that show certified, not-certified, blocked, and awaiting-review states without overstating certainty.

**Tech Stack:** Node.js ESM scripts, `node:test`, JSON artifacts, JSON Schema, static HTML generation, existing data validation/hash/build pipeline.

---

### Task 1: Certification Rulebook And Source-Family Playbooks

**Files:**
- Create: `docs/full-database-certification-rulebook.md`
- Create: `docs/source-family-review-playbooks.md`

- [ ] **Step 1: Define certification statuses**

Write a rulebook that defines `certified`, `not_certified`, `blocked`, and `awaiting_review`, plus the rule that no record can be certified unless every gate is `pass`.

- [ ] **Step 2: Define source-family standards**

Write playbooks for ED datasets, ASRs, OCR/aggregated releases, university statements, news/public notices, and government case/guidance records. Each playbook must specify allowed locators, response-depth handling, and reasons a record remains unresolved.

### Task 2: Certification Ledger Tests

**Files:**
- Create: `test/certification-ledger.test.mjs`

- [ ] **Step 1: Write failing coverage test**

Test that `buildCertificationLedger` creates one certification row per event and refuses to certify rows with any non-passing gate.

- [ ] **Step 2: Write failing Batch 001 test**

Test that Batch 001 is bounded, uses ED dataset records first, and leaves records awaiting review when workbook/cell provenance is absent.

- [ ] **Step 3: Run tests and confirm failure**

Run: `node --test test/certification-ledger.test.mjs`

Expected: fail because the certification module does not exist yet.

### Task 3: Certification Ledger Implementation

**Files:**
- Create: `scripts/certification-ledger-lib.mjs`
- Create: `scripts/generate-certification-ledger.mjs`
- Modify: `scripts/lib.mjs`
- Create: `schema/certification-ledger.schema.json`
- Generate: `data/certification-ledger.json`

- [ ] **Step 1: Implement gate evaluation**

Implement deterministic gate statuses for source availability, source locator specificity, institution support, date precision support, category fit, affected-label boundary, response-depth classification, rationale specificity, and overclaim risk.

- [ ] **Step 2: Implement conservative certification status**

Set `certified` only when every gate is `pass`. Set `blocked` when source availability or source locator gates have blocker-level failures. Set `not_certified` for Gold v1 records already determined not certified. Set all remaining unresolved rows to `awaiting_review`.

- [ ] **Step 3: Implement Batch 001 pilot**

Build Batch 001 from the highest-leverage ED dataset records. Do not certify records without source-cell provenance. Include exact open gates and next action.

- [ ] **Step 4: Validate prohibited claims**

Reject generated text containing endorsement, ranking, prevalence, safety scoring, severity scoring, external validation, or legal-truth claims.

### Task 4: Pipeline And Public Views

**Files:**
- Modify: `package.json`
- Modify: `scripts/validate-data.mjs`
- Modify: `scripts/hash-dataset.mjs`
- Modify: `scripts/generate-release-notes.mjs`
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/build-static.mjs`
- Modify: `scripts/qa-site.mjs`
- Create: `certification/index.html`
- Create: `certification/batch-001/index.html`

- [ ] **Step 1: Wire data generation into npm scripts**

Add `certification:data` and include it in `prepare:data`, `check`, and downstream generation order before validation, hashes, release notes, pages, and sitemap.

- [ ] **Step 2: Add validation and hashes**

Validate ledger coverage, schema shape, batch bounds, and overclaim language. Hash the new artifact.

- [ ] **Step 3: Generate public/internal views**

Add a certification overview page and Batch 001 page that state limits clearly and link to the JSON artifact.

### Task 5: Verification

**Files:**
- Generated artifacts and pages

- [ ] **Step 1: Run focused tests**

Run: `node --test test/certification-ledger.test.mjs`

- [ ] **Step 2: Run full check**

Run: `npm run check`

- [ ] **Step 3: Run full build**

Run: `npm run build`

- [ ] **Step 4: Report exact status**

Report what changed, certification totals, Batch 001 status, unresolved gates, and the next safest batch.
