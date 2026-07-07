# CLE Command Center And Protocol Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Campus Evidence Lab immediately useful from the homepage and add a restrained CLE Protocol surface that frames blockchain as one optional proof adapter behind canonical hashes, signed manifests, Merkle proofs, and local developer verification.

**Architecture:** Keep the current static-site architecture for this implementation. The homepage remains `index.html` plus the rendered dashboard in `assets/app.js`; the protocol explanation is a new static `protocol/index.html` page copied by `scripts/build-static.mjs`; packet improvements extend the existing local browser-only research workspace and packet generator. The protocol page describes the target architecture as canonical evidence data, deterministic hashes, signed releases, Merkle inclusion proofs, local verifier tooling, and optional proof adapters such as the existing `SnapshotRegistry` contract.

**Tech Stack:** Static HTML, vanilla JavaScript modules, CSS, Node.js built-in test runner, jsdom-backed QA scripts, existing Solidity `SnapshotRegistry` contract as an optional proof-adapter prototype.

---

## Scope Guardrails

This plan exposes and connects existing assets before creating new infrastructure. It does not add a browser extension, API, SDK, graph database, LLM/RAG workflow, token, token governance, private evidence intake, production CLI, or production Merkle generator. It must preserve the message: Campus Evidence Lab is neutral public-source civil-rights evidence infrastructure; cryptographic proofs support auditability but are not the product. The protocol should still be useful without any blockchain integration.

The current Git worktree has many uncommitted modified and untracked files. Treat them as user-owned. Do not run broad generation commands that rewrite hundreds of pages unless a task explicitly calls for it. Do not revert unrelated files.

## File Structure

- Modify `index.html`: sharpen static above-fold copy and add a Protocol navigation link.
- Modify `assets/app.js`: render homepage command-center stats/actions, upgrade packet wording/output, and add protocol-aware links.
- Modify `assets/styles.css`: add small, reusable command-center/proof/status styles without changing the whole visual system.
- Create `protocol/index.html`: static CLE Protocol page explaining canonical evidence data, deterministic hashes, signed manifests, Merkle proofs, local verification, responsible use, and optional proof adapters.
- Modify `scripts/build-static.mjs`: copy `protocol/` and `contracts/` into `dist/`.
- Create `test/command-center-protocol.test.mjs`: contract tests for homepage/protocol links, page copy, proof-layer guardrails, and build inclusion.
- Modify `package.json`: add a named script for the new focused test.

## Task 1: Product Contract Test

**Files:**
- Create: `test/command-center-protocol.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing test**

Create `test/command-center-protocol.test.mjs` with this content:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

test("homepage exposes command-center entry points and proof-layer framing", async () => {
  const [indexHtml, appJs] = await Promise.all([text("index.html"), text("assets/app.js")]);
  const combined = `${indexHtml}\n${appJs}`;

  for (const expected of [
    "Search Records",
    "Build Reporting Packet",
    "Download Data",
    "Review Methodology",
    "4,000",
    "947",
    "25",
    "CSV/JSON",
    "snapshot"
  ]) {
    assert.match(combined, new RegExp(expected.replace("/", "\\/"), "i"), `Missing homepage signal: ${expected}`);
  }

  assert.match(combined, /Journalist/i);
  assert.match(combined, /Researcher/i);
  assert.match(combined, /Contributor/i);
  assert.match(combined, /Reviewer/i);
  assert.match(indexHtml, /protocol\//i);
});

test("research packet language is reporting-ready and bounded", async () => {
  const appJs = await text("assets/app.js");

  for (const expected of [
    "Reporting Packet",
    "Methodology note",
    "Limitations",
    "Snapshot hash",
    "Source URLs",
    "citation"
  ]) {
    assert.match(appJs, new RegExp(expected, "i"), `Missing packet signal: ${expected}`);
  }

  assert.doesNotMatch(appJs, /\bprevalence estimate\b(?!, school ranking, safety score, or severity score)/i);
});

test("protocol page makes local verification primary and blockchain optional", async () => {
  const protocolHtml = await text("protocol/index.html");

  for (const expected of [
    "CLE Protocol",
    "civil-rights evidence integrity",
    "Canonical Evidence Data",
    "Deterministic Hashes",
    "Signed Releases",
    "Merkle Proofs",
    "Local Verifier",
    "Proof Adapters",
    "Developer Utility",
    "Evidence Packets",
    "Responsible-Use Layer",
    "SnapshotRegistry.sol"
  ]) {
    assert.match(protocolHtml, new RegExp(expected, "i"), `Missing protocol copy: ${expected}`);
  }

  assert.match(protocolHtml, /blockchain is optional/i);
  assert.match(protocolHtml, /Do not put sensitive incident data on-chain/i);
  assert.match(protocolHtml, /no token/i);
});

test("static build includes protocol and contract source directories", async () => {
  const buildStatic = await text("scripts/build-static.mjs");
  assert.match(buildStatic, /"protocol"/);
  assert.match(buildStatic, /"contracts"/);
});
```

