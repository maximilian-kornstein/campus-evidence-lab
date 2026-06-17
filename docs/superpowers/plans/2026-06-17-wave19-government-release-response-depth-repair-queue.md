# Wave 19 Government Release Response-Depth Repair Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the government-release response-depth audit into a deterministic, inspectable repair queue for the nine flagged records without mutating core event data while unrelated generated files are dirty.

**Architecture:** Build a small queue module that reads the existing audit output plus event rows and emits exact proposed record edits. The queue is not certification and not a claim that the repairs have been applied; it is a source-to-record work order for the next clean application wave.

**Tech Stack:** Node.js ESM scripts, `node:test`, JSON artifacts, existing `scripts/lib.mjs` path helpers.

---

## File Structure

- Create `test/government-release-response-depth-repair-queue.test.mjs`
  - Verifies queue generation from flagged audit rows.
  - Verifies exact proposed `response_depth` and `field_support` operations.
  - Verifies neutral claim-limit language.
- Create `scripts/government-release-response-depth-repair-queue-lib.mjs`
  - Exports `buildGovernmentReleaseResponseDepthRepairQueue({ events, audit })`.
  - Converts flagged audit records into deterministic proposed edit records.
- Create `scripts/generate-government-release-response-depth-repair-queue.mjs`
  - Reads `data/events.json` and `data/government-release-response-depth-audit.json`.
  - Writes `data/government-release-response-depth-repair-queue.json`.
- Modify `scripts/lib.mjs`
  - Add `governmentReleaseResponseDepthRepairQueue` output path.
- Modify `package.json`
  - Add `government-release-response-depth:repair-queue`.
- Create `docs/government-release-response-depth-repair-queue.md`
  - Explain what the queue is, what it is not, and how to apply it strictly later.
- Create `data/government-release-response-depth-repair-queue.json`
  - Generated artifact with nine proposed repairs.

## Task 1: Add Failing Tests

**Files:**
- Create: `test/government-release-response-depth-repair-queue.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildGovernmentReleaseResponseDepthRepairQueue } from "../scripts/government-release-response-depth-repair-queue-lib.mjs";

test("creates exact repair proposals for flagged government-release response-depth records", () => {
  const queue = buildGovernmentReleaseResponseDepthRepairQueue({
    events: [
      {
        id: "evt_direct",
        school_id: "school_one",
        source_ids: ["src_release"],
        response_depth: "direct_institutional_response",
        institutional_response:
          "The source announces an OCR investigation. The current record does not summarize the institution's response beyond the public government action.",
        field_support: [
          {
            field: "Institutional response",
            source_ids: ["src_release"],
            rationale: "Response-depth classification is \"direct_institutional_response\" based on the stored public response text."
          }
        ]
      },
      {
        id: "evt_missing",
        school_id: "school_two",
        source_ids: ["src_release"],
        institutional_response:
          "The record currently summarizes the public federal finding and accreditor notification; it does not evaluate the completed response."
      }
    ],
    audit: {
      records: [
        {
          event_id: "evt_direct",
          issue_id: "government_release_direct_response_overstatement_risk",
          recommended_response_depth: "limited_public_response_note",
          rationale: "The source family is government-release-like and the response text limits the note to public government action."
        },
        {
          event_id: "evt_missing",
          issue_id: "government_release_missing_response_depth",
          recommended_response_depth: "limited_public_response_note",
          rationale: "The record has stored response text but no explicit response-depth classification."
        }
      ]
    }
  });

  assert.equal(queue.proposed_repairs, 2);
  assert.deepEqual(queue.issue_counts, {
    government_release_direct_response_overstatement_risk: 1,
    government_release_missing_response_depth: 1
  });

  const direct = queue.records.find((record) => record.event_id === "evt_direct");
  assert.equal(direct.current_response_depth, "direct_institutional_response");
  assert.equal(direct.proposed_response_depth, "limited_public_response_note");
  assert.equal(direct.operations[0].op, "replace");
  assert.equal(direct.operations[0].path, "/response_depth");
  assert.equal(direct.operations[1].op, "replace");
  assert.equal(direct.operations[1].path, "/field_support/Institutional response");
  assert.match(direct.operations[1].value.rationale, /does not document a direct institutional response/i);

  const missing = queue.records.find((record) => record.event_id === "evt_missing");
  assert.equal(missing.current_response_depth, null);
  assert.equal(missing.operations[0].op, "add");
  assert.equal(missing.operations[0].path, "/response_depth");
});

test("omits unflagged audit rows and marks missing source event rows as blocked", () => {
  const queue = buildGovernmentReleaseResponseDepthRepairQueue({
    events: [],
    audit: {
      records: [
        {
          event_id: "evt_missing_event",
          issue_id: "government_release_missing_response_depth",
          recommended_response_depth: "limited_public_response_note",
          rationale: "No response-depth classification."
        },
        {
          event_id: "evt_clean",
          issue_id: null,
          recommended_response_depth: "limited_public_response_note"
        }
      ]
    }
  });

  assert.equal(queue.proposed_repairs, 0);
  assert.equal(queue.blocked_repairs, 1);
  assert.equal(queue.records[0].status, "blocked_missing_event_row");
  assert.equal(queue.records.some((record) => record.event_id === "evt_clean"), false);
});

test("keeps repair queue language neutral and non-certifying", () => {
  const queue = buildGovernmentReleaseResponseDepthRepairQueue({ events: [], audit: { records: [] } });
  const text = JSON.stringify(queue);

  assert.equal(queue.public_claim_limit.includes("not certification"), true);
  assert.equal(/\b(?:external validation|endorsement|ranking|prevalence|safety score|severity score|legal truth)\b/i.test(text), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/government-release-response-depth-repair-queue.test.mjs`

