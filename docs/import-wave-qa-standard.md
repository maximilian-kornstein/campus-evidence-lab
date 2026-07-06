# Import Wave QA Standard

Import waves are bounded attempts to add or evaluate records from a named source family. A wave is publishable only when the source family is bulk-eligible, the candidate rows pass deterministic quality gates, and quarantine output is preserved.

## Bulk-Eligible Sources

Bulk publication starts with official structured public sources, especially ED Campus Safety dataset sources already classified as `low_official_structured`.

Annual security reports, OCR or ED PDFs/releases, institutional statements, campus public-safety notices, government case letters, and open web sources are not bulk-publishable until their extraction path has stronger source-locator and claim-risk gates.

## Required Candidate Fields

Each candidate row must include:

- `candidate_id`;
- `manifest_id`;
- `source_family`;
- `source_url`;
- `source_locator`;
- institution identity;
- incident date or date precision;
- category;
- summary;
- raw source hash;
- import notes.

## Publication Gates

Accepted rows must pass these gates:

- manifest exists and marks the source family bulk-eligible;
- source family on the candidate matches the manifest;
- source URL is valid and public;
- source locator is specific enough to return to the supporting row, item, table, page, or cell;
- school identity resolves to a known school;
- date precision is valid;
- duplicate key is deterministic;
- prohibited private or sensitive fields are absent;
- public text avoids rankings, safety scores, prevalence estimates, severity scores, legal findings, or human-certification overclaims.

## Quarantine Reasons

Rows must be quarantined, not published, when they fail a gate. Standard reason codes are:

- `missing_candidate_id`;
- `missing_manifest`;
- `bulk_import_not_allowed`;
- `source_family_mismatch`;
- `missing_source_url`;
- `invalid_source_url`;
- `missing_source_locator`;
- `unknown_school`;
- `invalid_date_precision`;
- `missing_required_field`;
- `duplicate_candidate`;
- `duplicate_existing_record`;
- `prohibited_private_field`;
- `prohibited_public_claim`.

## Publish Threshold

A wave is publishable only when every accepted row passes all gates and every rejected row appears in quarantine or exclusion counts.

The first live wave for a source family should stay conservative. Subsequent waves can grow only when the prior wave produced stable accepted/quarantined counts and no publication incident.

## Sampling

Each wave report must include deterministic sample record IDs. Sampling is for operational review and public auditability; it does not convert imported public-source records into individually human-certified records.