- [ ] **Step 2: Add a named npm script**

In `package.json`, add this script near the other `test:*` entries:

```json
"test:command-center-protocol": "node --test test/command-center-protocol.test.mjs",
```

- [ ] **Step 3: Run the test to verify it fails for the missing protocol work**

Run:

```bash
npm run test:command-center-protocol
```

Expected: FAIL because `protocol/index.html` does not exist yet and the homepage/packet labels are not all present.

## Task 2: Homepage Static Shell

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Update the header navigation**

Add a Protocol nav item after Data:

```html
<a href="downloads/" data-nav="downloads">Data</a>
<a href="protocol/" data-nav="protocol">Protocol</a>
<a href="submit/" data-nav="submit">Submit</a>
```

- [ ] **Step 2: Replace the above-fold copy**

Replace the current kicker, title, and intro with:

```html
<p class="page-kicker">Public-source civil-rights evidence infrastructure</p>
<h1 class="page-title">Campus Evidence Lab</h1>
<p class="page-intro">Search 4,000 public-source campus civil-rights records across 947 schools, build citation-ready reporting packets, download CSV/JSON datasets, and verify the current snapshot hash before using the archive.</p>
```

- [ ] **Step 3: Add static primary actions before `#dashboard-root`**

Insert this block before `<div id="dashboard-root" data-error-root></div>`:

```html
<div class="hero-actions" aria-label="Primary actions">
  <a class="button-link button-link--primary" href="events/">Search Records</a>
  <a class="button-link" href="research-workspace/?title=Campus%20Evidence%20Lab%20Reporting%20Packet&question=What%20public-source%20records%20support%20this%20reporting%20question%3F">Build Reporting Packet</a>
  <a class="button-link" href="downloads/">Download Data</a>
  <a class="button-link" href="methodology/">Review Methodology</a>
</div>
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm run test:command-center-protocol
```

Expected: still FAIL because protocol page and app-rendered labels are not complete.

## Task 3: Homepage Command Center Rendering

**Files:**
- Modify: `assets/app.js`

- [ ] **Step 1: Add a Protocol nav data-page match**

No JavaScript change is needed for nav highlighting if `protocol/index.html` uses `<body data-page="protocol">`; `setCurrentNav()` already matches `data-nav` to `data-page`.

- [ ] **Step 2: Add command-center action helpers above `renderDashboard()`**

Insert these helper functions before `function renderDashboard()`:

```js
function commandCenterAction(title, body, href) {
  return `
    <a class="action-link action-link--command" href="${sitePath(href)}">
      <span>${escapeHtml(title)}</span>
      <span>${escapeHtml(body)}</span>
    </a>
  `;
}

function audiencePath(title, body, href) {
  return `
    <a class="audience-path" href="${sitePath(href)}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </a>
  `;
}
```

