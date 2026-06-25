# Homepage Next-Actions UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish and verify the homepage next-actions UI so visitors immediately know whether to search records, build a packet, download data, review methodology, or inspect protocol verification.

**Architecture:** Preserve the current dirty homepage direction as the implementation baseline. Tighten `index.html`, dashboard rendering in `assets/app.js`, supporting CSS in `assets/styles.css`, and focused QA checks without introducing a new framework or rebranding the site.

**Tech Stack:** Static HTML, vanilla JavaScript modules, CSS, existing Node QA scripts, existing static build script.

---

## Current Dirty Baseline

The implementation starts from existing uncommitted work in:

- `index.html`
- `assets/app.js`
- `assets/styles.css`
- `scripts/qa-render.mjs`
- `scripts/qa-site.mjs`
- `test/review-samples.test.mjs`

Do not revert those changes. Treat them as the draft to polish and verify.

## File Responsibilities

- `index.html`: first-viewport homepage copy and primary hero action links.
- `assets/app.js`: dashboard command center, audience routing, research workspace packet wording, download link additions, and deterministic review-sample rendering.
- `assets/styles.css`: layout and interaction styles for hero actions, command actions, audience paths, and responsive behavior.
- `downloads/index.html`: static protocol links and fallback copy for visitors who do not run JavaScript.
- `scripts/qa-site.mjs`: file/content QA for static source and built `dist`.
- `scripts/qa-render.mjs`: rendered-page text checks for dynamic dashboard and research workspace content.
- `test/review-samples.test.mjs`: focused regression tests for deterministic review-sample ordering if needed.
- `docs/superpowers/specs/2026-06-24-homepage-next-actions-design.md`: approved design spec.
- `docs/superpowers/plans/2026-06-24-homepage-next-actions.md`: this plan.

## Scope Guard

Implement only the homepage next-action pass and directly related destination-copy/QA updates. Do not change the CLE protocol implementation, do not redesign all site pages, do not add a frontend framework, and do not stage generated school pages unless a required generator was intentionally run and reviewed.

## Task 1: Protect The First-Viewport Action Contract

**Files:**
- Modify: `scripts/qa-site.mjs`
- Verify: `index.html`

- [ ] Confirm `index.html` has the four hero action labels:

```html
<a class="button-link button-link--primary" href="events/">Search Records</a>
<a class="button-link" href="research-workspace/?title=Campus%20Evidence%20Lab%20Reporting%20Packet&question=What%20public-source%20records%20support%20this%20reporting%20question%3F">Build Reporting Packet</a>
<a class="button-link" href="downloads/">Download Data</a>
<a class="button-link" href="methodology/">Review Methodology</a>
```

- [ ] Add or keep QA assertions in `scripts/qa-site.mjs`:

```js
for (const homepageCopy of [
  "Public-source civil-rights evidence infrastructure",
  "Search Records",
  "Build Reporting Packet",
  "Download Data",
  "Review Methodology"
]) {
  await mustContain("index.html", homepageCopy);
}
```

- [ ] Run source QA:

```bash
npm run qa:site
```

Expected: PASS, or FAIL only on concrete missing homepage copy that must be restored.

## Task 2: Polish Dashboard Command Center And Audience Routing

**Files:**
- Modify: `assets/app.js`
- Modify: `scripts/qa-render.mjs`

- [ ] Keep the helper functions in `assets/app.js` near dashboard rendering:

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

- [ ] Ensure `renderDashboard()` includes a `command-center` section with:

```js
${commandCenterAction("Search Records", "Find records by school, community, source type, confidence, and verification status.", "/events/")}
${commandCenterAction("Build Reporting Packet", "Generate selected records, source URLs, limitations, citation language, and snapshot metadata.", "/research-workspace/?title=Campus%20Evidence%20Lab%20Reporting%20Packet&question=What%20public-source%20records%20support%20this%20reporting%20question%3F")}
${commandCenterAction("Download Data", "Use CSV, JSON, research exports, manifest, archived snapshot, and schema files.", "/downloads/")}
${commandCenterAction("Review Methodology", "Inspect inclusion rules, confidence language, correction flow, and responsible-use limits.", "/methodology/")}
```

- [ ] Ensure `renderDashboard()` includes a `Start Here` audience section with:

```js
${audiencePath("Journalists", "Search a school, select records, build a reporting packet, and cite the limitations before requesting comment.", "/journalist-guide/")}
${audiencePath("Researchers", "Download snapshot-bound CSV/JSON, read the methodology, and cite the current manifest hash.", "/research-guide/")}
${audiencePath("Contributors", "Submit public sources, corrections, duplicate reports, or school metadata fixes without private evidence.", "/submit/")}
${audiencePath("Reviewers", "Audit sample records, challenge source support, and keep acknowledgment separate from endorsement.", "/reviewer-queue/")}
```

- [ ] Keep or add rendered dashboard checks in `scripts/qa-render.mjs` for:

```js
"Start Here",
"Journalists",
"Researchers",
"Contributors",
"Reviewers",
"Search Records",
"Build Reporting Packet",
"Current Documentation Patterns",
"CLE Protocol"
```

- [ ] Run render QA:

```bash
npm run qa:render
```

Expected: PASS.

## Task 3: Align Research Workspace With The Hero Action

**Files:**
- Modify: `assets/app.js`
- Modify: `scripts/qa-render.mjs`

- [ ] Keep `researchPacket()` wording aligned with the homepage action:

