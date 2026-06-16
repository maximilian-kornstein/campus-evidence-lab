# Adversarial Review Protocol Design

## Purpose

Campus Evidence Lab should become harder to dismiss by making its records openly challengeable. The next wave should publish a structured adversarial review protocol: every important record claim can be challenged, each challenge type has a public decision standard, and accepted challenges leave a public correction or no-change trail.

The goal is not to claim authority, prevalence, severity, institutional safety, or endorsement. The goal is to make the evidence system falsifiable, reviewable, and corrigible.

## Core Principle

Campus Evidence Lab does not ask reviewers to trust the archive as an authority. It publishes the structure by which records can be challenged, corrected, and reproduced.

## Audiences

- Admissions and external reviewers who need to see methodological seriousness quickly.
- Journalists who need to understand what a record can and cannot support.
- Organizations evaluating whether the archive can handle critique responsibly.
- Researchers and public users who need a practical way to inspect weak or ambiguous records.
- Contributors who want to submit corrections without guessing what evidence is useful.

## Product Surface

### Challenge Arena

Add a public `/challenge/` page that explains the adversarial review protocol and surfaces deterministic challenge queues. The page should emphasize that challenge queues are not rankings, prevalence estimates, severity scores, or institutional safety judgments.

The page should include:

- summary counts for open challenge queues
- links to generated data artifacts
- explanation of challenge types
- links to methodology, codebook, evidence capsules, reviewer queues, corrections, and contribution rules
- a small set of featured challenge packets

### Challenge Packets

Generate deterministic challenge packets for a bounded first batch of 50 to 100 records. Each packet should be a static public page or generated data row that gives reviewers enough structure to challenge the record without needing to inspect the whole database first.

Each packet should include:

- event ID, school, category, confidence, date precision, and response-depth label
- source IDs and source types
- evidence-capsule link or embedded evidence summary
- challenge types applicable to the record
- exact review questions
- what counterevidence could change the record
- possible outcomes
- public claim limits
- issue-template or submission packet link

### Challenge Standards

Create a public machine-readable standards artifact, `data/challenge-standards.json`, with a matching schema. Standards should define the evidence threshold for each challenge type.

Initial challenge types:

- `category_challenge`: source material may not support the assigned event category.
- `affected_community_challenge`: affected-community labels may be broader than the source supports.
- `confidence_challenge`: confidence may be too high or too low for the source basis.
- `date_precision_challenge`: day, month, or year precision may exceed what sources support.
- `institutional_response_challenge`: response text or response-depth label may be incomplete or overstated.
- `legal_status_challenge`: legal, OCR, procedural, or administrative status may be outdated or imprecise.
- `source_sufficiency_challenge`: the record may need another source, a better locator, or narrower language.
- `inclusion_challenge`: the record may not satisfy the public-source inclusion rule.

Each standard should define:

- standard ID
- public label
- applies when
- acceptable counterevidence
- insufficient counterevidence
- possible outcomes
- fields that may change
- public no-overclaiming warning

### Adversarial Queues

Create `data/challenge-queues.json` with deterministic queues derived from existing evidence capsules, robustness metrics, review samples, and evidence-depth queues.

Initial queues:

- `single_source_high_priority`: single-source records where additional support would most improve reviewability.
- `broad_label_challenges`: records with broad or sensitive affected-community/category labels that deserve label-boundary review.
- `response_depth_challenges`: records where public institutional response text or response-depth label needs stronger review.
- `confidence_rationale_challenges`: records where confidence lacks explicit rationale.
- `dataset_locator_challenges`: records imported from dataset cells that need clearer cell-level provenance.
- `legal_status_challenges`: records with legal/OCR/procedural language that should be checked for precision.
- `gold_record_candidates`: records worth upgrading into fully argued gold records.

Queues must be deterministic and must include reason codes. They must not imply severity, prevalence, institutional risk, or ranking.

### Challenge Ledger