- [ ] **Step 3: Add command-center metrics inside `renderDashboard()`**

Inside `renderDashboard()`, after `const signals = documentationSignals(state.records);`, add:

```js
const sourceCollections = state.sources.size;
const currentSnapshotHash = state.manifest.hashes.full_snapshot;
```

Then replace the opening metric section with:

```js
<section class="section section--tight command-center" aria-label="Command center">
  <div class="metric-grid metric-grid--dashboard">
    <div class="metric">
      <span class="metric__value">${state.records.length.toLocaleString("en-US")}</span>
      <span class="metric__label">Public-source records</span>
    </div>
    <div class="metric">
      <span class="metric__value">${schoolsTracked.toLocaleString("en-US")}</span>
      <span class="metric__label">Schools with records</span>
    </div>
    <div class="metric">
      <span class="metric__value">${sourceCollections.toLocaleString("en-US")}</span>
      <span class="metric__label">Source collections</span>
    </div>
    <div class="metric">
      <span class="metric__value">CSV/JSON</span>
      <span class="metric__label">Exports and research files</span>
    </div>
    <div class="metric">
      <span class="metric__value">${shortHash(currentSnapshotHash)}</span>
      <span class="metric__label">Current snapshot hash</span>
    </div>
  </div>
  <div class="command-actions">
    ${commandCenterAction("Search Records", "Find records by school, community, source type, confidence, and verification status.", "/events/")}
    ${commandCenterAction("Build Reporting Packet", "Generate selected records, source URLs, limitations, citation language, and snapshot metadata.", "/research-workspace/?title=Campus%20Evidence%20Lab%20Reporting%20Packet&question=What%20public-source%20records%20support%20this%20reporting%20question%3F")}
    ${commandCenterAction("Download Data", "Use CSV, JSON, research exports, manifest, archived snapshot, and schema files.", "/downloads/")}
    ${commandCenterAction("Review Methodology", "Inspect inclusion rules, confidence language, correction flow, and responsible-use limits.", "/methodology/")}
  </div>
</section>
```

- [ ] **Step 4: Add user-specific Start Here paths**

Add this section after the command-center section and before Dataset Status:

```js
<section class="section section--tight" aria-labelledby="start-here-title">
  <div class="section-header">
    <h2 class="section-title" id="start-here-title">Start Here</h2>
    <p class="section-note">Choose the narrowest useful workflow</p>
  </div>
  <div class="audience-grid">
    ${audiencePath("Journalists", "Search a school, select records, build a reporting packet, and cite the limitations before requesting comment.", "/journalist-guide/")}
    ${audiencePath("Researchers", "Download snapshot-bound CSV/JSON, read the methodology, and cite the current manifest hash.", "/research-guide/")}
    ${audiencePath("Contributors", "Submit public sources, corrections, duplicate reports, or school metadata fixes without private evidence.", "/submit/")}
    ${audiencePath("Reviewers", "Audit sample records, challenge source support, and keep acknowledgment separate from endorsement.", "/reviewer-queue/")}
  </div>
</section>
```

- [ ] **Step 5: Add a protocol entry point**

Add this action to the existing Audience Entry Points `action-grid`:

```js
<a class="action-link" href="${sitePath("/protocol/")}">
  <span>CLE Protocol</span>
  <span>See the evidence-integrity layer: canonical hashes, signed manifests, Merkle proofs, local verification, responsible-use checks, and optional chain adapters.</span>
</a>
```

- [ ] **Step 6: Run the focused test**

Run:

```bash
npm run test:command-center-protocol
```

Expected: still FAIL only because `protocol/index.html` and build inclusion are not complete.

## Task 4: Reporting Packet Upgrade

**Files:**
- Modify: `assets/app.js`
- Modify: `research-workspace/index.html`

- [ ] **Step 1: Update the research workspace static copy**

