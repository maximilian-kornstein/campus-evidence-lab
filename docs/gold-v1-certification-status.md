# Gold v1 Certification Status

`data/gold-v1-certification-status.json` tracks whether each Gold v1 record has cleared internal source-to-record readiness gates.

Current sprint status:

- `17` Gold v1 records are internally certified by the deterministic gates.
- `7` Gold v1 records remain not certified because one or more source-to-record gates still need locator, date, label, category, or rationale repair.
- `1` Gold v1 record remains blocked because its linked source redirects away from the cited item.

Certification gates:

- `source_locator`: source URL must land on the cited source, not only a general publisher page.
- `dataset_cell_or_item_locator`: dataset records need workbook, sheet, table, row, column, cell, or item locator detail.
- `date_precision`: day, month, or year precision must match what the public source supports.
- `category_fit`: category wording must fit the source without implying severity or legal adjudication.
- `affected_label_boundary`: affected-community labels must match source wording at the right level of specificity.
- `response_depth`: response language must distinguish direct institutional response, agency-described action, limited note, and no public response found.
- `rationale_specificity`: rationale fields must be source-specific, not generic metadata text.

Statuses:

- `certified`: no deterministic gate failures or review-needed signals remain.
- `not_certified`: one or more gates still need source-specific review or stronger locator/rationale detail.
- `blocked`: a source-locator or source-availability issue prevents external packet use until repaired.

Remaining not-certified records:

- `evt_2026_0060`, `evt_2026_0061`, and `evt_2026_0062`: Farmingdale State College records still need source page/table/item locators for the cited reporting-year entries before their date, label, response-depth, and rationale gates can be cleared.
- `evt_2026_0022`: Minot State University still lacks a verified aggregate item locator matching the stored disability-access record and day-level date.
- `evt_2026_0004` and `evt_2026_0005`: Lehigh University and Johns Hopkins University have OCR aggregate item locators, but the current aggregate item text does not by itself certify every listed affected-community label.
- `evt_2024_0006`: University of Illinois Urbana-Champaign remains not certified because the linked source is government guidance referencing an OCR resolution rather than a direct item-specific OCR matter locator.
- `evt_2026_0080`: Towson University remains blocked because the linked university source redirects away from the cited item.

This is an internal readiness status. It is not third-party review, outside validation, endorsement, ranking, safety scoring, severity scoring, frequency measurement, or a legal finding.
