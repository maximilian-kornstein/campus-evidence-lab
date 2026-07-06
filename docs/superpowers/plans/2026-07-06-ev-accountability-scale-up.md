# EV Accountability Scale-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a public, inspectable 40,000-record Campus Evidence Lab release within two months while preserving clear quality boundaries and institution-facing correction/right-of-reply channels.

**Architecture:** Keep Campus Evidence Lab static-first and public-source-only, but move the public claim model from "every record is human-certified" to explicit review tiers. Canonical JSON artifacts remain the source of truth; generated pages, exports, snapshots, dossiers, and public proof packets are derived from those artifacts with deterministic validation, overclaim checks, hashes, and release notes.

**Tech Stack:** Node.js ESM scripts, `node:test`, JSON Schema, static HTML generation, GitHub issue templates, GitHub Pages or Cloudflare Pages, public-source datasets, deterministic snapshot hashing.

---

## File Responsibilities

- `docs/superpowers/plans/2026-07-06-ev-accountability-scale-up.md`: this two-month scale-up implementation plan.
- `docs/legal-drafting-prompts.md`: Claude prompts for first-pass legal/trust document drafting.
- `docs/terms-of-use.md`: future source draft for the public terms page.
- `docs/privacy-policy.md`: future source draft for public privacy disclosures.
- `docs/data-license-addendum.md`: future source draft clarifying dataset reuse boundaries beyond `DATA_LICENSE.md`.
- `docs/submission-terms.md`: future source draft for public-source submissions and contribution license.
- `docs/corrections-and-right-of-reply-policy.md`: future source draft for corrections, institutional responses, and right-of-reply handling.
- `docs/responsible-use.md`: future source draft for dataset use limits, no-ranking rules, and source-review expectations.
- `docs/ai-use-disclosure.md`: future source draft for AI-assisted extraction, summarization, and review boundaries.
- `docs/takedown-and-redaction-policy.md`: future source draft for private information, source removal, copyright, and safety escalations.
- `docs/reviewer-agreement.md`: future source draft for reviewer neutrality, conflicts, and public-source-only review.
- `docs/methodology.md`: existing methodology; update only when review tiers or public claims change.
- `docs/review-workflow.md`: existing review workflow; update to describe tiered publication and institution response handling.
- `docs/content-safety.md`: existing content safety rules; update when redaction/takedown policy adds new gates.
- `docs/contributing.md`: existing contribution guide; update after submission terms and issue templates are approved.
- `.github/ISSUE_TEMPLATE/*.yml`: public GitHub intake templates; update after legal/trust docs are approved.
- `data/events.json`: canonical event records; scale target is around 40,000 public-source records.
- `data/sources.json`: canonical source records; must grow with source-family provenance and import manifests.
- `data/review-log.json`: public review status summary; must expose tier counts without overclaiming.
- `schema/event.schema.json`: event schema; add review-tier fields only after tests define their behavior.
- `schema/review-log.schema.json`: review log schema; add tier-count validation after the tier model is defined.
- `scripts/*`: import, validation, hashing, page generation, sitemap, release notes, and QA scripts.
- `test/*.test.mjs`: focused `node:test` coverage for review tiers, quality gates, import manifests, overclaim language, performance, and generated pages.

## Review Tier Model

Not every record will be human-certified before publication. Public quality comes from making that fact explicit, testing it, and refusing to let lower-tier records carry higher-tier claims.

The release should use four public review tiers:

- `imported_public_source`: record was imported from a public source family, has required source metadata, passes schema/content-safety gates, and is published with clear limits.
- `source_family_checked`: source-family mapping, required locator fields, institution/date/category/affected-community support, and duplicate checks passed for the source family.
- `internally_certified`: record cleared documented internal source-to-record gates and has no open deterministic blockers.
- `externally_reviewed`: a qualified outside reviewer or documented partner reviewed the record or packet under a named scope.

Quality rules:

- A lower tier can be public, but its page and exports must display the tier and limitations.
- No record can imply legal liability, official truth, school safety, prevalence, severity, institutional quality, external validation, or endorsement.
- Every public record must be source-backed, attributed, hashable, correctable, and removable/redactable if it violates privacy or safety rules.
- Institution-facing accountability should be concrete: response-depth status, correction/right-of-reply link, public source basis, and known limits.

## Two-Month Milestones

### July 6-12: Trust, Legal, And Claim Boundaries

- Write strict first-pass drafts for terms, privacy, data license addendum, submission terms, corrections/right-of-reply, responsible use, AI use, takedown/redaction, and reviewer agreement.
- Decide which documents become generated public pages and which remain repository governance docs.
- Update public claim vocabulary so scale language never implies every record is human-certified.
- Define review-tier fields, labels, allowed copy, and prohibited claims.
- Produce a short attorney-review packet from the drafts if budget allows.

### July 13-26: 40k-Ready Ingestion And Data Quality

- Add import-manifest artifacts per source family.
- Add deterministic ID, duplicate, source-family, and locator checks for large imports.
- Add source-family gates for institution support, date precision, category fit, affected-community label support, response-depth classification, and source availability.
- Load-test 10k, 25k, and 40k record datasets.
- Ensure `npm run check` or a focused release gate catches missing sources, unknown schools, invalid tiers, duplicate IDs, prohibited claims, and broken generated links.

### July 27-August 9: Accountability Dossiers

- Rework school pages into accountable but bounded dossiers: timeline, source basis, response-depth status, review tier counts, unresolved issues, correction/right-of-reply entry point, and citation packet.
- Add institution response queues for missing, limited, agency-described, and direct responses.
- Generate public research exports that include review tier, source-family, confidence, response-depth, known limits, and snapshot hash.
- Keep school pages from becoming rankings by excluding comparative score language and by showing coverage limits.

### August 10-23: Review Operations

- Build queues for imported-but-unchecked records, weak locators, broad affected-community labels, missing/limited institutional responses, source-audit follow-ups, and duplicate candidates.
- Add public review-tier summaries to `data/review-log.json` and generated quality pages.
- Add reviewer packets by source family and by high-impact institution response gaps.
- Add correction/right-of-reply tracking so institutional responses become public artifacts rather than private inbox state.

### August 24-September 6: Public Proof Release

- Build and verify the public site, public repository, release notes, snapshot manifest, data exports, sitemap, legal/trust pages, review-tier summaries, and school dossiers.
- Publish a Tyler Cowen / Emergent Ventures progress memo with shipped artifacts, live URLs, methodology limits, current record counts, review-tier counts, and the next accountability release target.
- Run the full local release gate before public deployment.
- Run the public verifier against the live URL after deployment.

## Task 1: Draft Legal And Trust Documents

**Files:**
- Create: `docs/legal-drafting-prompts.md`
- Later create from reviewed output: `docs/terms-of-use.md`
- Later create from reviewed output: `docs/privacy-policy.md`
- Later create from reviewed output: `docs/data-license-addendum.md`
- Later create from reviewed output: `docs/submission-terms.md`
- Later create from reviewed output: `docs/corrections-and-right-of-reply-policy.md`
- Later create from reviewed output: `docs/responsible-use.md`
- Later create from reviewed output: `docs/ai-use-disclosure.md`
- Later create from reviewed output: `docs/takedown-and-redaction-policy.md`
- Later create from reviewed output: `docs/reviewer-agreement.md`

- [ ] **Step 1: Generate each document separately in Claude**

Use one prompt at a time from `docs/legal-drafting-prompts.md`. Each Claude response must be a strict draft only: no bracket placeholders, no comments to the user, no alternative clauses, no explanatory preface, and no "consult a lawyer" boilerplate inside the document body unless the relevant policy section calls for professional review.

- [ ] **Step 2: Save each Claude draft as a source document**

Create the nine files listed above. Keep each document in Markdown with one `#` title and production-ready prose. Do not add public navigation links until the documents pass review.