In `research-workspace/index.html`, replace the h1 and intro with:

```html
<h1 class="page-title page-title--small">Build a reporting packet from selected public records.</h1>
<p class="page-intro">Select public records, write a narrow reporting or research question, and generate a packet with source URLs, citation language, methodology note, limitations, snapshot hash, and machine-readable record data. Nothing is submitted or stored.</p>
```

- [ ] **Step 2: Replace `researchPacket()` section headings**

Inside `researchPacket()`, replace the first lines array block with:

```js
const lines = [
  `# ${title}`,
  "",
  question ? `Reporting or research question: ${question}` : "Reporting or research question: not specified",
  "",
  "Methodology note:",
  "Campus Evidence Lab records summarize public-source documentation. The packet preserves source links, record hashes, snapshot metadata, and conservative use limits so a reporter, researcher, reviewer, or public-interest organization can verify the basis for each record.",
  "",
  `Snapshot: ${state.manifest.snapshot_id}`,
  `Snapshot hash: ${state.manifest.hashes.full_snapshot}`,
  `Records selected: ${records.length}`,
  "",
  "Limitations:",
  "- This packet cites public-source documentation, not incident prevalence.",
  "- Record counts are not school rankings, safety scores, or severity scores.",
  "- Absence from the dataset does not mean absence of incidents or institutional response.",
  "- AI-generated summaries or downstream analysis should not be treated as reviewed unless human-review metadata is present.",
  "",
  "Selected records:",
