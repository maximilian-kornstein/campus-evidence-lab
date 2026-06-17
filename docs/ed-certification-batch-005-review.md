# ED Certification Batch 005 Review

`data/ed-certification-batch-005-review.json` is the fifth bounded ED Campus Safety dataset source-to-record certification review.

Current result:

- records reviewed: 250
- certified: 246
- not certified: 0
- blocked: 4

Batch 005 was initialized from the next ED dataset work window exposed by the certification-batch manifest after Batch 004 was applied. The review artifact freezes those 250 event ids so regeneration cannot silently move the review wave to later records.

## Blocked Records

The blocked records are not certified because the source-cell locator remains ambiguous:

- `evt_2026_0969`: multiple workbook rows matched `cuny_hunter_college`, `VANDAL_ET24`, and count `1`.
- `evt_2026_1082`: multiple workbook rows matched `cox_college`, `AGG_A_SEX24`, and count `1`.
- `evt_2026_1285`: multiple workbook rows matched `savannah_college_of_art_and_design`, `VANDAL_REL24`, and count `1`.
- `evt_2026_1335`: multiple workbook rows matched `vermont_state_university`, `VANDAL_GEN23`, and count `1`.

These records remain blocked until the locator ambiguity can be resolved without guessing.

## What This Certifies

For the 246 certified records, certification means:

- the record has a matched official ED workbook cell;
- the review records workbook, sheet, row, column, and cell detail;
- institution identity matches the event and provenance row;
- the record keeps year-level date precision visible;
- the stored category matches the source offense mapping used by the importers;
- the affected-community label matches the ED bias-code suffix;
- response depth remains a limited dataset-response note;
- source-specific rationales are tied to the ED cell;
- no prohibited endorsement, ranking, scoring, prevalence, or legal-truth wording was detected.

## What This Does Not Certify

This is not manual review of all 4,000 records. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.

The review does not claim that an ED workbook cell proves institutional misconduct, campus safety, frequency beyond the reported cell, or severity. It only certifies that the current database row is source-to-record consistent under `certification_rules_v1`.

## Freeze Rule

Batch 005 is a named review artifact with its own certification basis: `ed_certification_batch_005_internal_source_to_record_review`.

Regenerating the pipeline must update this same reviewed record set. To review another ED batch, create a new named batch-review artifact rather than letting Batch 005 move.
