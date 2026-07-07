# CEL Accountability Infrastructure Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Accountability Signals, a static `/api/v1/` Developer API, a `/proof/` evaluator path, and a zero-cost Local Researcher Kit over the existing CEL public data.

**Architecture:** Generate one compact institution-level signal artifact first, then build API and citation-packet payloads from that artifact plus existing data. Static pages and the terminal researcher kit consume the generated artifacts so counts and public-use limits do not drift.

**Tech Stack:** Node ESM scripts, `node --test`, existing static page generator, JSON artifacts under `data/`, generated pages copied to `dist/`.

---

## File Structure

- Create `scripts/accountability-signals-lib.mjs`: pure builders and validators for descriptive institution signals.
- Create `scripts/generate-accountability-signals.mjs`: reads public data and writes `data/accountability-signals.json`.
- Create `scripts/api-v1-lib.mjs`: pure builders and validators for API index, snapshot, institutions, source-family, import-wave, and citation-packet payloads.
- Create `scripts/generate-api-v1.mjs`: writes `data/api/v1/**`.
- Create `scripts/researcher-kit.mjs`: local CLI over generated API/signals artifacts.
- Modify `scripts/lib.mjs`: add paths for accountability signals and API v1 directories.
- Modify `scripts/generate-pages.mjs`: read signals, render signal panels on school pages, render `/proof/`, and link API/citation artifacts.
- Modify `scripts/build-static.mjs`: copy `api/` or generated `data/api/` output to `dist/api`.
- Modify `scripts/generate-sitemap.mjs`: include `/proof/` and public API index endpoints.
- Modify `scripts/verify-public.mjs`: verify `/proof/` and core API endpoints.
- Modify `package.json`: add data-generation, test, and researcher-kit scripts; include new data generation in `prepare:data`, `check`, and `build` chains where required.
- Create `test/accountability-signals.test.mjs`.
- Create `test/api-v1.test.mjs`.
- Create `test/researcher-kit.test.mjs`.
- Modify `test/accountability-room.test.mjs`.
- Modify `test/verify-public.test.mjs`.
- Generate `data/accountability-signals.json`.
- Generate `data/api/v1/index.json`, `snapshot.json`, `source-families.json`, `import-waves.json`, `institutions/index.json`, `institutions/{school_id}.json`, and `citation-packets/{school_id}.json`.
- Generate `/proof/index.html`.

## Public Claim Boundaries

Every task must preserve these exact restrictions:

- Do not publish rankings, scores, grades, safety labels, severity labels, prevalence claims, legal findings, or institution fault judgments.
- Always distinguish `public event records` from `accepted import-wave QA candidates`.
- Always state that accepted import-wave QA candidates are not individual human certification.
- Keep API and citation packets public-safe: no raw quarantine rows, no private fields, no unsupported legal language.

## Task 1: Accountability Signal Tests

**Files:**
- Create: `test/accountability-signals.test.mjs`
- Create later: `scripts/accountability-signals-lib.mjs`

- [ ] **Step 1: Write the failing tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountabilitySignals,
  hasProhibitedSignalLanguage,
  validateAccountabilitySignals
} from "../scripts/accountability-signals-lib.mjs";

const schools = [
  { id: "brown_university", name: "Brown University", city: "Providence", state: "RI" },
  { id: "quiet_college", name: "Quiet College", city: "Example", state: "CA" }
];

const events = [
  {
    id: "evt_1",
    school_id: "brown_university",
    source_ids: ["src_ocr"],
    response_depth: "direct_institution_response",
    institutional_response: "Brown University published a public response.",
    source_locator: "OCR release"
  },
  {
    id: "evt_2",
    school_id: "brown_university",
    source_ids: ["src_ed"],
    response_depth: "limited_public_response_note",
    institutional_response: "The dataset does not independently evaluate response outcomes."
  }
];

const sources = [
  { id: "src_ocr", source_type: "Government release", publisher: "U.S. Department of Education Office for Civil Rights" },
  { id: "src_ed", source_type: "Government dataset", publisher: "U.S. Department of Education" }
];

const institutionImportWaveSummary = {
  accepted_candidate_count: 150000,
  institution_count: 2,
  institutions: [
    {
      school_id: "brown_university",
      accepted_candidate_count: 42,
      source_family_counts: { ed_campus_safety_dataset: 40, ocr_open_investigation: 2 },
      record_lane_counts: { aggregate_safety_stat: 40, civil_rights_case: 2 },
      import_wave_ids: ["wave_1", "wave_2"],
      latest_source_year: "2025"
    }
  ]
};

