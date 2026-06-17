# Whole-Database Review Debt Ledger

`data/review-debt-ledger.json` makes review debt inspectable for every Campus Evidence Lab record.

The ledger is generated from:

- canonical event records
- linked source metadata
- live source-audit status
- record-quality audit issues
- deterministic source-family grouping

It is not manual source-to-record certification. It is not outside validation, endorsement, school ranking, prevalence measurement, safety scoring, severity scoring, or a legal finding.

## Debt Statuses

- `blocked`: a source or locator blocker is present; repair before external routing.
- `high_review_debt`: a high-priority source, category, date, or rationale issue needs internal review.
- `medium_review_debt`: the record is usable only with visible review notes and source-bound limits.
- `low_review_debt`: a lower-priority deterministic issue remains.
- `lower_priority_review_debt`: no deterministic issue was detected, but the record is not manually certified by this ledger.

## Source Families

The ledger groups records by review-relevant source family:

- ED campus-safety datasets
- Annual security reports
- Public safety notices
- OCR or ED release pages
- Government guidance
- Government case or letter sources
- University statements
- News reports
- Mixed or other public sources

This helps reviewers work in source-family batches instead of treating all records as if they need the same kind of repair.

## Queues

The ledger exposes deterministic queues for:

- blocked records
- dataset locator debt
- ASR or public-notice locator debt
- OCR or aggregate item debt
- affected-label boundary debt
- rationale debt
- date precision debt
- category-fit debt
- response-depth debt

Queue membership means a record deserves review. It does not mean the record is false, severe, representative, or more important than records outside the queue.

## Safe Repair Policy

The Wave 3 ledger does not mass-certify records or mass-rewrite facts. It applies deterministic status and queue assignment only.

Mass record edits are deferred when they would require source-specific judgment, including:

- dataset workbook, sheet, row, column, or cell locators
- ASR page, table, section, or item locators
- OCR aggregate item dates
- broad affected-community labels
- direct institutional-response wording

Those repairs should happen in bounded source-family batches with source-to-record evidence visible in the changed record.