```js
question ? `Reporting or research question: ${question}` : "Reporting or research question: not specified",
"Methodology note:",
"Campus Evidence Lab records summarize public-source documentation. The packet preserves source links, record hashes, snapshot metadata, and conservative use limits so a reporter, researcher, reviewer, or public-interest organization can verify the basis for each record.",
"Limitations:",
"- AI-generated summaries or downstream analysis should not be treated as reviewed unless human-review metadata is present.",
"Source URLs and citations:",
```

- [ ] Keep the Research Workspace heading and note:

```html
<h2 class="section-title">Reporting Packet</h2>
<p class="section-note">Markdown and JSON are generated locally with methodology note, limitations, citations, and snapshot metadata</p>
```

- [ ] Ensure `scripts/qa-render.mjs` checks the research workspace for:

```js
"Reporting Packet",
"Snapshot hash",
"Quick Packet Presets",
"Selection is encoded in the URL"
```

- [ ] Run render QA:

```bash
npm run qa:render
```

Expected: PASS.

## Task 4: Polish Responsive Styling Without Rebranding

**Files:**
- Modify: `assets/styles.css`

- [ ] Keep the primary button style:

```css
.button-link--primary {
  background: var(--ink);
  color: var(--page);
}
```

- [ ] Keep hero action wrapping:

```css
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;
}
```

- [ ] Ensure command actions use stable responsive grid tracks:

```css
.command-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-left: 1px solid var(--line-strong);
  border-bottom: 1px solid var(--line-strong);
}
```

- [ ] Ensure action links do not overflow:

```css
.action-link--command,
.audience-path {
  min-width: 0;
  overflow-wrap: anywhere;
}
```

- [ ] Ensure mobile behavior collapses cleanly:

```css
@media (max-width: 900px) {
  .command-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .command-actions,
  .audience-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] Run accessibility QA:

```bash
npm run qa:accessibility
```

Expected: PASS.

## Task 5: Keep Protocol Visible But Secondary

**Files:**
- Modify: `index.html`
- Modify: `assets/app.js`
- Modify: `downloads/index.html`
- Modify: `scripts/qa-site.mjs`
- Modify: `scripts/qa-render.mjs`

- [ ] Confirm primary nav contains:

```html
<a href="protocol/" data-nav="protocol">Protocol</a>
```

- [ ] Confirm dashboard `Audience Entry Points` includes:

```html
<span>CLE Protocol</span>
<span>See the evidence-integrity layer: canonical hashes, signed manifests, Merkle proofs, local verification, responsible-use checks, and optional chain adapters.</span>
```

- [ ] Confirm downloads dynamic rows include:

```js
${downloadRow("CLE Protocol Page", sitePath("/protocol/"), "Canonical evidence data, hashes, signed manifests, Merkle proofs, local verification, responsible use, and optional proof adapters", false)}
```

- [ ] Add or keep source/render QA checks for `CLE Protocol` and `/protocol/`.

- [ ] Run:

```bash
npm run qa:site
npm run qa:render
```

Expected: PASS.

## Task 6: Stabilize Review Sample Ordering If Needed

**Files:**
- Modify: `assets/app.js`
- Modify: `test/review-samples.test.mjs`

- [ ] Preserve deterministic sample ordering in `reviewSampleTable()`:

```js
${[...sample.records]
  .sort((a, b) => b.date.localeCompare(a.date) || a.event_id.localeCompare(b.event_id))
  .map((row) => {
    const record = recordById.get(row.event_id);
    return `
```

- [ ] Keep or add a focused regression test in `test/review-samples.test.mjs` that asserts rendered review-sample rows are date-descending when dates differ and event-id ascending when dates match.

- [ ] Run:

```bash
npm run test:review-operations
```

Expected: PASS.

## Task 7: Full Source And Dist Verification

**Files:**
- Verify all files modified in this pass.

- [ ] Run source checks:

```bash
npm run qa:site
npm run qa:accessibility
npm run qa:render
npm run test:review-operations
```

Expected: all PASS.

- [ ] Build static output:

```bash
node scripts/build-static.mjs
```

Expected: `Built static deployment output in dist/`.

- [ ] Run `dist` checks:

```bash
SITE_ROOT=dist npm run qa:site
SITE_ROOT=dist npm run qa:accessibility
SITE_ROOT=dist npm run qa:render
```

Expected: all PASS.

## Task 8: Commit Only The Intended UI Scope

**Files to stage if changed intentionally:**
- `index.html`
- `assets/app.js`
- `assets/styles.css`
- `downloads/index.html`
- `scripts/qa-site.mjs`
- `scripts/qa-render.mjs`
- `test/review-samples.test.mjs`
- `docs/superpowers/specs/2026-06-24-homepage-next-actions-design.md`
- `docs/superpowers/plans/2026-06-24-homepage-next-actions.md`

- [ ] Inspect status:

```bash
git status --short
```

Expected: many unrelated dirty files may exist. Do not stage them.

- [ ] Stage only intended UI scope files:

```bash
git add index.html assets/app.js assets/styles.css downloads/index.html scripts/qa-site.mjs scripts/qa-render.mjs test/review-samples.test.mjs docs/superpowers/specs/2026-06-24-homepage-next-actions-design.md docs/superpowers/plans/2026-06-24-homepage-next-actions.md
```

- [ ] Commit:

```bash
git commit -m "feat: clarify homepage next actions"
```

## Self-Review

- Spec coverage: first viewport, command center, audience routing, research workspace packet copy, protocol visibility, responsive behavior, QA, and staging safety are all mapped to tasks.
- Scope guard: no protocol implementation, no rebrand, no framework migration, no generated school page staging.
- Placeholder scan: no placeholder instructions remain.