const corrections = [
  { id: "correction_1", event_id: "evt_1", status: "resolved" }
];

test("buildAccountabilitySignals separates public events from accepted import-wave candidates", () => {
  const artifact = buildAccountabilitySignals({ schools, events, sources, institutionImportWaveSummary, corrections, manifest: { snapshot_id: "snapshot_test", created_at: "2026-07-07" } });
  const brown = artifact.institutions.find((institution) => institution.school_id === "brown_university");

  assert.equal(artifact.snapshot_id, "snapshot_test");
  assert.equal(brown.public_event_count, 2);
  assert.equal(brown.accepted_candidate_count, 42);
  assert.equal(brown.source_family_counts.ed_campus_safety_dataset, 40);
  assert.equal(brown.signals.some((signal) => signal.id === "accepted_official_source_qa_candidates"), true);
  assert.equal(brown.public_use_limits.some((limit) => /not individual human certification/i.test(limit)), true);
});

test("buildAccountabilitySignals describes missing evidence without implying absence outside the snapshot", () => {
  const artifact = buildAccountabilitySignals({ schools, events, sources, institutionImportWaveSummary, corrections: [], manifest: { snapshot_id: "snapshot_test", created_at: "2026-07-07" } });
  const quiet = artifact.institutions.find((institution) => institution.school_id === "quiet_college");

  assert.equal(quiet.public_event_count, 0);
  assert.equal(quiet.accepted_candidate_count, 0);
  assert.equal(quiet.signals.some((signal) => signal.id === "limited_current_snapshot"), true);
  assert.match(quiet.unresolved_limits.join(" "), /current snapshot/i);
});

test("hasProhibitedSignalLanguage catches ranking and scoring language", () => {
  assert.equal(hasProhibitedSignalLanguage("high risk institution"), true);
  assert.equal(hasProhibitedSignalLanguage("safety score"), true);
  assert.equal(hasProhibitedSignalLanguage("source-backed event records present"), false);
});

