# Source Family Bulk Targets

Bulk import eligibility depends on source type, source locator strength, claim risk, and whether deterministic QA can block unsafe rows before publication.

## Readiness Matrix

| Source family | Bulk status | Default review tier | Reason |
| --- | --- | --- | --- |
| `ed_campus_safety_dataset` | Eligible | `imported_public_source` | Official structured public data with stable workbook or row-level provenance paths. |
| `government_guidance` | Not bulk eligible | `source_family_checked` | Public and official, but individual items often need document-section interpretation. |
| `government_case_or_letter` | Not bulk eligible | `source_family_checked` | Official, but legal/procedural status and institutional identity need source-specific review. |
| `ocr_or_ed_release` | Not bulk eligible | `source_family_checked` | Official releases and aggregate pages require item-level locator checks before scaled publication. |
| `annual_security_report` | Not bulk eligible | `source_family_checked` | Public institutional reports vary by format and usually need page, table, or section extraction review. |
| `university_statement` | Not bulk eligible | `source_family_checked` | Institutional public statements are useful but require context and claim-boundary review. |
| `campus_public_safety_notice` | Not bulk eligible | `source_family_checked` | Notices often contain time-sensitive safety or privacy context requiring manual boundaries. |
| `news_report` | Manual only | `imported_public_source` | Journalism is public but higher risk for summarization, duplication, and private-person details. |
| `other_public_source` | Manual only | `imported_public_source` | Mixed provenance; no bulk path until source family is narrowed. |

## First Target

The first scale target is `ed_campus_safety_dataset`. It should be imported in waves with source locator, school identity, date precision, duplicate, prohibited-field, and overclaim gates.

## Upgrade Rule

A source family can become bulk-eligible only after:

- an import manifest exists;
- candidate-field requirements are documented;
- import-wave tests cover both accepted and quarantined rows;
- source locator specificity is deterministic;
- public claim limits are visible on event and institution pages;
- a first small wave passes without a publication incident.

## Default Exclusion

Any source family not listed as bulk-eligible is excluded from bulk publication by default. Exclusion protects the public archive from scale-driven errors and protects institutions from unsupported public claims.
