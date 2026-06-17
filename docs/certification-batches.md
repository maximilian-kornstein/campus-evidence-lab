# Certification Batches

`data/certification-batches.json` divides every record in the certification ledger into source-family review batches.

Batches organize work. They do not certify records by themselves.

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
