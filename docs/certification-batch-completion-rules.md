# Certification Batch Completion Rules

Standard version: `certification_rules_v1`

The purpose of batching is to make strict review tractable without overstating certainty. Batch membership is a workflow label, not certification.

## Completion Standard

A certification batch is complete only when every included record has one final visible status:

- `certified`
- `not_certified`
- `blocked`
- `awaiting_review`

Each record must also retain exact open gates, issue ids, review links, and next action. A batch may complete with zero newly certified records when source evidence does not support certification.

## Source-Family Lanes

Records are divided into these review lanes:

- ED dataset records
- Annual security report records
- OCR or government release records
- university statement records
- public notice or news-like records
- blocked or problem records
- other public-source records

## ED Dataset Rule

ED dataset records require workbook, sheet, row, column, and cell provenance before certification. Reconstructed provenance should first live in a separate audit artifact. It should not silently mutate event records or certify them.

## Public-Use Boundary

Do not describe a batch as external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.
