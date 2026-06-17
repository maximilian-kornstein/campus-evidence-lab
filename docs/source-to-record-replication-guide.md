# Source-To-Record Replication Guide

This guide explains how to verify a Campus Evidence Lab record from public source to database field.

Passing this process for one record does not validate the whole database. It only supports the inspected source-to-record relationship.

## Universal Steps

1. Open the event page.
2. Open the linked source page or file.
3. Confirm the source title, publisher, publication date, accessed date, and URL against `data/sources.json`.
4. Confirm the source locator stored in the event record.
5. Compare source wording or data to these event fields:
   - school
   - date and date precision
   - category
   - affected-community labels
   - institutional response and response-depth label
   - legal/procedural status
   - confidence and confidence rationale
6. Check `data/gold-v1-certification-status.json` for gate status when the record is in Gold v1.
7. Check `data/review-debt-ledger.json` for debt status and unresolved issue IDs.
8. If a field is unsupported, submit a challenge or correction with record ID, source URL, disputed field, current value, and proposed source-bounded value.

## Dataset Cell Records

For ED campus-safety dataset records:

1. Open the cited dataset file.
2. Confirm workbook name.
3. Confirm sheet name.
4. Confirm row, column, and cell.
5. Confirm the statistic label, year, offense/category, and bias-characterization field.
6. Keep year-level precision visible unless the source supports an exact incident date.

## Annual Security Report Records

For ASR records:

1. Open the cited PDF or report page.
2. Confirm page, table, section, or item label.
3. Confirm reporting year and table heading.
4. Confirm offense/category wording.
5. Confirm affected-community or bias-characterization wording.
6. Do not infer incident prevalence beyond the specific reported statistic.

## OCR Or Government Release Records

For OCR or government release records:

1. Open the cited release or aggregate page.
2. Confirm item date and item label.
3. Confirm whether the source describes a complaint, resolution, guidance item, agency action, or direct institutional response.
4. Confirm category and legal/procedural status are neutral documentation labels.
5. Do not convert agency language into a legal finding by Campus Evidence Lab.

## University Statements And News/Public Notices

For university statements, news reports, and public safety notices:

1. Confirm the cited page still lands on the relevant item.
2. Confirm the exact statement, notice, or article supports the stored record.
3. Distinguish direct institutional response from quoted third-party description.
4. Keep limits visible when a source provides only a partial public account.

## Failure Conditions

Do not certify a record when:

- the source URL redirects away from the cited item
- the source locator is missing or too broad
- date precision exceeds what the source supports
- category wording is broader than source wording
- affected-community labels are only contextual
- response-depth language overstates direct institutional response
- rationale fields are generic or not source-specific
