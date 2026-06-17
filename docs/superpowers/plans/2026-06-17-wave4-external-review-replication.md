# Wave 4 External Review & Replication Packet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a strict public packet that lets outside reviewers inspect certified Gold v1 records, reproduce source-to-record checks, challenge records, and see unresolved limits without trusting Campus Evidence Lab.

**Architecture:** Add one generated artifact, `data/external-review-packet.json`, built from Gold v1 certification status, event/source records, challenge queues, and the review-debt ledger. Publish static pages/docs for the packet, replication guide, challenge templates, known limits, and batch scaling rules; wire the artifact into validation, hashing, release notes, sitemap, QA, and build.

**Tech Stack:** Node ESM scripts, Node test runner, static HTML, JSON artifacts, existing Campus Evidence Lab generation pipeline.

---

### Task 1: External Review Packet Artifact

**Files:**
- Create: `test/external-review-packet.test.mjs`
- Create: `scripts/external-review-packet-lib.mjs`
- Create: `scripts/generate-external-review-packet.mjs`
- Modify: `scripts/lib.mjs`
- Modify: `package.json`

- [ ] Write failing tests that require a 10-25 record packet selected only from certified Gold v1 rows.
- [ ] Include source-to-record verification steps for every packet record.
- [ ] Include reviewer challenge templates and batch review scale guidance.
- [ ] Reject prohibited claims such as outside validation, ranking, prevalence, safety scoring, severity scoring, endorsement, or legal truth.
- [ ] Implement the generator and add it to `prepare:data` and `check`.

### Task 2: Validation, Hashes, Schemas

**Files:**
- Create: `schema/external-review-packet.schema.json`
- Modify: `scripts/validate-data.mjs`
- Modify: `scripts/hash-dataset.mjs`
- Modify: `scripts/generate-release-notes.mjs`

- [ ] Validate that packet records exist in events, sources, Gold v1 status, and review-debt ledger.
- [ ] Validate that packet rows are internally certified and not blocked.
- [ ] Track artifact counts and hash in the snapshot manifest.
- [ ] Mention the packet in release notes without overclaiming.

### Task 3: Public Pages And Docs

**Files:**
- Create: `external-review/index.html`
- Create: `known-limits/index.html`
- Create: `docs/external-review-packet.md`
- Create: `docs/source-to-record-replication-guide.md`
- Create: `docs/reviewer-challenge-templates.md`
- Create: `docs/known-limits-unresolved-records.md`
- Modify: `replicate/index.html`
- Modify: `reviewer-brief/index.html`
- Modify: `downloads/index.html`
- Modify: `docs/data-dictionary.md`

- [ ] Publish the formal packet and link the JSON artifact.
- [ ] Publish source-to-record replication steps for dataset cells, ASRs, OCR aggregate pages, university statements, and news/public notices.
- [ ] Publish challenge templates for source locator, category, affected labels, date precision, response depth, rationale specificity, inclusion, and counterevidence.
- [ ] Publish known limits and unresolved record counts from the review-debt ledger and Gold v1 status.

### Task 4: Site Wiring And Verification

**Files:**
- Modify: `scripts/generate-sitemap.mjs`
- Modify: `scripts/qa-site.mjs`
- Modify: `scripts/build-static.mjs`

- [ ] Add `/external-review/` and `/known-limits/` to sitemap and static deployment copy list.
- [ ] Add new pages, docs, schema, and artifact to site QA.
- [ ] Regenerate artifacts and run `npm run check` and `npm run build`.
