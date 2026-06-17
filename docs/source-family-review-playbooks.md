# Source-Family Review Playbooks

Standard version: `certification_rules_v1`

These playbooks define what reviewers must check before a record can move from `awaiting_review` to `certified`. They are source-to-record standards, not findings about institutional quality or campus safety.

Later changes to source-family review requirements should use a new named standard version rather than silently changing this version.

## ED Campus Safety Dataset Records

Required locator:

- workbook or data file name
- sheet/table name when available
- row number or stable row key
- column name
- cell value or cell reference when available

Certification blockers:

- no workbook/table/row/cell provenance
- ambiguous workbook/table/row/cell provenance, including multiple matching rows
- affected-community label broader than the source field supports
- date stored as exact when only year-level data is supported
- rationale copied from generic dataset metadata instead of the specific source fields

Default response-depth:

- usually `limited_public_response_note` unless a separate source documents a direct or agency-described institutional response.

Batch rule:

- matched workbook-cell provenance is necessary but not sufficient;
- the reviewed batch record set must be frozen before certification is applied;
- a new ED review wave should use a new named batch artifact rather than changing the membership of an existing certified batch.

## Annual Security Report Records

Required locator:

- report year
- page number when possible
- table/section heading
- row/item label

Certification blockers:

- source URL cannot be reached or archived
- page/table locator absent
- Clery offense or bias-category language does not match the record category
- record date is more precise than the report supports

## OCR Or Aggregated Government Release Pages

Required locator:

- exact item title
- item date
- agency page or release page
- item-level URL or archived locator when available

Certification blockers:

- source page contains multiple items but the record lacks item-level locator detail
- day-level record date cannot be tied to the source item
- category implies adjudication beyond the agency announcement

## University Statements

Required locator:

- direct statement URL or archived copy
- statement title
- publication date
- quoted or paraphrased section boundary

Certification blockers:

- source redirects away from the cited item
- response text implies broader institutional action than the statement supports
- affected-community labels are inferred from context rather than named source text

## News Reports And Public Notices

Required locator:

- article or notice URL
- publication date
- source title
- item-level detail sufficient for reviewers to find the claim

Certification blockers:

- source unavailable with no archive
- article uses allegations that the record treats as established fact
- category or legal status outruns the article wording
- institutional response field does not distinguish direct response from reported response

## Government Case, Letter, Or Guidance Records

Required locator:

- agency page or document URL
- document title
- date
- section, page, docket, or item locator where available

Certification blockers:

- guidance source is used as if it documents a specific OCR complaint
- record implies legal truth beyond the source document
- response-depth label does not distinguish agency-described action from direct institutional response
