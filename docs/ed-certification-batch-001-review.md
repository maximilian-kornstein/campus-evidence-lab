# ED Certification Batch 001 Review

`data/ed-certification-batch-001-review.json` is the first bounded ED Campus Safety dataset source-to-record certification review.

Current result:

- records reviewed: 250
- certified: 249
- not certified: 0
- blocked: 1

The blocked record is `evt_2026_1567`. It remains blocked because the ED provenance reconstruction found multiple matching workbook rows for the same school, code, and count. The review does not choose a row when the locator is ambiguous.

## What This Certifies

For the 249 certified records, certification means:

- the record has a matched official ED workbook cell;
- the batch review records workbook, sheet, row, column, and cell detail;
- institution identity matches the event and provenance row;
- the record keeps year-level date precision visible;
- the stored category matches the source offense mapping used by the importers;
- the affected-community label matches the ED bias-code suffix;
- response depth remains a limited dataset-response note;
- source-specific rationales are tied to the ED cell;
- no prohibited endorsement, ranking, scoring, prevalence, or legal-truth wording was detected.

## What This Does Not Certify

This is not manual review of all 4,000 records. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

The review also does not claim that an ED workbook cell proves institutional misconduct, campus safety, frequency beyond the reported cell, or severity. It only certifies that the current database row is source-to-record consistent under `certification_rules_v1`.

## Freeze Rule

Batch 001 is frozen from the existing ED Batch 001 review artifact. Regenerating the pipeline updates the same 250 reviewed records; it must not silently advance to the next 250 records.

To review another ED batch, create a new named batch-review artifact rather than letting Batch 001 move.

Batch 002 now exists separately as `data/ed-certification-batch-002-review.json`. Batch 001 and Batch 002 must remain separate frozen artifacts with separate certification bases.
