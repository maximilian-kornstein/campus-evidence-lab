# Wave 18 Government-Release Response-Depth Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a deterministic audit that identifies government-release records whose response-depth classification may overstate direct institutional response support.

**Architecture:** This wave does not certify additional records and does not edit event records. It adds a focused audit module that compares source family, source type, response-depth value, and stored response text to flag records that should be corrected or explicitly reviewed before any further source-family certification. The output is a JSON artifact and reviewer doc that can drive the next repair/certification wave.

**Tech Stack:** Node.js ESM scripts, JSON artifacts, Node test runner, existing `scripts/lib.mjs` path registry.

---

### Task 1: Add Response-Depth Audit Logic

**Files:**
- Create: `test/government-release-response-depth-audit.test.mjs`
- Create: `scripts/government-release-response-depth-audit-lib.mjs`

- [ ] **Step 1: Write the failing test**

Create a test that supplies a government-release record with `response_depth: "direct_institutional_response"` and stored response text saying the source only announces government action. The expected audit row should flag `government_release_direct_response_overstatement_risk`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/government-release-response-depth-audit.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal audit logic**

Create `buildGovernmentReleaseResponseDepthAudit({ events, sources })` that:

- includes only records whose source family is government-release-like;
- flags direct institutional response labels when linked source types are government releases and stored response text says the record does not summarize institutional response beyond public government action;
- flags missing `response_depth` on government-release-like records with stored institutional-response text;
- preserves neutral wording and does not assert legal truth or source correctness.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/government-release-response-depth-audit.test.mjs`

Expected: PASS.

### Task 2: Generate The Audit Artifact

**Files:**
- Modify: `scripts/lib.mjs`
- Create: `scripts/generate-government-release-response-depth-audit.mjs`
- Create: `data/government-release-response-depth-audit.json`
- Modify: `package.json`

- [ ] **Step 1: Add artifact path and npm script**

Add `governmentReleaseResponseDepthAudit` to `scripts/lib.mjs` and add script:

```json
"government-release-response-depth:audit": "node scripts/generate-government-release-response-depth-audit.mjs"
```

- [ ] **Step 2: Create generator**

Read `data/events.json` and `data/sources.json`, build the audit, write `data/government-release-response-depth-audit.json`, and print flagged row counts.

- [ ] **Step 3: Run generator**

Run: `npm run government-release-response-depth:audit`

Expected: artifact includes exact counts and per-record recommended actions.

### Task 3: Document The Next Repair Boundary

**Files:**
- Create: `docs/government-release-response-depth-audit.md`

- [ ] **Step 1: Add reviewer-facing doc**

Document that this audit is a pre-certification repair queue, not a certification result. It should list the issue types and explain that affected records should not be certified until response-depth classification is repaired or source-supported.

### Task 4: Targeted Verification And Commit

**Files:**
- Scoped files from Tasks 1-3 only.

- [ ] **Step 1: Run targeted verification**

Run:

```bash
node --test test/government-release-response-depth-audit.test.mjs
npm run government-release-response-depth:audit
npm run validate:data
```

- [ ] **Step 2: Stage scoped files only**

Do not stage existing unrelated methodology/dashboard/reviewer-queue/outreach changes.

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "feat: add government release response-depth audit"
```

## Self-Review

Spec coverage: This plan advances full-database certification by isolating a known non-ED blocker before attempting certification.

Placeholder scan: No TBD/TODO placeholders remain.

Type consistency: The artifact and script names consistently use `government-release-response-depth-audit`.
