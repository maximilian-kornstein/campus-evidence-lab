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

Submitted material does not become a public event record until a human reviewer confirms that the record is supported by public source material and written in neutral, attributed language.

## Files

- `data/review-log.json`: queue status, accepted evidence, exclusions, service standard, and correction decision totals.
- `data/corrections.json`: source-backed correction requests and outcomes.
- `.github/ISSUE_TEMPLATE/source-submission.yml`: source submission intake template.
- `.github/ISSUE_TEMPLATE/correction-request.yml`: correction intake template.
- `.github/ISSUE_TEMPLATE/duplicate-report.yml`: duplicate report intake template.
- `.github/ISSUE_TEMPLATE/school-metadata-correction.yml`: school metadata correction intake template.
- `schema/correction.schema.json`: correction record schema.
- `schema/review-log.schema.json`: review log schema.

Contributor-facing instructions are maintained in `docs/contributing.md`.
