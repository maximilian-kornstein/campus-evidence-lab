# Accountability Room Site UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Accountability Room as the flagship institution briefing experience, update the site to reflect 150,000 accepted import-wave QA candidates without overclaiming, and add tests/QA that catch bugs in the new surface.

**Architecture:** Keep the site static. Generate a compact institution import-wave summary from existing import-wave artifacts, then use that summary in generated Accountability Room and school pages. Update shared HTML/CSS/JS only where needed so the homepage, generated pages, and QA scripts share the same source-bounded language.

**Tech Stack:** Node.js ESM scripts, static HTML/CSS/vanilla JS, `node:test`, JSDOM QA scripts, existing npm verification pipeline.

---

## File Structure

- Create `scripts/institution-import-wave-summary-lib.mjs`: pure functions for reading wave/candidate artifacts, computing public-safe institution summaries, and validating totals.
- Create `scripts/generate-institution-import-wave-summary.mjs`: CLI wrapper that writes `data/institution-import-wave-summary.json`.
- Modify `scripts/lib.mjs`: add `paths.importCandidatesDir` and `paths.institutionImportWaveSummary`.
- Modify `package.json`: add the summary generator to `pages:data`, and include new tests in `test:import-wave`.
- Create `test/institution-import-wave-summary.test.mjs`: TDD coverage for summary totals, school aggregation, public-safe fields, and validation errors.
- Create `test/accountability-room.test.mjs`: TDD coverage for Accountability Room index, school briefing pages, stale-count removal, and claim limits.
- Modify `scripts/generate-pages.mjs`: generate `/accountability-room/`, add the nav link, read the institution summary, and redesign school pages into briefing-room pages.
- Modify `scripts/build-static.mjs`: copy `accountability-room` into `dist`.
- Modify `index.html`, `about/index.html`, `press/index.html`, `methodology/index.html`: update stale public framing and nav/footer language.
- Modify `assets/app.js`: load the summary artifact and update homepage metrics/actions.
- Modify `assets/styles.css`: add square, document-like briefing-room components and responsive behavior.
- Modify `scripts/qa-content.mjs`, `scripts/qa-render.mjs`, and `scripts/qa-accessibility.mjs`: add checks for Accountability Room claims and rendering.

## Task 1: Institution Import-Wave Summary

**Files:**
- Create: `scripts/institution-import-wave-summary-lib.mjs`
- Create: `scripts/generate-institution-import-wave-summary.mjs`
- Modify: `scripts/lib.mjs`
- Modify: `package.json`
- Test: `test/institution-import-wave-summary.test.mjs`

- [ ] **Step 1: Write the failing summary tests**

Create `test/institution-import-wave-summary.test.mjs` with tests that import `buildInstitutionImportWaveSummary` and assert:

```js
assert.equal(summary.accepted_candidate_count, 150000);
assert.equal(summary.source_family_counts.ed_campus_safety_dataset, 148690);
assert.equal(summary.source_family_counts.ocr_open_investigation, 1310);
assert.equal(summary.record_lane_counts.aggregate_safety_stat, 148690);
assert.equal(summary.record_lane_counts.civil_rights_case, 1310);
assert.equal(summary.schools.brown_university.school_id, "brown_university");
assert.ok(summary.schools.brown_university.accepted_candidate_count > 0);
assert.deepEqual(
  Object.keys(summary.schools.brown_university).sort(),
  [
    "accepted_candidate_count",
    "aggregate_stat_subtype_counts",
    "import_wave_ids",
    "latest_record_year",
    "record_lane_counts",
    "school_id",
    "source_family_counts"
  ]
);
```

