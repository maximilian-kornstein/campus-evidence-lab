# Certification Batches

`data/certification-batches.json` divides every record in the certification ledger into source-family review batches.

Batches organize work. They do not certify records by themselves.

The first applied ED review is stored separately in `data/ed-certification-batch-001-review.json`. That artifact freezes its reviewed record set so repeat generation cannot silently advance from Batch 001 into later records.

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
