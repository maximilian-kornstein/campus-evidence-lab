# ED Certification Batch 004 Review

`data/ed-certification-batch-004-review.json` is the fourth bounded ED Campus Safety dataset source-to-record certification review.

Current result:

- records reviewed: 250
- certified: 247
- not certified: 0
- blocked: 3

Batch 004 was initialized from the next ED dataset work window exposed by the certification-batch manifest after Batch 003 was applied. The review artifact freezes those 250 event ids so regeneration cannot silently move the review wave to later records.

## Blocked Records

The blocked records are not certified because the source-cell locator remains ambiguous:

- `evt_2026_0587`: multiple workbook rows matched `portland_community_college`, `INTIM_RAC22`, and count `1`.
- `evt_2026_0812`: multiple workbook rows matched `washington_state_university`, `INTIM_RAC24`, and count `1`.
- `evt_2026_0867`: multiple workbook rows matched `college_of_central_florida`, `INTIM_RAC23`, and count `1`.

These records remain blocked until the locator ambiguity can be resolved without guessing.

## What This Certifies

For the 247 certified records, certification means:

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

Batch 004 is a named review artifact with its own certification basis: `ed_certification_batch_004_internal_source_to_record_review`.

Regenerating the pipeline must update this same reviewed record set. To review another ED batch, create a new named batch-review artifact rather than letting Batch 004 move.