```

Keep the existing `records.flatMap(...)`, machine-readable selection, and closing structure.

- [ ] **Step 3: Add source URL label inside selected records**

Inside the selected-record mapping, replace:

```js
`   Sources:`,
```

with:

```js
`   Source URLs and citations:`,
```

- [ ] **Step 4: Update workspace section labels**

In `renderResearchWorkspace()`, replace:

```js
<h2 class="section-title">Citation Packet</h2>
<p class="section-note">Markdown and JSON are generated locally</p>
```

with:

```js
<h2 class="section-title">Reporting Packet</h2>
<p class="section-note">Markdown and JSON are generated locally with methodology note, limitations, citations, and snapshot metadata</p>
```

- [ ] **Step 5: Run the focused packet test**

Run:

```bash
npm run test:command-center-protocol
```

Expected: still FAIL only because protocol page and build inclusion are not complete.

## Task 5: Protocol Page

**Files:**
- Create: `protocol/index.html`

- [ ] **Step 1: Create the protocol directory page**

Create `protocol/index.html` with this content:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CLE Protocol / Campus Evidence Lab</title>
    <link rel="stylesheet" href="../assets/styles.css">
  </head>
  <body data-page="protocol">
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="../">
          <span class="brand__name">Campus Evidence Lab</span>
          <span class="brand__tag">Public evidence infrastructure</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a href="../" data-nav="dashboard">Dashboard</a>
          <a href="../events/" data-nav="events">Events</a>
          <a href="../schools/" data-nav="schools">Schools</a>
          <a href="../briefs/" data-nav="briefs">Briefs</a>
          <a href="../sources/" data-nav="sources">Sources</a>
          <a href="../quality/" data-nav="quality">Quality</a>
          <a href="../methodology/" data-nav="methodology">Methodology</a>
          <a href="../impact/" data-nav="impact">Impact</a>
          <a href="../guide/" data-nav="guide">Guide</a>
          <a href="../downloads/" data-nav="downloads">Data</a>
          <a href="../protocol/" data-nav="protocol">Protocol</a>
          <a href="../submit/" data-nav="submit">Submit</a>
          <a href="../about/" data-nav="about">About</a>
          <a href="../license/" data-nav="license">License</a>
        </nav>
      </div>
    </header>
    <main class="main">
      <p class="page-kicker">Evidence integrity layer</p>
      <h1 class="page-title page-title--small">CLE Protocol</h1>
      <p class="page-intro">CLE Protocol is the civil-rights evidence integrity layer under Campus Evidence Lab: a public standard for canonical records, deterministic hashes, signed snapshot manifests, Merkle inclusion proofs, local verification tools, responsible-use limits, and optional proof adapters.</p>

      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Principle</h2>
          <p class="section-note">Verification first; blockchain is optional</p>
        </div>
        <p class="section-copy">Campus Evidence Lab remains a public-source research archive. CLE Protocol describes the technical layer that lets users verify records, methodology, corrections, packets, and dataset snapshots without trusting the site blindly.</p>
        <p class="section-copy"><strong>Blockchain is optional.</strong> The protocol must work through local files, signed manifests, GitHub releases, and reproducible hashes before any chain adapter is used.</p>
        <p class="section-copy"><strong>Do not put sensitive incident data on-chain.</strong> Optional public proof adapters are for dataset Merkle roots, snapshot manifest hashes, methodology version hashes, correction-log hashes, source-bundle hashes, reviewer attestation hashes, and evidence-packet hashes.</p>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Protocol Architecture</h2>
          <p class="section-note">Local verification before chain integration</p>
        </div>
        <div class="action-grid">
          <div class="action-link action-link--static">
            <span>Canonical Evidence Data</span>
            <span>Shared schemas and deterministic canonical JSON for records, sources, corrections, packets, snapshots, methodology versions, and release metadata.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Deterministic Hashes</span>
            <span>Stable record hashes, source-bundle hashes, correction-log hashes, packet hashes, manifest hashes, and full dataset hashes that can be reproduced locally.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Signed Releases</span>
            <span>Each release should publish a signed manifest with schema version, record count, source count, methodology version, known limits, hashes, timestamp, and archived files.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Merkle Proofs</span>
            <span>Dataset snapshots should expose a Merkle root and record-level inclusion proofs so a user can prove a record appeared in a specific snapshot.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Evidence Packets</span>
            <span>Journalist and researcher packets bundle summaries, timelines, source URLs, citations, methodology notes, limitations, correction history, and verification metadata.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Responsible-Use Layer</span>
            <span>Policy-as-code checks should warn when outputs imply prevalence, ranking, severity, unsupported comparison, or AI-reviewed claims without human-review metadata.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Local Verifier</span>
            <span>Developer tools should verify manifests, records, packets, and inclusion proofs from local files before relying on any external timestamping or blockchain service.</span>
          </div>
          <div class="action-link action-link--static">
            <span>Proof Adapters</span>
            <span>Optional adapters can publish or check manifest hashes through Git tags, GitHub releases, timestamping services, IPFS-like content addressing, or a minimal chain registry.</span>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Developer Utility</h2>
          <p class="section-note">Target interface for later protocol tooling</p>
        </div>
        <pre class="packet-output" aria-label="Future CLE Protocol command examples">cle verify snapshot snapshot-manifest.json
cle verify record evt_2026_0027 --snapshot snapshot.json
cle prove record evt_2026_0027 --snapshot snapshot.json
cle packet build --school "Example University"
cle policy check chart.json
cle snapshot compare latest previous</pre>
        <p class="section-copy">These commands are a roadmap for the developer platform. They are not required for the first static protocol page, but they define what the protocol should make possible.</p>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Current Proof Prototype</h2>
          <p class="section-note">Optional adapter; no token</p>
        </div>
        <p class="section-copy">The Solidity registry is not the core protocol. It is one possible adapter for publishing snapshot hashes after local verification and signed manifests already work.</p>
        <dl>
          <div class="data-line">
            <dt>Contract</dt>
            <dd><a href="../contracts/SnapshotRegistry.sol">SnapshotRegistry.sol</a></dd>
          </div>
          <div class="data-line">
            <dt>Stores</dt>
            <dd>Snapshot ID, snapshot hash, metadata URI, publisher, and publication timestamp.</dd>
          </div>
          <div class="data-line">
            <dt>Does not store</dt>
            <dd>Private evidence, sensitive incident details, ranking signals, payments, moderation decisions, source text, or token governance.</dd>
          </div>
        </dl>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Use Boundaries</h2>
          <p class="section-note">Credibility depends on restraint</p>
        </div>
        <ul>
          <li>No token, no token sale, and no token governance.</li>
          <li>No legal advice or legal conclusions by Campus Evidence Lab.</li>
          <li>No school rankings, safety scores, severity scores, or prevalence estimates.</li>
          <li>No private or sensitive evidence on-chain.</li>
          <li>Local verification must remain useful even if no blockchain adapter is used.</li>
          <li>AI may assist research drafting, duplicate detection, extraction, and citation formatting; human review controls publication and verification status.</li>
        </ul>
      </section>

      <section class="section">
        <div class="section-header">
          <h2 class="section-title">Verification Paths</h2>
          <p class="section-note">Use the smallest artifact that answers the question</p>
        </div>
        <div class="action-grid">
          <a class="action-link" href="../downloads/">
            <span>Verify Current Snapshot</span>
            <span>Open manifest, archived snapshot, snapshot index, release metadata, CSV, JSON, schemas, and published hashes.</span>
          </a>
          <a class="action-link" href="../research-workspace/">
            <span>Build Evidence Packet</span>
            <span>Select records and generate a local packet with source URLs, limitations, citation language, and snapshot hash.</span>
          </a>
          <a class="action-link" href="../methodology/">
            <span>Review Methodology</span>
            <span>Inspect source standards, confidence language, correction handling, and responsible-use rules.</span>
          </a>
        </div>
      </section>
    </main>
    <footer class="site-footer">Campus Evidence Lab / Protocol proofs support evidence integrity</footer>
    <script type="module" src="../assets/app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Run accessibility QA for the new static page**

Run:

```bash
npm run qa:accessibility
```

Expected: PASS, including `protocol/index.html` once the page is included in site traversal or manually opened by the script through local paths.

## Task 6: Build Inclusion And Navigation Consistency

**Files:**
- Modify: `scripts/build-static.mjs`
- Modify: `index.html`
- Modify static pages only if navigation consistency is required by QA.

- [ ] **Step 1: Include protocol in static deployment output**

In `scripts/build-static.mjs`, add `"protocol",` after `"downloads",`:

```js
  "downloads",
  "protocol",
  "submit",
