# Full-Database Certification Rulebook

Campus Evidence Lab uses internal source-to-record certification to make record strength inspectable. Certification is not outside validation, institutional endorsement, a school ranking, a safety score, a severity score, a prevalence estimate, or a legal finding.

## Statuses

- `certified`: every certification gate passes and the record has an explicit internal certification basis, such as Gold v1 source-to-record review or a completed certification batch.
- `not_certified`: a bounded review found that at least one gate does not pass.
- `blocked`: a source or locator blocker prevents certification until repaired.
- `awaiting_review`: the record has an inspectable status, but one or more gates still need source-to-record review.

## Certification Gates

Every record is checked against these gates:

- `source_availability`: linked public sources resolve in the local source index and have usable URLs.
- `source_locator_specificity`: the record points reviewers to a source location specific enough for the source type.
- `institution_support`: the record has stable institution identity fields and linked source ids.
- `date_precision_support`: day, month, or year precision remains honest to the source.
- `category_fit`: the category does not outrun source wording.
- `affected_label_boundary`: affected-community labels are no broader than source support.
- `response_depth_classification`: institutional response text is classified as direct, agency-described, limited, or not found.
- `rationale_specificity`: classification, community, and confidence rationales are source-specific.
- `overclaim_risk`: record text avoids claims of endorsement, ranking, prevalence, safety scoring, severity scoring, external validation, or legal truth.

## Certification Standard

A record can be certified only when all gates are `pass` and a certification basis is present. A deterministic scan with no known issue is not enough by itself. Records without a completed certification basis remain `awaiting_review` even if some metadata checks pass.

## Batch Standard

A batch is complete only when every included record has a final visible status and exact open gates. A batch may produce zero newly certified records. That outcome is acceptable when public sources do not support certification.

## Public-Use Boundary

Public pages may say that records have certification statuses and open gates. They must not say that all records are manually reviewed, externally validated, institutionally endorsed, ranked, scored, or legally adjudicated.
