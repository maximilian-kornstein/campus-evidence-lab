# 10k Official Source Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 10,000 additional accepted import-wave QA candidates from defensible official postsecondary accountability sources.

**Architecture:** Use source-specific discovery artifacts first, then candidate exporters, then the existing import-wave QA runner. OCR resolution rows are first because they are official, postsecondary-filterable, and document-linked; ED Campus Safety aggregate cells are the backup scale source because they are official structured public data with strong locators and no private-person fields.

**Tech Stack:** Node.js ESM scripts, built-in `node:test`, local Chrome DevTools Protocol scraper, ED/OCR public web pages, existing import-wave QA engine.

---

### Source Checkpoint Order

1. OCR Recent Resolution Search, Post Secondary facet: official OCR resolution documents, expected source rows about `1,744`.
2. OCR open-investigation mapping backlog: already discovered postsecondary rows, expected additional possible rows up to `1,764` if institution identity can be resolved cleanly.
3. ED Campus Safety aggregate VAWA/crime/unfounded rows: official structured aggregate source with enough volume to carry the goal to `10,000` accepted candidates while preserving source locators and public claim limits.

### Task 1: OCR Resolution Search Parser

**Files:**
- Create: `scripts/ocr-resolution-search-lib.mjs`
- Create: `test/ocr-resolution-search.test.mjs`
- Modify: `package.json`

- [ ] Write parser tests for OCR result rows, URL generation, and neutral candidate wording.
- [ ] Run `node --test test/ocr-resolution-search.test.mjs` and confirm the test fails before implementation.
- [ ] Implement `scripts/ocr-resolution-search-lib.mjs` with deterministic parsing, source locators, ISO dates, candidate IDs, and non-finding claim limits.
- [ ] Run `node --test test/ocr-resolution-search.test.mjs` and confirm the test passes.

### Task 2: OCR Resolution Discovery

**Files:**
- Create: `scripts/discover-ocr-resolution-search.mjs`
- Modify: `package.json`

- [ ] Use the existing Chrome DevTools client to load `https://ocrcas.ed.gov/ocr-search?f%5B0%5D=it%3APost%20Secondary&page=N`.
- [ ] Extract `.views-row` entries with visible text and document links.
- [ ] Stop after the page count covers the displayed `1744` result total.
- [ ] Write `data/ocr-resolution-search-discovery.json` with pages, rows, counts by state/year, command, source URL, and raw source hash.

### Task 3: OCR Resolution Manifest And Candidate Export

**Files:**
- Modify: `data/import-manifests.json`
- Modify: `scripts/import-manifest-lib.mjs`
- Create: `scripts/export-ocr-resolution-wave-candidates.mjs`
- Modify: `test/import-manifest.test.mjs`
- Modify: `test/ocr-resolution-search.test.mjs`

- [ ] Add failing tests that classify OCR resolution rows as `ocr_resolution_document` and export candidates only for known schools.
- [ ] Add a bulk-eligible `ocr_resolution_document` manifest with explicit non-finding claim limits.
- [ ] Export candidates from the discovery artifact and preserve unmapped schools in `data/import-quarantine/<wave-id>-mapping.json`.
- [ ] Run manifest and OCR resolution tests until passing.

### Task 4: OCR Resolution Waves

**Files:**
- Create: `data/import-candidates/ocr-resolution-search-wave-*.json`
- Create: `data/import-quarantine/ocr-resolution-search-wave-*.json`
- Create: `data/import-waves/ocr-resolution-search-wave-*.json`

- [ ] Run OCR resolution candidate exports in `500`-row chunks.
- [ ] Run `scripts/import-wave-runner.mjs` for each candidate artifact.
- [ ] Preserve counts for discovered, accepted, duplicated, and mapping-quarantined rows.

### Task 5: ED Campus Safety Aggregate Backup Source

**Files:**
- Create: `scripts/ed-campus-safety-aggregate-lib.mjs`
- Create: `test/ed-campus-safety-aggregate.test.mjs`
- Create: `scripts/export-ed-campus-safety-aggregate-wave-candidates.mjs`

- [ ] Write failing tests for aggregate ED workbook rows with positive counts, no private fields, source locators, and neutral wording.
- [ ] Convert official `.xls` files to CSV with the bundled `soffice` runtime when needed.
- [ ] Emit candidates for VAWA, Clery crime, and unfounded aggregate statistics only after OCR resolution waves are exhausted.
- [ ] Keep arrest/discipline and residence-hall fire out of the first backup wave unless needed for the 10k target.

### Task 6: 10k Wave Execution And Verification

- [ ] Run waves until the additional accepted count reaches `10,000` or a verified source-quality blocker recurs across three goal turns.
- [ ] Run `npm run test:import-manifest`, `npm run test:import-wave`, OCR tests, and ED aggregate tests.
- [ ] Run `npm run validate:data`, dataset hash check, site QA, content QA, data-quality QA, accessibility QA, render QA, and `npm run build`.
- [ ] Commit verified artifacts.

### Claim Limits

All new public text must avoid legal conclusions, rankings, safety scores, prevalence claims, severity scores, and statements implying human certification of every row. Accepted candidates must say what the official source records, not what Campus Evidence Lab independently proves.