```

- [ ] **Step 2: Include the Solidity proof prototype in deployed output**

In `scripts/build-static.mjs`, add `"contracts",` near `"schema",`:

```js
  "data",
  "docs",
  "schema",
  "contracts",
  "events",
```

- [ ] **Step 3: Keep navigation scope narrow**

Do not regenerate all static pages only to add Protocol to every nav. For V1, the Protocol link must exist on the homepage and the protocol page. Existing pages can still reach Protocol through homepage, Downloads, or future generated nav work.

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm run test:command-center-protocol
```

Expected: PASS.

## Task 7: Styling Polish

**Files:**
- Modify: `assets/styles.css`

- [ ] **Step 1: Add hero actions and command-center styles**

Add near the existing `.button-link` and action-grid styles:

```css
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}

.button-link--primary {
  background: var(--ink);
  color: var(--page);
}

.command-center {
  margin-top: 52px;
}

.command-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-left: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
}

.action-link--command {
  border-left: 0;
  border-bottom: 0;
}

.audience-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--line-strong);
  border-left: 1px solid var(--line-strong);
}

.audience-path {
  display: grid;
  gap: 10px;
  min-height: 132px;
  padding: 18px;
  border-right: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
  text-decoration: none;
}

.audience-path span {
  color: var(--muted);
}

.action-link--static {
  color: var(--ink);
  text-decoration: none;
}
```

