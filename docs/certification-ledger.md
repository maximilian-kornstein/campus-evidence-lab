# Certification Ledger

`data/certification-ledger.json` assigns every record a strict internal certification status:

- `certified`: every gate passes and an explicit certification basis exists.
- `not_certified`: a bounded review found that one or more gates still do not pass.
- `blocked`: a source or locator blocker prevents certification.
- `awaiting_review`: one or more gates still need source-to-record review.

The ledger is generated from event records, source metadata, record-quality audit rows, the review-debt ledger, Gold v1 certification status, and explicit bounded batch-review artifacts such as the ED certification review waves and source-family certification pilots. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

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

## Current Ledger Counts

After applying Gold v1, the first sixteen frozen ED review artifacts, and source-family certification review 001, the ledger currently reports:

- 4,000 total records
- 3,810 certified
- 8 not certified
- 44 blocked
- 138 awaiting review

These counts describe internal source-to-record certification status, not external validation or campus quality.

## ED Batch Reviews

`data/ed-certification-batch-001-review.json` applies source-cell locators to a frozen first ED dataset batch:

- 250 records reviewed
- 249 certified
- 1 blocked

The blocked record is not certified because the workbook locator remains ambiguous. Batch 001 is frozen so repeat generation cannot silently certify the next batch.

`data/ed-certification-batch-002-review.json` applies the same gate standard to a second frozen ED dataset review wave:

- 250 records reviewed
- 250 certified
- 0 blocked

`data/ed-certification-batch-003-review.json` applies the same gate standard to a third frozen ED dataset review wave:

- 250 records reviewed
- 247 certified
- 3 blocked

`data/ed-certification-batch-004-review.json` applies the same gate standard to a fourth frozen ED dataset review wave:

- 250 records reviewed
- 247 certified
- 3 blocked

`data/ed-certification-batch-005-review.json` applies the same gate standard to a fifth frozen ED dataset review wave:

- 250 records reviewed
- 246 certified
- 4 blocked

`data/ed-certification-batch-006-review.json` applies the same gate standard to a sixth frozen ED dataset review wave:

- 250 records reviewed
- 242 certified
- 8 blocked

`data/ed-certification-batch-007-review.json` applies the same gate standard to a seventh frozen ED dataset review wave:

- 250 records reviewed
- 244 certified
- 6 blocked

`data/ed-certification-batch-008-review.json` applies the same gate standard to an eighth frozen ED dataset review wave:

- 250 records reviewed
- 248 certified
- 2 blocked

`data/ed-certification-batch-009-review.json` applies the same gate standard to a ninth frozen ED dataset review wave:

- 250 records reviewed
- 242 certified
- 8 blocked

`data/ed-certification-batch-010-review.json` applies the same gate standard to a tenth frozen ED dataset review wave:

- 250 records reviewed
- 250 certified
- 0 blocked

`data/ed-certification-batch-011-review.json` applies the same gate standard to an eleventh frozen ED dataset review wave:

- 250 records reviewed
- 247 certified
- 3 blocked

`data/ed-certification-batch-012-review.json` applies the same gate standard to a twelfth frozen ED dataset review wave:

- 250 records reviewed
- 249 certified
- 1 blocked

`data/ed-certification-batch-013-review.json` applies the same gate standard to a thirteenth frozen ED dataset review wave:

- 250 records reviewed
- 250 certified
- 0 blocked

`data/ed-certification-batch-014-review.json` applies the same gate standard to a fourteenth frozen ED dataset review wave:

- 250 records reviewed
- 249 certified
- 1 blocked

`data/ed-certification-batch-015-review.json` applies the same gate standard to a fifteenth frozen ED dataset review wave:

- 250 records reviewed
- 248 certified
- 2 blocked

`data/ed-certification-batch-016-review.json` applies the same gate standard to a sixteenth frozen ED dataset review wave:

- 86 records reviewed
- 85 certified
- 1 blocked

After Batch 016, the ED Campus Safety dataset source family has no awaiting-review rows in the certification ledger. It has 3,802 certified rows and 43 blocked rows. The blocked rows remain unresolved rather than certified.

Matched source-cell provenance is necessary but not sufficient. ED records still need date precision, category fit, affected-label boundary, response-depth, rationale-specificity, and overclaim-risk gates to pass before certification.

## Source-Family Review 001

`data/source-family-certification-review-001.json` applies the same gate standard to a bounded non-ED university-statement pilot:

- 2 records reviewed
- 1 certified
- 1 not certified

The not-certified record remains unresolved because the verified source text did not support every stored affected-community label at the same specificity.

## Public Use

Use the ledger to inspect what is certified, not certified, blocked, or awaiting review. Do not describe the full database as manually certified.