- [ ] **Step 3: Run placeholder and overclaim scan**

Run:

```bash
rg -n "TODO|TBD|\\[|\\]|insert|placeholder|ranking|ranked|safest|unsafe|legal finding|verified by outsiders|endorsed|prevalence score|severity score" docs/terms-of-use.md docs/privacy-policy.md docs/data-license-addendum.md docs/submission-terms.md docs/corrections-and-right-of-reply-policy.md docs/responsible-use.md docs/ai-use-disclosure.md docs/takedown-and-redaction-policy.md docs/reviewer-agreement.md
```

Expected: no placeholder hits. Any legitimate use-limit wording that mentions prohibited terms must be reviewed manually and rewritten if it could be misunderstood as a project claim.

- [ ] **Step 4: Commit strict drafts**

Run:

```bash
git add docs/legal-drafting-prompts.md docs/terms-of-use.md docs/privacy-policy.md docs/data-license-addendum.md docs/submission-terms.md docs/corrections-and-right-of-reply-policy.md docs/responsible-use.md docs/ai-use-disclosure.md docs/takedown-and-redaction-policy.md docs/reviewer-agreement.md
git commit -m "docs: draft legal and trust documents"
```

## Task 2: Define Review Tiers In Tests

**Files:**
- Create: `test/review-tier-model.test.mjs`
- Create: `scripts/review-tier-model-lib.mjs`
- Modify: `schema/event.schema.json`
- Modify: `schema/review-log.schema.json`

- [ ] **Step 1: Write failing tier-order tests**

Test that only the four allowed tiers are accepted and that `externally_reviewed` is higher than `internally_certified`, which is higher than `source_family_checked`, which is higher than `imported_public_source`.

- [ ] **Step 2: Write failing public-claim tests**

Test that lower-tier records cannot generate copy implying human certification, external review, endorsement, ranking, school safety, prevalence, severity, or legal liability.

- [ ] **Step 3: Run focused tests**

Run:

```bash
node --test test/review-tier-model.test.mjs
```

Expected before implementation: fail because the review-tier model module does not exist.

- [ ] **Step 4: Implement the minimal tier model**

Implement allowed tier constants, tier ordering, display labels, concise limitations, and prohibited-claim checks in `scripts/review-tier-model-lib.mjs`.

- [ ] **Step 5: Update schemas**

Add optional `review_tier` validation to `schema/event.schema.json` and tier-count validation to `schema/review-log.schema.json`.

- [ ] **Step 6: Verify and commit**

Run:

```bash
node --test test/review-tier-model.test.mjs
git add test/review-tier-model.test.mjs scripts/review-tier-model-lib.mjs schema/event.schema.json schema/review-log.schema.json
git commit -m "feat: define public review tiers"
```

## Task 3: Add 40k Import Manifests And Quality Gates

**Files:**
- Create: `schema/import-manifest.schema.json`
- Create: `scripts/import-manifest-lib.mjs`
- Create: `test/import-manifest.test.mjs`
- Modify: `scripts/validate-data.mjs`
- Modify: `scripts/hash-dataset.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing manifest coverage tests**

Test that every imported source family has a manifest with source URL, acquisition date, row count, importer command, field map, review-tier default, known limits, and duplicate strategy.

- [ ] **Step 2: Write failing quality-gate tests**

Test that release validation rejects missing source IDs, duplicate event IDs, unknown school IDs, invalid review tiers, missing source-family metadata, and prohibited public claims.

- [ ] **Step 3: Implement manifest generation and validation**

Add import-manifest helpers and wire manifest validation into `scripts/validate-data.mjs`.

- [ ] **Step 4: Add scale test fixtures**

Add generated test fixtures that simulate 10k, 25k, and 40k event rows without committing large fixture files.

- [ ] **Step 5: Verify and commit**

Run:

```bash
node --test test/import-manifest.test.mjs
npm run validate:data
git add schema/import-manifest.schema.json scripts/import-manifest-lib.mjs test/import-manifest.test.mjs scripts/validate-data.mjs scripts/hash-dataset.mjs package.json
git commit -m "feat: add import manifests and scale quality gates"
```

## Task 4: Build Accountability Dossier Pages

**Files:**
- Modify: `scripts/generate-pages.mjs`
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/qa-site.mjs`
- Modify: `scripts/qa-render.mjs`
- Modify: `assets/styles.css`
- Generate: `schools/*/index.html`