Expected: FAIL with module not found for `government-release-response-depth-repair-queue-lib.mjs`.

## Task 2: Implement Queue Builder

**Files:**
- Create: `scripts/government-release-response-depth-repair-queue-lib.mjs`

- [ ] **Step 1: Write minimal implementation**

Create the module with:

- `countValues(values)`
- `fieldSupportOperation(event, sourceIds, rationale)`
- `buildOperations(event, proposedResponseDepth, fieldSupportValue)`
- `buildGovernmentReleaseResponseDepthRepairQueue({ events, audit })`

Rules:

- Include only audit records with `issue_id`.
- If the event row is missing, emit `status: "blocked_missing_event_row"` and no operations.
- If `response_depth` exists, operation is `replace`; if missing, operation is `add`.
- If existing `field_support` has `field: "Institutional response"`, operation is `replace`; otherwise `add`.
- `field_support` rationale must state that the linked government-release-like source supports only a limited public response note and does not document a direct institutional response.

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test test/government-release-response-depth-repair-queue.test.mjs`

Expected: PASS.

## Task 3: Add Generator and Package Script

**Files:**
- Create: `scripts/generate-government-release-response-depth-repair-queue.mjs`
- Modify: `scripts/lib.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add path helper**

Add:

```js
governmentReleaseResponseDepthRepairQueue: path.join(dataDir, "government-release-response-depth-repair-queue.json")
```

- [ ] **Step 2: Add generator script**

Read events and audit, call `buildGovernmentReleaseResponseDepthRepairQueue`, write JSON, and print proposed/blocked counts.

- [ ] **Step 3: Add npm script**

Add:

```json
"government-release-response-depth:repair-queue": "node scripts/generate-government-release-response-depth-repair-queue.mjs"
```

- [ ] **Step 4: Generate artifact**

Run: `npm run government-release-response-depth:repair-queue`

Expected: generated JSON with nine proposed repairs and zero blocked repairs.

## Task 4: Document the Queue

**Files:**
- Create: `docs/government-release-response-depth-repair-queue.md`

- [ ] **Step 1: Document strict scope**

Include:

- What the queue catches.
- Why it is not certification.
- Why it does not mutate `data/events.json` in this wave.
- How to apply it later: clean worktree, apply queue, regenerate hashes/pages, run full validation/build.

## Task 5: Verification and Commit

**Files:**
- New and modified scoped Wave 19 files only.

- [ ] **Step 1: Run targeted verification**

Run:

```bash
node --test test/government-release-response-depth-audit.test.mjs test/government-release-response-depth-repair-queue.test.mjs
npm run government-release-response-depth:audit
npm run government-release-response-depth:repair-queue
npm run validate:data
```

Expected: all commands exit 0.

- [ ] **Step 2: Review generated artifact**

Confirm:

- `proposed_repairs` is 9.
- `blocked_repairs` is 0.
- Every record proposes `limited_public_response_note`.

- [ ] **Step 3: Commit only scoped files**

Stage only:

```bash
git add \
  docs/government-release-response-depth-repair-queue.md \
  docs/superpowers/plans/2026-06-17-wave19-government-release-response-depth-repair-queue.md \
  data/government-release-response-depth-repair-queue.json \
  package.json \
  scripts/generate-government-release-response-depth-repair-queue.mjs \
  scripts/government-release-response-depth-repair-queue-lib.mjs \
  scripts/lib.mjs \
  test/government-release-response-depth-repair-queue.test.mjs
```

Commit:

```bash
git commit -m "feat: add government release response-depth repair queue"
```

## Self-Review

- Spec coverage: The plan addresses the flagged government-release response-depth records, creates a deterministic queue, documents claim limits, and avoids unsafe core data mutation in a dirty generated-file worktree.
- Placeholder scan: No TODO/TBD placeholders remain.
- Type consistency: The planned public function and file names are consistent across tests, generator, docs, and package script.