Add an initially small `data/challenge-ledger.json` artifact with schema and validation. The ledger should make challenge outcomes inspectable without requiring a live submission system.

Initial statuses:

- `draft_packet`
- `open_for_review`
- `under_review`
- `accepted`
- `partially_accepted`
- `rejected`
- `needs_more_evidence`
- `closed_no_change`

Each ledger entry should include:

- challenge ID
- target event ID
- challenge type
- status
- submitted evidence summary or internal seed reason
- decision summary
- resulting correction IDs
- resulting event IDs
- updated at date
- public limitations

For wave one, the ledger can contain seed entries only, such as open challenge packets and any already documented correction examples. It must not fabricate external submissions or endorsements.

### Gold Record Court

Add a bounded gold-record expansion path. This should not try to upgrade hundreds of records at once. Select 10 to 25 candidates from the challenge queues and make the path explicit:

- source-by-source field support
- classification rationale
- community-label rationale
- confidence rationale
- institutional-response rationale
- alternate interpretations considered
- what evidence would change the record
- public claim limits

Wave one can create the structure and candidate queue without fully upgrading all candidates.

## Data Flow

1. Load canonical events, schools, sources, evidence capsules, robustness metrics, and evidence-depth queues.
2. Build challenge standards from curated static definitions.
3. Prioritize records only for review workflow order, not severity or risk.
4. Generate deterministic challenge queues with reason codes.
5. Generate bounded challenge packets from the highest-priority queue intersections.
6. Validate artifacts against schemas.
7. Include challenge artifacts in dataset hashing and release notes.
8. Render `/challenge/` and link challenge affordances from relevant public pages.

## Validation And Guardrails

Validation should fail if:

- challenge artifacts reference missing events, sources, standards, or correction IDs
- queues use unsupported challenge types
- public text implies endorsement, institutional safety, prevalence, ranking, severity, or legal findings
- queue labels include score-like language such as "worst", "best", "most dangerous", or "safest"
- generated packets lack public claim limits
- accepted or rejected ledger entries lack a decision summary

Content-safety QA should scan challenge pages and artifacts for overclaiming language.

## Testing

Add focused unit tests for:

- challenge standard shape and allowed outcomes
- queue determinism
- reason-code generation
- packet generation from evidence capsules
- no-overclaiming text checks
- ledger status transitions and required fields

Add integration checks for:

- schema validation
- hash-manifest inclusion
- release-note inclusion
- site route existence
- challenge page links to artifacts and methodology
- static build and accessibility/render QA

## Scope Boundaries

Wave one should not add:

- live moderation
- anonymous public submissions stored in the repo
- claims that CLE has been externally audited
- severity scoring
- safety scoring
- rankings of schools
- prevalence estimates
- automated fact-finding beyond existing public-source artifacts

Wave one should add a serious static protocol that can later support GitHub issue workflows, external reviewer acknowledgments, and live challenge intake.

## Success Criteria

The wave is successful if a serious outside reviewer can answer:

- Which records most need adversarial review?
- What exactly can be challenged?
- What evidence would change CLE's mind?
- What happens when a challenge is accepted?
- Where are outcomes recorded?
- How does this avoid rankings, severity claims, and institutional safety judgments?

It should also make CLE visibly unusual: a student-built evidence archive that publishes its own attack surface and correction standards.

## Recommended Implementation Slice

The safest first implementation slice is:

1. Add challenge standards schema and artifact.
2. Add challenge queue generator and tests.
3. Generate 50 to 100 challenge packets.
4. Add challenge ledger schema and seed ledger.
5. Add public `/challenge/` page.
6. Add record-level "Challenge this record" links only where packet data exists.
7. Integrate validation, hash checks, release notes, downloads, sitemap, and QA.
8. Run full `npm run check` and `npm run build`.

This gives CLE the credibility benefit without pretending to operate a live adjudication process before the workflow is ready.