Also include a negative test that passes a candidate without `school_id` and expects an error containing `missing school_id`.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test test/institution-import-wave-summary.test.mjs`

Expected: FAIL because `scripts/institution-import-wave-summary-lib.mjs` does not exist.

- [ ] **Step 3: Implement the summary library and CLI**

Implement `buildInstitutionImportWaveSummary({ waves, candidatesByWaveId, generatedAt })` so it:

- iterates publishable wave reports;
- filters candidates to `wave.accepted_candidate_ids`;
- increments total, source-family, record-lane, aggregate-subtype, and school counts;
- preserves sorted `import_wave_ids`;
- stores latest record year from `candidate.date.slice(0, 4)`;
- throws if an accepted candidate lacks `candidate_id`, `school_id`, `source_family`, or `record_lane`;
- returns no raw source URLs, locators, notes, summaries, or hashes inside `schools`.

Implement `loadInstitutionImportWaveSummary()` to read `data/import-waves/*.json` and `data/import-candidates/{wave.id}.json`.

Implement `scripts/generate-institution-import-wave-summary.mjs`:

```js
import { paths, writeJson } from "./lib.mjs";
import { loadInstitutionImportWaveSummary } from "./institution-import-wave-summary-lib.mjs";

const summary = await loadInstitutionImportWaveSummary();
await writeJson(paths.institutionImportWaveSummary, summary);
console.log(`Wrote ${summary.accepted_candidate_count} accepted import-wave candidates for ${summary.institution_count} institutions.`);
```

Add paths in `scripts/lib.mjs`:

```js
importCandidatesDir: path.join(rootDir, "data", "import-candidates"),
institutionImportWaveSummary: path.join(rootDir, "data", "institution-import-wave-summary.json"),
```

Add to `package.json`:

```json
"institution-import-wave-summary:data": "node scripts/generate-institution-import-wave-summary.mjs",
"pages:data": "npm run institution-import-wave-summary:data && node scripts/generate-pages.mjs"
```

Append `test/institution-import-wave-summary.test.mjs` to the existing `test:import-wave` script.

- [ ] **Step 4: Run the test to verify GREEN**

Run: `node --test test/institution-import-wave-summary.test.mjs`

Expected: PASS, with accepted count 150,000.

- [ ] **Step 5: Generate the artifact**

Run: `npm run institution-import-wave-summary:data`

Expected: writes `data/institution-import-wave-summary.json` and reports 150,000 accepted candidates.

## Task 2: Accountability Room Acceptance Tests

**Files:**
- Create: `test/accountability-room.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing page tests**

Create `test/accountability-room.test.mjs` with tests that read generated/static HTML and assert:

```js
const accountabilityIndex = await readFile(path.join(rootDir, "accountability-room", "index.html"), "utf8");
assert.match(accountabilityIndex, /Accountability Room/);
assert.match(accountabilityIndex, /150,000 accepted import-wave QA candidates/);
assert.match(accountabilityIndex, /4,000 public event records/);
assert.match(accountabilityIndex, /No rankings\. No safety scores\. No legal findings\./);
assert.match(accountabilityIndex, /Open an Institution/);

const brown = await readFile(path.join(rootDir, "schools", "brown_university", "index.html"), "utf8");
assert.match(brown, /Brown University Accountability Room/);
assert.match(brown, /What the public record says/);
assert.match(brown, /Institution response/);
assert.match(brown, /Unresolved limits/);
assert.match(brown, /Source packet/);
assert.match(brown, /Correction \/ right of reply/);
assert.match(brown, /accepted official-source QA candidates/);
assert.doesNotMatch(brown, /all import-wave rows are individually human-certified/i);

const home = await readFile(path.join(rootDir, "index.html"), "utf8");
assert.match(home, /150,000 accepted import-wave QA candidates/);
assert.match(home, /4,000 public event records/);
assert.doesNotMatch(home, /947 schools/);
```

Add a CSS test that asserts `assets/styles.css` does not define gradients for `.accountability-room`, `.briefing`, or `.room` selectors and does not set `border-radius` above `8px`.

- [ ] **Step 2: Run the test to verify RED**

Run: `node --test test/accountability-room.test.mjs`

Expected: FAIL because `/accountability-room/` does not exist and school pages have not been redesigned.

- [ ] **Step 3: Add test script coverage**

Append `test/accountability-room.test.mjs` to `test:import-wave` so `npm run test:import-wave` covers the new surface.

## Task 3: Generate Accountability Room Pages

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/build-static.mjs`

- [ ] **Step 1: Add generator wiring**

In `scripts/generate-pages.mjs`:

- read `paths.institutionImportWaveSummary` in the initial `Promise.all`;
- add `const accountabilityRoomDir = path.join(rootDir, "accountability-room");`;
- add `Accountability` link to `nav(depth)` after Dashboard;
- add helper `formatNumber(value)` using `Number(value).toLocaleString("en-US")`;
- add helper `summaryForSchool(schoolId)` returning an empty summary object when absent.

- [ ] **Step 2: Generate `/accountability-room/`**

Create the directory with `await mkdir(accountabilityRoomDir, { recursive: true });` and write `index.html` with:

- H1 `Accountability Room`;
- limitation line `No rankings. No safety scores. No legal findings.`;
- metrics for public event records, accepted import-wave QA candidates, generated institution pages, ED aggregate rows, OCR rows, and source-family mix;
- an `Open an Institution` table of top institutions by event count and accepted QA count;
- action links to Schools, Events, Import Waves, Methodology, Downloads, and Submit.

- [ ] **Step 3: Redesign generated school pages**

Replace the top of each school page with:

- `<h1>${school.name} Accountability Room</h1>`;
- a bounded paragraph distinguishing public event records and accepted official-source QA candidates;
- a `.briefing-grid` showing public event records, accepted official-source QA candidates, source families represented, public response records, review-tier mix, and snapshot hash;
- primary actions for records, source packet, correction/right-of-reply, and source basis.

Reorganize body sections into:

- `What the public record says`;
- `Institution response`;
- `Unresolved limits`;
- `Source packet`;
- `Correction / right of reply`.

- [ ] **Step 4: Copy the new route to dist**

Add `"accountability-room"` to `publicPaths` in `scripts/build-static.mjs`.

- [ ] **Step 5: Run page generation and verify GREEN**

Run: `npm run pages:data`

Then run: `node --test test/accountability-room.test.mjs`

Expected: PASS for generated Accountability Room and school-page tests.

## Task 4: Homepage, Static Copy, And Shared UI

**Files:**
- Modify: `index.html`
- Modify: `about/index.html`
- Modify: `press/index.html`
- Modify: `methodology/index.html`
- Modify: `assets/app.js`
- Modify: `assets/styles.css`

- [ ] **Step 1: Write/update failing QA expectations**

Update `scripts/qa-render.mjs` homepage checks to require:

- `Accountability Room`;
- `150,000 accepted import-wave QA candidates`;
- `4,000 public event records`;
- `No rankings. No safety scores. No legal findings.`

Expected RED before content updates: `npm run qa:render` fails on missing copy.

- [ ] **Step 2: Update static nav/copy**

Update the static headers in `index.html`, `about/index.html`, `press/index.html`, and `methodology/index.html` to include `Accountability`.

Update homepage intro to:

```html
Inspect 4,000 public event records and 150,000 accepted import-wave QA candidates across generated institution pages, source packets, imports, correction paths, and reproducible data artifacts.
```

Update homepage actions to prioritize `Accountability Room`, `Search Records`, `Build Reporting Packet`, and `Download Data`.

Replace unqualified `Human review required` footer language with:

```html
Campus Evidence Lab / Public-source records / Import-wave QA / Corrections and right-of-reply
```

Update about/methodology language so event records are reviewed before publication while accepted import-wave QA candidates are deterministic QA rows, not individual human certification.

Update press scale to `4,000 public event records`, `150,000 accepted import-wave QA candidates`, and `5,470 generated institution pages`.

- [ ] **Step 3: Update homepage JS metrics**

In `assets/app.js`:

- add `institutionImportWaveSummary: sitePath("/data/institution-import-wave-summary.json")` to `DATA_PATHS`;
- load it in `loadData()`;
- add `state.institutionImportWaveSummary`;
- display accepted QA candidates and generated institution pages in the dashboard metrics;
- add a command action to `/accountability-room/`;
- keep the limitation line visible near the metrics.

- [ ] **Step 4: Add square briefing styles**

In `assets/styles.css`, add:

- `.briefing-shell`;
- `.briefing-grid`;
- `.briefing-metric`;
- `.briefing-columns`;
- `.briefing-callout`;
- `.limit-line`;
- `.accountability-actions`.

Use square edges, 1px rules, no gradients, no shadows, stable responsive grids, and no border radius above 8px.

- [ ] **Step 5: Run render QA**

Run: `npm run qa:render`

Expected: PASS for dynamic homepage and Accountability Room checks.

## Task 5: Content, Accessibility, And Visual Bug QA

**Files:**
- Modify: `scripts/qa-content.mjs`
- Modify: `scripts/qa-render.mjs`
- Modify: `scripts/qa-accessibility.mjs`
- Test: existing npm QA scripts

- [ ] **Step 1: Add content QA checks**

Extend `scripts/qa-content.mjs` to inspect key public HTML files:

- `index.html`;
- `accountability-room/index.html`;
- `schools/brown_university/index.html`;
- `press/index.html`;
- `about/index.html`;
- `methodology/index.html`.

Checks:

- no stale `947 schools`;
- no unqualified `Human review required`;
- required Accountability Room limitation line appears on Accountability Room and school pages;
- no affirmative `ranking`, `safety score`, `severity score`, `prevalence`, or `legal finding` claims unless negated.

- [ ] **Step 2: Add render QA checks**

Extend `scripts/qa-render.mjs` pages array with `/accountability-room/` and `/schools/brown_university/`, checking first-viewport text, action links, limitation line, and accessible search/table controls.

- [ ] **Step 3: Add accessibility/static checks**

Extend `scripts/qa-accessibility.mjs` if needed to catch unlabeled Accountability Room search controls and duplicate IDs. Do not add broad visual assertions here if `qa-render` already covers them.

- [ ] **Step 4: Run focused QA**

Run:

```bash
npm run test:import-wave
npm run qa:content
npm run qa:accessibility
npm run qa:render
```

Expected: all pass.

## Task 6: Full Verification And Commit

**Files:**
- All touched files

- [ ] **Step 1: Run data and hash verification**

Run:

```bash
npm run validate:data
npm run qa:data-quality
node scripts/hash-dataset.mjs --check
```

Expected: all pass.

- [ ] **Step 2: Run full build**

Run: `npm run build`

Expected: full build passes and `dist/accountability-room/index.html` exists.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: changes are limited to Accountability Room, import-wave summary, site copy, CSS, QA tests, and generated pages/data.

- [ ] **Step 4: Commit**

Run:

```bash
git add .
git commit -m "feat: add accountability room"
```

Expected: commit succeeds on `codex/ev-accountability-scale`.

## Self-Review Notes

- Spec coverage: the plan covers the top-level Accountability Room, generated institution briefing pages, homepage/public framing, site-wide visual style, data summary, copy limits, accessibility QA, content QA, render QA, and full verification.
- Scope boundary: this plan does not implement AI chat, model training, API, Atlas, investor materials, or deployment.
- TDD boundary: Tasks 1 and 2 create failing tests before production code. Task 4 starts by adding failing QA expectations before static/JS/CSS changes. Bugs found during implementation require a new failing test before fixing.
