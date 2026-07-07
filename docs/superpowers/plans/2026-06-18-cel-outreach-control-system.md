# CEL Outreach Control System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable local CEL outreach control system with current-state ingestion, checklist-backed preflight records, duplicate flags, and CSV reports.

**Architecture:** Use SQLite as canonical state and Node.js scripts that call the local `sqlite3` CLI. Keep Gmail connector export/import separate from duplicate analysis so current Gmail state can be refreshed before each campaign. Generate CSV reports from canonical tables for human review.

**Tech Stack:** Node.js ESM, built-in `node:test`, local `/usr/bin/sqlite3`, CSV/JSON files under `outreach/control/`.

---

### Task 1: Schema and Database Initialization

**Files:**

- Create: `outreach/control/schema.sql`
- Create: `scripts/cel-outreach-control/init-db.mjs`
- Test: `test/cel-outreach-control.test.mjs`

Steps:

- [ ] Write a failing test that initializes a temporary database and confirms required tables exist: `organizations`, `contacts`, `gmail_items`, `relationship_events`, `campaigns`, `campaign_targets`, `preflight_runs`, `duplicate_flags`.
- [ ] Run `node --test test/cel-outreach-control.test.mjs` and confirm the test fails because `init-db.mjs` does not exist.
- [ ] Add `schema.sql` with the required tables and indexes.
- [ ] Add `init-db.mjs` to create `outreach/control/cel-outreach.sqlite` by default and accept `--db <path>`.
- [ ] Re-run `node --test test/cel-outreach-control.test.mjs` and confirm the schema test passes.

### Task 2: Relationship Ledger Import

**Files:**

- Create: `scripts/cel-outreach-control/import-relationships.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

Steps:

- [ ] Add a failing test with a temporary relationship-ledger CSV containing Meredith/Hechinger and Masha/ADL rows. Assert organizations, contacts, and relationship events are imported with hard-block statuses.
- [ ] Run `node --test test/cel-outreach-control.test.mjs` and confirm the new test fails because the importer does not exist.
- [ ] Add `import-relationships.mjs` with robust CSV parsing for quoted fields.
- [ ] Re-run the test and confirm it passes.

### Task 3: Gmail State Import

**Files:**

- Create: `scripts/cel-outreach-control/import-gmail-state.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

Steps:

- [ ] Add a failing test using a JSON fixture of Gmail-like items with draft, sent, reply, and future-looking labels. Assert imported rows include `is_cel`, `is_future_or_scheduled`, and normalized domain keys.
- [ ] Run `node --test test/cel-outreach-control.test.mjs` and confirm the new test fails because the importer does not exist.
- [ ] Add `import-gmail-state.mjs` to import connector-shaped JSON and synthetic manual exports.
- [ ] Re-run the test and confirm it passes.

### Task 4: Preflight Recording and Duplicate Guard

**Files:**

- Create: `scripts/cel-outreach-control/run-duplicate-guard.mjs`
- Modify: `test/cel-outreach-control.test.mjs`

Steps:

- [ ] Add a failing test that imports a candidate target, relationship-ledger rows, and Gmail state, then runs the guard. Assert duplicate flags are written for exact sent email, existing draft, future/scheduled conflict, and warm org conflict. Assert a preflight run records the checklist path and SHA-256.
- [ ] Run `node --test test/cel-outreach-control.test.mjs` and confirm the new test fails because the guard does not exist.
- [ ] Add `run-duplicate-guard.mjs` with hard-block and manual-review rules.
- [ ] Re-run the test and confirm it passes.

### Task 5: Report Generation and Operator Docs

**Files:**

- Create: `scripts/cel-outreach-control/export-reports.mjs`
- Create: `outreach/control/README.md`
- Modify: `test/cel-outreach-control.test.mjs`

Steps:

- [ ] Add a failing test that runs report export and asserts CSV files are created with headers and rows for duplicate flags, campaign targets, and Gmail items.
- [ ] Run `node --test test/cel-outreach-control.test.mjs` and confirm the new test fails because the exporter does not exist.
- [ ] Add `export-reports.mjs`.
- [ ] Add `outreach/control/README.md` with the required workflow: sync Gmail, import relationships, run guard, inspect reports, draft only approved targets, re-sync after scheduling.
- [ ] Re-run the test and confirm it passes.

### Task 6: Current-State Ingestion Snapshot

**Files:**

- Create: `outreach/control/imports/current-cel-gmail-state.example.json`
- Create or update: `outreach/control/reports/*.csv`

Steps:

- [ ] Use the Gmail connector to export current CEL-related drafts/sent/replies/future-looking items into the import shape.
- [ ] Run `node scripts/cel-outreach-control/init-db.mjs`.
- [ ] Run `node scripts/cel-outreach-control/import-relationships.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/relationship-ledger.csv`.
- [ ] Run `node scripts/cel-outreach-control/import-gmail-state.mjs --db outreach/control/cel-outreach.sqlite --json outreach/control/imports/current-cel-gmail-state.example.json`.
- [ ] Run `node scripts/cel-outreach-control/run-duplicate-guard.mjs --db outreach/control/cel-outreach.sqlite --checklist outreach/outreach-preflight-checklist.md`.
- [ ] Run `node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports`.
- [ ] Verify reports exist and summarize current draft/sent/future/warm conflicts.

### Task 7: Verification

**Files:**

- Verify: `test/cel-outreach-control.test.mjs`
- Verify: `outreach/control/reports/*.csv`

Steps:

- [ ] Run `node --test test/cel-outreach-control.test.mjs`.
- [ ] Run `sqlite3 outreach/control/cel-outreach.sqlite '.tables'`.
- [ ] Run `find outreach/control/reports -type f -maxdepth 1 -print`.
- [ ] Inspect report headers and row counts.

## Self-Review

Spec coverage:

- Current-state ingestion is covered by Tasks 3 and 6.
- Checklist enforcement is covered by Task 4.
- Duplicate prevention is covered by Task 4.
- Report generation is covered by Task 5.
- Operator workflow is covered by Task 5.

Placeholder scan: no placeholder tasks remain.

Scope check: this plan builds the local control-system foundation. Automated Gmail sync and draft creation are intentionally later phases because this first slice must make canonical state and duplicate prevention reliable.
