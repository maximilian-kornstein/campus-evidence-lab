# Unresolved Dossier Work-Order Context Plan

## Objective

Attach source-preservation closure work-order context to each unresolved-record dossier so reviewers can see the exact remaining source-to-record closure tasks from the unresolved dossier page and JSON artifact.

## Credibility Boundaries

- Do not certify any record from this join.
- Do not change certification status, record facts, source facts, or event labels.
- Preserve `ready_to_certify: false` and `certification_change_allowed: false` for joined work-order context.
- Treat work orders as review navigation only until the named source-to-record gates genuinely pass.

## Implementation Steps

1. Extend unresolved-record dossier generation to read `source-preservation-closure-work-orders.json`.
2. Join closure work orders by `event_id` into each unresolved record.
3. Add deterministic summary totals for records with work orders and total work-order count.
4. Expose compact per-record work-order fields: gate IDs, evidence keys, support-status counts, and work-order rows.
5. Enforce schema constants that prevent certification overclaiming from this context.
6. Add tests that verify all unresolved records receive context, ED ambiguous rows retain source row/cell evidence keys, and certification changes remain disallowed.
7. Update public unresolved dossier page copy and QA checks.
8. Update documentation and regenerate artifacts/hashes.

## Verification

- `npm run test:unresolved-record-dossiers`
- `npm run validate:data`
- `npm run qa:site`
- `npm run schema-artifact-compatibility:audit`
- `npm run test:schema-artifact-compatibility`
- `npm run claim-boundary:audit`
- `npm run link-integrity:audit`
- `npm run page-data-parity:audit`
- `npm run public-artifact-exposure:audit`
- `npm run public-artifact-exposure:repair-queues`
- `git diff --check`
- `npm run check`
- `npm run build`
