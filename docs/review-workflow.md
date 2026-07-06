# Review Workflow

Campus Evidence Lab uses a public-source-only review workflow. The MVP is designed to run without paid infrastructure: issue templates, static JSON files, validation scripts, and generated hashes are enough to operate the archive carefully.

## Intake

Source submissions must include:

- public source URL
- school name and location when known
- source type
- affected community
- event category
- neutral explanation of relevance

Correction requests must include:

- record ID
- field to correct
- requested correction
- public source URL supporting the correction

Duplicate reports must include:

- primary record ID
- possible duplicate record ID
- neutral explanation of overlap
- public source URL supporting the report

School metadata corrections must include:

- school ID or name
- field to correct
- requested metadata correction
- public source URL supporting the correction

## Triage

Each submission is screened for:

- public accessibility
- relevance to campus civil rights records
- absence of private screenshots, direct messages, private testimony, and sensitive personal information
- source reliability
- duplicate coverage in the existing dataset

## Review Decision

The permitted correction statuses are:

- pending
- accepted
- rejected
- needs_more_evidence

Accepted corrections update:

- affected event record
- event changelog
- event record hash
- event dataset hash
- correction log
- current snapshot manifest

Rejected or incomplete corrections should preserve a short public rationale in `data/corrections.json` once the first real correction request exists.

## Publication Rule

Submitted material from open-web, journalistic, social, private, sensitive, or otherwise non-manifested sources does not become a public event record until a human reviewer confirms that the record is supported by public source material and written in neutral, attributed language.

Approved official structured source families may publish through deterministic import gates at the `imported_public_source` tier. That tier means the record has a public source basis, schema-valid fields, source-family provenance, and explicit limits; it does not mean the record has been individually human-certified. Records can move to `source_family_checked`, `internally_certified`, or `externally_reviewed` only after the corresponding review gate is completed.

## Review Tiers

- `imported_public_source`: imported from a public source family and passed baseline publication gates.
- `source_family_checked`: source-family mapping, locator requirements, duplicate checks, and field-support rules passed.
- `internally_certified`: Campus Evidence Lab completed documented source-to-record certification gates.
- `externally_reviewed`: an outside reviewer or partner reviewed the record or packet under a named scope.

## Files

- `data/review-log.json`: queue status, accepted evidence, exclusions, service standard, and correction decision totals.
- `data/import-manifests.json`: source-family import rules, risk class, default tier, allowed fields, prohibited fields, known limits, and sampling plan.
- `data/corrections.json`: source-backed correction requests and outcomes.
- `data/flagship-report.json`: bounded public evidence infrastructure report with source-linked findings and next-review recommendations.
- `data/gold-record-v1.json`: 25 deterministic review packets for high-value record inspection; packet status is only a workflow label.
- `.github/ISSUE_TEMPLATE/source-submission.yml`: source submission intake template.
- `.github/ISSUE_TEMPLATE/correction-request.yml`: correction intake template.
- `.github/ISSUE_TEMPLATE/duplicate-report.yml`: duplicate report intake template.
- `.github/ISSUE_TEMPLATE/school-metadata-correction.yml`: school metadata correction intake template.
- `schema/correction.schema.json`: correction record schema.
- `schema/review-log.schema.json`: review log schema.
- `schema/import-manifest.schema.json`: import manifest schema.
- `schema/flagship-report.schema.json`: flagship report schema.
- `schema/gold-record-v1.schema.json`: gold v1 review packet schema.

## Gold v1 Review Rule

Gold v1 packets are a bounded first batch for human inspection. Reviewers should use them to check source fit, category language, affected-community labels, confidence rationale, date precision, and response text. Gold v1 must stay inside the published public-claim boundary and should be described only as review packet status.

Contributor-facing instructions are maintained in `docs/contributing.md`.
