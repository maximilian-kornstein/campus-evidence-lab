# Certification Batches

`data/certification-batches.json` divides every record in the certification ledger into source-family review batches.

Batches organize work. They do not certify records by themselves.

The first sixteen applied ED reviews are stored separately in:

- `data/ed-certification-batch-001-review.json`
- `data/ed-certification-batch-002-review.json`
- `data/ed-certification-batch-003-review.json`
- `data/ed-certification-batch-004-review.json`
- `data/ed-certification-batch-005-review.json`
- `data/ed-certification-batch-006-review.json`
- `data/ed-certification-batch-007-review.json`
- `data/ed-certification-batch-008-review.json`
- `data/ed-certification-batch-009-review.json`
- `data/ed-certification-batch-010-review.json`
- `data/ed-certification-batch-011-review.json`
- `data/ed-certification-batch-012-review.json`
- `data/ed-certification-batch-013-review.json`
- `data/ed-certification-batch-014-review.json`
- `data/ed-certification-batch-015-review.json`
- `data/ed-certification-batch-016-review.json`

The first bounded non-ED source-family review is stored separately in:

- `data/source-family-certification-review-001.json`

Each artifact freezes its reviewed record set so repeat generation cannot silently advance a completed review wave into later records.

## Completion Rule

A batch is complete only when every included record has a final visible status and exact open gates. A batch can complete with zero newly certified records when public sources do not support certification.

## Review Lanes

- blocked/problem records
- ED dataset records
- annual security report records
- OCR or government release records
- university statement records
- public notice or news-like records
- other public-source records

## Public-Use Boundary

Batch manifests must not be described as external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

Batch-review artifacts may create certification basis only when every gate passes under the named rule version. A matched source locator alone is not enough.

Batch 001 through Batch 016 and source-family review 001 use separate certification bases. Future source-family review waves should add new named artifacts rather than rewriting an older wave to cover new records.
