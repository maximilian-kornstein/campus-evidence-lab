# ED Certification Batch 006 Review

`data/ed-certification-batch-006-review.json` is the sixth bounded ED Campus Safety dataset source-to-record certification review.

Current result:

- records reviewed: 250
- certified: 242
- not certified: 0
- blocked: 8

Batch 006 was initialized from the next ED dataset work window exposed by the certification-batch manifest after Batch 005 was applied. The review artifact freezes those 250 event ids so regeneration cannot silently move the review wave to later records.

## Blocked Records

The blocked records are not certified because the source-cell locator remains ambiguous:

- `evt_2026_1460`: multiple workbook rows matched `mayo_clinic_college_of_medicine_and_science`, `INTIM_RAC22`, and count `1`.
- `evt_2026_1480`: multiple workbook rows matched `tufts_university`, `VANDAL_REL24`, and count `1`.
- `evt_2026_1583`: multiple workbook rows matched `vermont_state_university`, `INTIM_RAC22`, and count `1`.
- `evt_2026_1611`: multiple workbook rows matched `indiana_university_indianapolis`, `VANDAL_RAC23`, and count `1`.
- `evt_2026_1632`: multiple workbook rows matched `indiana_university_indianapolis`, `VANDAL_REL23`, and count `1`.
- `evt_2026_1668`: multiple workbook rows matched `indiana_university_indianapolis`, `INTIM_RAC22`, and count `1`.
- `evt_2026_1685`: multiple workbook rows matched `indiana_university_indianapolis`, `INTIM_REL22`, and count `1`.
- `evt_2026_1687`: multiple workbook rows matched `towson_university`, `INTIM_RAC22`, and count `1`.

These records remain blocked until the locator ambiguity can be resolved without guessing.

## What This Certifies

For the 242 certified records, certification means:

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

Batch 006 is a named review artifact with its own certification basis: `ed_certification_batch_006_internal_source_to_record_review`.

Regenerating the pipeline must update this same reviewed record set. To review another ED batch, create a new named batch-review artifact rather than letting Batch 006 move.

Batch 007 now continues this sequence in `data/ed-certification-batch-007-review.json`.