- [ ] **Step 1: Write failing static and render QA**

Add checks that school pages include review tier counts, source-backed timeline, response-depth summary, known limits, correction/right-of-reply link, and citation packet link.

- [ ] **Step 2: Implement dossier sections**

Generate bounded accountability sections for every school page. Use "documented public records" language, not rankings, scores, or accusations.

- [ ] **Step 3: Verify generated pages**

Run:

```bash
npm run pages:data
npm run sitemap:data
npm run qa:site
npm run qa:render
```

- [ ] **Step 4: Commit generated source changes**

Commit generator, QA, CSS, and generated page updates together after checking diff size and generated-page churn.

## Task 5: Build Review Operations Queues

**Files:**
- Create: `scripts/review-tier-queues-lib.mjs`
- Create: `scripts/generate-review-tier-queues.mjs`
- Create: `schema/review-tier-queues.schema.json`
- Create: `test/review-tier-queues.test.mjs`
- Generate: `data/review-tier-queues.json`
- Modify: `package.json`
- Modify: `scripts/generate-pages.mjs`

- [ ] **Step 1: Write failing queue tests**

Test queues for imported unchecked records, weak locators, broad affected-community labels, missing or limited institutional responses, source-audit follow-ups, and duplicate candidates.

- [ ] **Step 2: Implement deterministic queue generation**

Generate queue rows with event ID, school ID, source family, current tier, issue reason, next action, and public packet link where applicable.

- [ ] **Step 3: Generate public quality view**

Add a review-tier queue section to the quality or review-debt public page.

- [ ] **Step 4: Verify and commit**

Run:

```bash
node --test test/review-tier-queues.test.mjs
npm run prepare:data
npm run qa:site
git add scripts/review-tier-queues-lib.mjs scripts/generate-review-tier-queues.mjs schema/review-tier-queues.schema.json test/review-tier-queues.test.mjs data/review-tier-queues.json package.json scripts/generate-pages.mjs
git commit -m "feat: add review tier operations queues"
```

## Task 6: Release Proof Package

**Files:**
- Modify: `PUBLIC_LAUNCH.md`
- Modify: `README.md`
- Modify: `RELEASE_NOTES.md`
- Modify: `docs/methodology.md`
- Modify: `docs/review-workflow.md`
- Modify: `docs/content-safety.md`
- Modify: `docs/contributing.md`
- Modify: generated public pages and data artifacts

- [ ] **Step 1: Update release language**

Document the tiered review model, quality gates, 40k-scale limits, correction process, and institution right-of-reply path.

- [ ] **Step 2: Build full release**

Run:

```bash
npm run build
```

Expected: build succeeds and generated `dist/` passes site, accessibility, and render QA.

- [ ] **Step 3: Verify public launch commands**

Run:

```bash
npm run launch:preflight
```

Expected: passes once the public remote and deployment settings are configured.

- [ ] **Step 4: Commit release package**

Stage only intended source, generated artifacts, and docs. Commit with:

```bash
git commit -m "feat: publish EV accountability scale-up release"
```

## Self-Review Notes

- Spec coverage: the plan covers legal/trust docs, tiered review, 40k ingestion, quality gates, accountable school dossiers, review queues, and public proof release.
- Placeholder scan: this plan intentionally avoids `TBD`, `TODO`, bracket placeholders, and "implement later" phrasing.
- Scope boundary: this is an umbrella plan. Each task can be executed and committed independently, with the legal/trust prompt pack as the immediate first step.
