# Certification Ledger

`data/certification-ledger.json` assigns every record a strict internal certification status:

- `certified`: every gate passes and an explicit certification basis exists.
- `not_certified`: a bounded review found that one or more gates still do not pass.
- `blocked`: a source or locator blocker prevents certification.
- `awaiting_review`: one or more gates still need source-to-record review.

The ledger is generated from event records, source metadata, record-quality audit rows, the review-debt ledger, Gold v1 certification status, and explicit bounded batch-review artifacts such as ED Certification Batch 001. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

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

## ED Batch 001 Review

`data/ed-certification-batch-001-review.json` applies source-cell locators to a frozen first ED dataset batch:

- 250 records reviewed
- 249 certified
- 1 blocked

The blocked record is not certified because the workbook locator remains ambiguous. Batch 001 is frozen so repeat generation cannot silently certify the next batch.

Matched source-cell provenance is necessary but not sufficient. ED records still need date precision, category fit, affected-label boundary, response-depth, rationale-specificity, and overclaim-risk gates to pass before certification.

## Public Use

Use the ledger to inspect what is certified, not certified, blocked, or awaiting review. Do not describe the full database as manually certified.
