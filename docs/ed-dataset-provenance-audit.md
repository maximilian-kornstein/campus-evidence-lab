# ED Dataset Provenance Audit

`data/ed-dataset-provenance-audit.json` reconstructs source-cell candidates for ED Campus Safety dataset records using official ED Excel zip packages supplied locally.

This artifact maps records to workbook, sheet, row, column, and cell candidates where the current event metadata supports a deterministic match. It does not certify records and does not mutate event records.

## Current Use

Use this artifact before manual ED dataset review so reviewers verify source-to-record support instead of hunting through thousands of cells from scratch.

## Unmatched Rows

Unmatched rows remain unresolved when the current record metadata cannot identify exactly one workbook row and cell. Ambiguous rows should stay unresolved until a reviewer can safely add a stronger locator.

## Public-Use Boundary

This audit is source-cell provenance support. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal finding.
