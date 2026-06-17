# Record Quality Audit

Campus Evidence Lab uses `data/record-quality-audit.json` as an internal pre-review triage artifact.

The audit checks every event record for review risks that make a record harder to rely on publicly:

- broken or redirected source locators
- dataset records that need workbook, row, table, or cell review
- aggregate or report-backed records that need item, page, table, or section locators
- broad affected-community labels
- category/source fit questions
- year-level or mixed-source date precision questions
- thin or bounded institutional response text
- missing or generic rationale fields
- high-stakes records that need stronger classification and confidence rationale

The audit has two layers.

1. A compact row for every event record.
2. Expanded issue notes for the 25 Gold v1 review-packet records.

`data/review-debt-ledger.json` is the next whole-database layer built from this audit. It assigns every record an inspectable debt status, groups records by source family, and creates deterministic queues for source locator, label-boundary, rationale, date, category, response-depth, and blocker review. The ledger is broader than the Gold v1 packet, but it is still deterministic triage rather than manual certification.

The status labels are review workflow labels only:

- `blocked_before_external_packet`: do not route externally until a source or locator problem is fixed.
- `needs_internal_review`: useful record, but internal source/rationale review should happen first.
- `usable_with_review_notes`: may be usable if the visible limits remain attached.
- `lower_priority_for_review`: no current audit issue was detected by the deterministic checks.

This artifact is not third-party review, outside validation, endorsement, ranking, safety scoring, severity scoring, frequency measurement, or a legal finding. It is a map of what to check next.

Recommended workflow:

1. Start with `priority_records`.
2. Fix blocker issues first.
3. For Gold v1 records, use `gold_v1_pre_review` as the internal reviewer checklist.
4. After internal cleanup, ask outside reviewers to inspect a narrow packet and challenge the source basis, category, label boundary, date precision, response-depth label, and rationale wording.

Source-specific locator rows can reduce deterministic locator issues when they identify the relevant workbook cell, public report page/table/section, or aggregate source item. Passing this deterministic locator check is not certification by itself; records can still remain not certified because of date precision, broad labels, response-depth, category-fit, or rationale-specificity gates.