- [ ] **Step 2: Add responsive rules**

Inside the existing `@media` block where grids collapse to `1fr`, add:

```css
  .command-actions,
  .audience-grid {
    grid-template-columns: 1fr;
  }
```

- [ ] **Step 3: Run render/accessibility QA**

Run:

```bash
npm run qa:accessibility
npm run qa:render
```

Expected: both PASS. If `qa:render` fails due unrelated pre-existing dirty-worktree issues, record the exact failure and do not change unrelated generated pages.

## Task 8: Downloads Verification Surface

**Files:**
- Modify: `downloads/index.html`
- Modify: `assets/app.js`

- [ ] **Step 1: Add static protocol link to downloads intro**

In `downloads/index.html`, add this sentence to the intro paragraph:

```html
Use the <a href="../protocol/">Protocol page</a> to understand how canonical hashes, signed manifests, archived files, local verification, and optional proof adapters fit together.
```

- [ ] **Step 2: Add protocol download/open row**

In `renderDownloads()`, add these rows after `Snapshot Manifest`:

```js
${downloadRow("CLE Protocol Page", sitePath("/protocol/"), "Canonical evidence data, hashes, signed manifests, Merkle proofs, local verification, responsible use, and optional proof adapters", false)}
${downloadRow("Snapshot Registry Contract", sitePath("/contracts/SnapshotRegistry.sol"), "Optional adapter prototype for publishing snapshot hashes after local verification", false)}
```

- [ ] **Step 3: Run focused and site QA**

Run:

```bash
npm run test:command-center-protocol
npm run qa:site
```

Expected: PASS. `contracts/SnapshotRegistry.sol` is copied by `scripts/build-static.mjs`, so the proof-prototype link should resolve in both root and `dist`.

## Task 9: Final Verification

**Files:**
- No code files unless verification reveals a scoped issue.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test:command-center-protocol
```

Expected: PASS.

- [ ] **Step 2: Run relevant existing checks**

Run:

```bash
npm run test:auditability
npm run test:workflows
npm run test:release-credibility
npm run qa:content
npm run qa:site
npm run qa:accessibility
npm run qa:render
```

Expected: PASS. If a check fails on unrelated existing dirty files, capture the exact failure and keep fixes scoped to the command-center/protocol changes.

- [ ] **Step 3: Build static output only after focused QA passes**

Run:

```bash
node scripts/build-static.mjs
SITE_ROOT=dist npm run qa:site
SITE_ROOT=dist npm run qa:accessibility
SITE_ROOT=dist npm run qa:render
```

Expected: PASS and `dist/protocol/index.html` exists.

- [ ] **Step 4: Manual browser smoke check**

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:5173/
http://localhost:5173/protocol/
http://localhost:5173/research-workspace/?record_ids=evt_2026_0027&title=Campus%20Evidence%20Lab%20Reporting%20Packet
http://localhost:5173/downloads/
```

Expected:
- Homepage first screen shows search, packet, data, methodology, stats, and Start Here paths.
- Protocol page says blockchain is optional, local verification comes first, and there is no token framing.
- Research workspace packet includes methodology note, limitations, citations/source URLs, snapshot ID/hash, and machine-readable selection.
- Downloads links do not 404.

## Self-Review

- Spec coverage: Homepage command center, user paths, reporting packet, protocol architecture, developer utility roadmap, optional proof-adapter framing, verification surface, tests, and QA are covered.
- Placeholder scan: No unresolved placeholders remain in this plan.
- Type consistency: New helper names are unique and do not conflict with existing functions. New npm script points to the new test file. New `protocol` data-page matches the new `data-nav="protocol"` link. Protocol and contract source directories are both copied by the static build.
- Scope check: The plan stays within static site, packet copy/output, a protocol explainer, and verification links. Production CLI, SDK, API, Merkle generation, signing, and chain publishing remain outside V1, but the page now names them as the protocol direction.