test("validateAccountabilitySignals rejects prohibited claims and count drift", () => {
  const artifact = buildAccountabilitySignals({ schools, events, sources, institutionImportWaveSummary, corrections, manifest: { snapshot_id: "snapshot_test", created_at: "2026-07-07" } });
  assert.deepEqual(validateAccountabilitySignals({ artifact, schools, events, institutionImportWaveSummary }), []);

  const bad = structuredClone(artifact);
  bad.institutions[0].signals[0].label = "High risk school";
  assert.equal(validateAccountabilitySignals({ artifact: bad, schools, events, institutionImportWaveSummary }).some((error) => /prohibited/i.test(error)), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/accountability-signals.test.mjs`

Expected: FAIL with module-not-found for `scripts/accountability-signals-lib.mjs`.

## Task 2: Accountability Signal Implementation

**Files:**
- Create: `scripts/accountability-signals-lib.mjs`
- Create: `scripts/generate-accountability-signals.mjs`
- Modify: `scripts/lib.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement the signal builder**

Create `scripts/accountability-signals-lib.mjs` with exports:

```js
export const SIGNAL_PUBLIC_USE_LIMITS = [
  "Accountability Signals describe source basis, response evidence, correction posture, and unresolved limits.",
  "They are not rankings, safety scores, severity scores, prevalence estimates, or legal findings.",
  "Accepted import-wave QA candidates are not individual human certification of every row."
];

export function hasProhibitedSignalLanguage(value) {
  return /\b(high risk|low risk|dangerous|safe|noncompliant|bad actor|best|worst|score|grade|rating|safety score|severity score|prevalence|legal finding)\b/i.test(String(value ?? ""));
}
```

Then implement:

```js
export function buildAccountabilitySignals({ schools, events, sources, institutionImportWaveSummary, corrections = [], manifest = {} }) {
  // Build maps by school/source/event, generate one row per school, sort by school name.
}

export function validateAccountabilitySignals({ artifact, schools, events, institutionImportWaveSummary }) {
  // Return an array of string errors. Check snapshot id, unique school ids, event counts, accepted candidate counts, and prohibited labels.
}
```

- [ ] **Step 2: Implement the generator**

Create `scripts/generate-accountability-signals.mjs`:

```js
import { paths, readJson, writeJson } from "./lib.mjs";
import { buildAccountabilitySignals, validateAccountabilitySignals } from "./accountability-signals-lib.mjs";

const [schools, events, sources, institutionImportWaveSummary, corrections, manifest] = await Promise.all([
  readJson(paths.schools),
  readJson(paths.events),
  readJson(paths.sources),
  readJson(paths.institutionImportWaveSummary),
  readJson(paths.corrections),
  readJson(paths.manifest)
]);

const artifact = buildAccountabilitySignals({ schools, events, sources, institutionImportWaveSummary, corrections, manifest });
const errors = validateAccountabilitySignals({ artifact, schools, events, institutionImportWaveSummary });
if (errors.length) throw new Error(`Accountability signals validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);

await writeJson(paths.accountabilitySignals, artifact);
console.log(`Generated accountability signals for ${artifact.institutions.length} institutions.`);
```

- [ ] **Step 3: Wire paths and scripts**

Add to `scripts/lib.mjs` paths:

```js
accountabilitySignals: path.join(rootDir, "data", "accountability-signals.json"),
apiV1Dir: path.join(rootDir, "data", "api", "v1")
```

Add package scripts:

```json
"accountability-signals:data": "node scripts/generate-accountability-signals.mjs",
"test:accountability-signals": "node --test test/accountability-signals.test.mjs"
```

Add `npm run test:accountability-signals` to `check` before page generation. Add `npm run accountability-signals:data` after `institution-import-wave-summary:data` and before `pages:data`.

- [ ] **Step 4: Run tests**

Run: `node --test test/accountability-signals.test.mjs`

Expected: PASS.

Run: `npm run accountability-signals:data`

Expected: prints `Generated accountability signals for 5470 institutions.`

## Task 3: API And Citation Packet Tests

**Files:**
- Create: `test/api-v1.test.mjs`
- Create later: `scripts/api-v1-lib.mjs`

- [ ] **Step 1: Write failing API tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildApiV1Payloads,
  hasPrivateApiField,
  validateApiV1Payloads
} from "../scripts/api-v1-lib.mjs";

const manifest = { snapshot_id: "snapshot_test", created_at: "2026-07-07", dataset_hash: "sha256:test", totals: { events: 1, schools: 1, sources: 1 } };
const schools = [{ id: "brown_university", name: "Brown University", city: "Providence", state: "RI" }];
const events = [{ id: "evt_1", school_id: "brown_university", source_ids: ["src_1"], record_hash: "sha256:event", source_locator: "OCR release" }];
const sources = [{ id: "src_1", title: "OCR source", url: "https://example.edu/source", publisher: "ED OCR", source_type: "Government release" }];
const importWaves = [{ id: "wave_1", source_family: "ed_campus_safety_dataset", accepted_count: 42, quarantined_count: 0, status: "passed" }];
const signals = {
  snapshot_id: "snapshot_test",
  generated_at: "2026-07-07",
  institutions: [
    {
      school_id: "brown_university",
      name: "Brown University",
      public_event_count: 1,
      accepted_candidate_count: 42,
      source_family_counts: { ed_campus_safety_dataset: 42 },
      import_wave_ids: ["wave_1"],
      signals: [{ id: "source_backed_event_records", label: "source-backed event records present" }],
      public_use_limits: ["Accepted import-wave QA candidates are not individual human certification of every row."],
      unresolved_limits: []
    }
  ]
};

test("buildApiV1Payloads creates versioned public-safe endpoint payloads", () => {
  const payloads = buildApiV1Payloads({ manifest, schools, events, sources, importWaves, accountabilitySignals: signals });

  assert.equal(payloads.index.api_version, "v1");
  assert.equal(payloads.snapshot.snapshot_id, "snapshot_test");
  assert.equal(payloads.institutionsIndex.institutions[0].school_id, "brown_university");
  assert.equal(payloads.institutionDetails.get("brown_university").accepted_candidate_count, 42);
  assert.equal(payloads.citationPackets.get("brown_university").sources[0].url, "https://example.edu/source");
  assert.equal(payloads.index.public_use_limits.some((limit) => /not rankings/i.test(limit)), true);
});

test("hasPrivateApiField catches private and quarantine fields", () => {
  assert.equal(hasPrivateApiField("private_email"), true);
  assert.equal(hasPrivateApiField("raw_quarantine_row"), true);
  assert.equal(hasPrivateApiField("school_id"), false);
});

test("validateApiV1Payloads rejects missing limits and private fields", () => {
  const payloads = buildApiV1Payloads({ manifest, schools, events, sources, importWaves, accountabilitySignals: signals });
  assert.deepEqual(validateApiV1Payloads(payloads), []);

  const bad = structuredClone({ ...payloads, institutionDetails: Array.from(payloads.institutionDetails.entries()), citationPackets: Array.from(payloads.citationPackets.entries()) });
  bad.index.public_use_limits = [];
  assert.equal(validateApiV1Payloads(bad).some((error) => /public_use_limits/i.test(error)), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/api-v1.test.mjs`

Expected: FAIL with module-not-found for `scripts/api-v1-lib.mjs`.

## Task 4: API And Citation Packet Implementation

**Files:**
- Create: `scripts/api-v1-lib.mjs`
- Create: `scripts/generate-api-v1.mjs`
- Modify: `scripts/build-static.mjs`
- Modify: `package.json`

- [ ] **Step 1: Implement API payload builder**

Create `scripts/api-v1-lib.mjs` with:

```js
export const API_VERSION = "v1";
export const API_PUBLIC_USE_LIMITS = [
  "CEL API data is public-source infrastructure, not rankings, safety scores, severity scores, prevalence estimates, or legal findings.",
  "Accepted import-wave QA candidates are official-source rows that passed deterministic QA; they are not individual human certification.",
  "Public event records remain separate from accepted import-wave QA candidates."
];

export function hasPrivateApiField(key) {
  return /\b(private|email|phone|raw_quarantine|raw_private|sensitive)\b/i.test(String(key ?? ""));
}
```

Implement `buildApiV1Payloads` so it returns:

```js
{
  index,
  snapshot,
  institutionsIndex,
  sourceFamilies,
  importWaves,
  institutionDetails: new Map(),
  citationPackets: new Map()
}
```

Implement `validateApiV1Payloads(payloads)` as an error-array validator.

- [ ] **Step 2: Implement API generator**

Create `scripts/generate-api-v1.mjs` to read data, call `buildApiV1Payloads`, validate, and write:

```txt
data/api/v1/index.json
data/api/v1/snapshot.json
data/api/v1/source-families.json
data/api/v1/import-waves.json
data/api/v1/institutions/index.json
data/api/v1/institutions/{school_id}.json
data/api/v1/citation-packets/{school_id}.json
```

Use `readdir(paths.importWavesDir)` to load all import-wave JSON files.

- [ ] **Step 3: Copy API output to public dist**

Modify `scripts/build-static.mjs` to include:

```js
"api"
```

Generate root-level `api/v1/**` files from `data/api/v1/**` in `generate-api-v1.mjs` so static deploy exposes `/api/v1/...`.

- [ ] **Step 4: Wire package scripts**

Add:

```json
"api:v1:data": "node scripts/generate-api-v1.mjs",
"test:api-v1": "node --test test/api-v1.test.mjs"
```

Add `npm run test:api-v1` to `check`. Add `npm run api:v1:data` after `accountability-signals:data` and before `pages:data`.

- [ ] **Step 5: Run tests and generator**

Run: `node --test test/api-v1.test.mjs`

Expected: PASS.

Run: `npm run api:v1:data`

Expected: writes API payloads and prints endpoint counts.

## Task 5: Proof Route And Page Integration Tests

**Files:**
- Modify: `test/accountability-room.test.mjs`
- Modify later: `scripts/generate-pages.mjs`
- Modify later: `scripts/generate-sitemap.mjs`

- [ ] **Step 1: Add failing page tests**

Append tests that read generated HTML:

```js
test("institution pages expose accountability signals and API citation packet links", async () => {
  const html = await readFile(new URL("../schools/brown_university/index.html", import.meta.url), "utf8");
  assert.match(html, /Accountability Signals/);
  assert.match(html, /not rankings, safety scores, severity scores, prevalence estimates, or legal findings/i);
  assert.match(html, /api\/v1\/institutions\/brown_university\.json/);
  assert.match(html, /api\/v1\/citation-packets\/brown_university\.json/);
  assert.doesNotMatch(html, /high risk|safety score|severity score|grade/i);
});

test("proof path shows real infrastructure artifacts without investor or hype framing", async () => {
  const html = await readFile(new URL("../proof/index.html", import.meta.url), "utf8");
  assert.match(html, /Public accountability infrastructure, not a ranking/);
  assert.match(html, /150,000 accepted import-wave QA candidates/);
  assert.match(html, /api\/v1\/index\.json/);
  assert.match(html, /npm run researcher:institution/);
  assert.match(html, /Correction \/ right of reply/);
  assert.doesNotMatch(html, /investor|impress Tyler|high risk|safety score/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/accountability-room.test.mjs`

Expected: FAIL because proof page and signal panels are not generated yet.

## Task 6: Proof Route And Page Integration Implementation

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/build-static.mjs`

- [ ] **Step 1: Read signals and API payloads in page generator**

Add `readJson(paths.accountabilitySignals)` to the top-level `Promise.all`. Build:

```js
const accountabilitySignalsBySchool = new Map((accountabilitySignals.institutions ?? []).map((row) => [row.school_id, row]));
```

- [ ] **Step 2: Render signal panel on school pages**

Add a `renderAccountabilitySignalsPanel(signalRow, depth)` helper that prints:

- heading `Accountability Signals`;
- signal labels;
- public event count;
- accepted candidate count;
- source-family mix;
- unresolved limits;
- API/citation links.

Use existing page styles and square briefing panels. Do not add icons or decorative gradients.

- [ ] **Step 3: Render `/proof/`**

Add `proofDir = path.join(rootDir, "proof")` and remove/create it alongside other page dirs. Render `proof/index.html` with:

- headline `Public accountability infrastructure, not a ranking.`;
- route to `/accountability-room/`;
- example institution link, preferably Brown University if present, otherwise first institution with both events and accepted candidates;
- API links;
- researcher-kit commands;
- correction/right-of-reply link;
- public-use limits.

- [ ] **Step 4: Add `/proof/` to sitemap and dist**

Add `"proof"` to `publicPaths` in `scripts/build-static.mjs`.

Add `/proof/` in `scripts/generate-sitemap.mjs`.

- [ ] **Step 5: Run page generation and tests**

Run: `npm run pages:data && npm run sitemap:data`

Expected: generates school pages and `/proof/`.

Run: `node --test test/accountability-room.test.mjs`

Expected: PASS.

## Task 7: Local Researcher Kit Tests

**Files:**
- Create: `test/researcher-kit.test.mjs`
- Create later: `scripts/researcher-kit.mjs`

- [ ] **Step 1: Write failing CLI tests**

Use `node:child_process` to run commands:

```js
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function run(args) {
  return execFileSync(process.execPath, ["scripts/researcher-kit.mjs", ...args], { encoding: "utf8" });
}

test("researcher kit prints snapshot metadata", () => {
  const output = run(["snapshot"]);
  assert.match(output, /Snapshot:/);
  assert.match(output, /Public event records:/);
  assert.match(output, /Accepted import-wave QA candidates:/);
  assert.match(output, /not rankings/i);
});

test("researcher kit finds an institution by name and JSON mode is parseable", () => {
  const text = run(["institution", "Brown University"]);
  assert.match(text, /Brown University/);
  assert.match(text, /Accountability Signals/);

  const json = JSON.parse(run(["institution", "Brown University", "--json"]));
  assert.equal(json.school_id, "brown_university");
});

test("researcher kit prints citation packet and validates API artifacts", () => {
  assert.match(run(["citation", "brown_university"]), /Citation packet/);
  assert.match(run(["api-check"]), /API artifacts match snapshot/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/researcher-kit.test.mjs`

Expected: FAIL because `scripts/researcher-kit.mjs` does not exist.

## Task 8: Local Researcher Kit Implementation

**Files:**
- Create: `scripts/researcher-kit.mjs`
- Modify: `package.json`
- Create: `docs/local-researcher-kit.md`

- [ ] **Step 1: Implement CLI commands**

Create `scripts/researcher-kit.mjs` with commands:

```txt
snapshot
institution <name-or-school-id> [--json]
citation <school_id> [--json]
api-check
```

Read from:

```txt
data/api/v1/index.json
data/api/v1/snapshot.json
data/api/v1/institutions/index.json
data/api/v1/institutions/{school_id}.json
data/api/v1/citation-packets/{school_id}.json
```

Exit with code `1` and a concise message for unknown commands or unknown institutions.

- [ ] **Step 2: Add package scripts**

Add:

```json
"researcher:snapshot": "node scripts/researcher-kit.mjs snapshot",
"researcher:institution": "node scripts/researcher-kit.mjs institution",
"researcher:citation": "node scripts/researcher-kit.mjs citation",
"researcher:api-check": "node scripts/researcher-kit.mjs api-check",
"test:researcher-kit": "node --test test/researcher-kit.test.mjs"
```

Add `npm run test:researcher-kit` to `check`.

- [ ] **Step 3: Write local kit docs**

Create `docs/local-researcher-kit.md` with:

- purpose;
- zero-cost/no hosted model requirement;
- commands;
- public-use limits;
- examples for Brown University;
- snapshot reproducibility note.

- [ ] **Step 4: Run tests**

Run: `node --test test/researcher-kit.test.mjs`

Expected: PASS.

## Task 9: Public Verifier And QA Integration

**Files:**
- Modify: `test/verify-public.test.mjs`
- Modify: `scripts/verify-public.mjs`
- Modify: `package.json`

- [ ] **Step 1: Extend verifier tests**

Update expected core checks to include:

```js
["/proof/", "Public accountability infrastructure, not a ranking"],
["/api/v1/index.json", "\"api_version\""],
["/api/v1/snapshot.json", "\"snapshot_id\""],
["/api/v1/institutions/index.json", "\"institutions\""]
```

- [ ] **Step 2: Extend public verifier**

In `scripts/verify-public.mjs`, add:

```js
await fetchText("/proof/", ["Public accountability infrastructure, not a ranking", "api/v1/index.json"]);
await fetchJson("/api/v1/index.json");
await fetchJson("/api/v1/snapshot.json");
await fetchJson("/api/v1/institutions/index.json");
```

Validate API index includes `api_version: "v1"` and public-use limits.

- [ ] **Step 3: Run verifier tests**

Run: `node --test test/verify-public.test.mjs`

Expected: PASS.

## Task 10: Full Regeneration, Build, And Checkpoint Commit

**Files:**
- Generated: `data/accountability-signals.json`
- Generated: `data/api/v1/**`
- Generated: `api/v1/**`
- Generated: `proof/index.html`
- Generated: school pages, sitemap, release artifacts if scripts update them.

- [ ] **Step 1: Run targeted tests**

Run:

```sh
npm run test:accountability-signals
npm run test:api-v1
npm run test:researcher-kit
npm run test:import-wave
```

Expected: all pass.

- [ ] **Step 2: Run data generation**

Run:

```sh
npm run accountability-signals:data
npm run api:v1:data
npm run pages:data
npm run sitemap:data
```

Expected: generated signals, API files, `/proof/`, and sitemap.

- [ ] **Step 3: Run full build**

Run: `npm run build`

Expected: build exits `0`, including data validation, content QA, data-quality QA, site QA, accessibility QA, and render QA.

- [ ] **Step 4: Inspect diff**

Run:

```sh
git status --short
git diff --stat
```

Expected: only planned files and generated artifacts changed.

- [ ] **Step 5: Commit**

Run:

```sh
git add -A
git commit -m "feat: add accountability infrastructure pack"
```

Expected: commit succeeds.

## Task 11: Public Deployment

**Files:**
- No additional file edits unless deployment verification exposes a concrete issue.

- [ ] **Step 1: Push to main**

Run:

```sh
git push origin HEAD:main
```

Expected: push succeeds and GitHub Pages workflow starts.

- [ ] **Step 2: Watch GitHub Pages**

Run:

```sh
gh run list --repo maximilian-kornstein/campus-evidence-lab --branch main --limit 5
PAGES_RUN_ID=$(gh run list --repo maximilian-kornstein/campus-evidence-lab --branch main --workflow "Deploy GitHub Pages" --json databaseId --jq '.[0].databaseId')
gh run watch "$PAGES_RUN_ID" --repo maximilian-kornstein/campus-evidence-lab --exit-status
```

Expected: `Deploy GitHub Pages` succeeds.

- [ ] **Step 3: Verify public site**

Run:

```sh
npm run verify:public -- https://campusevidencelab.org
```

Expected: public verification passes for core pages, release artifacts, datasets, source audits, API endpoints, proof route, and generated detail pages.
