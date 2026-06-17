# Certification Ledger

`data/certification-ledger.json` assigns every record a strict internal certification status:

- `certified`: every gate passes and an explicit certification basis exists.
- `not_certified`: a bounded review found that one or more gates still do not pass.
- `blocked`: a source or locator blocker prevents certification.
- `awaiting_review`: one or more gates still need source-to-record review.

The ledger is generated from event records, source metadata, record-quality audit rows, the review-debt ledger, and Gold v1 certification status. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

## Gates

Each row includes gate detail for:

- source availability
- source locator specificity
- institution support
- date precision support
- category fit
- affected-label boundary
- response-depth classification
- rationale specificity
- overclaim risk

## Batch 001

Batch 001 is a bounded ED Campus Safety dataset provenance pilot. It intentionally keeps records awaiting review when workbook, sheet, row, column, or cell provenance is missing. This prevents mass certification of dataset-backed records before source-to-cell support is explicit.

## Public Use

Use the ledger to inspect what is certified, not certified, blocked, or awaiting review. Do not describe the full database as manually certified.
