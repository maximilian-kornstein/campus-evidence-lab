# Import Wave Runbook

This runbook governs bulk import attempts. It is designed for official structured sources first and defaults to quarantine when a row cannot be safely published.

## Operator Steps

1. Confirm the source family has an import manifest.
2. Confirm the manifest marks the source family bulk-eligible.
3. Generate candidate rows from the source-specific importer.
4. Run import-wave QA against the candidate file.
5. Review the wave report totals and quarantine reasons.
6. Publish only accepted rows from a publishable wave.
7. Preserve the wave report and quarantine artifact.
8. Run the full public release verification suite before pushing.

## Required Commands

Use the source-specific importer to create candidates, then run:

```bash
node scripts/import-wave-runner.mjs --candidates data/import-candidates/<wave-id>.json --wave-id <wave-id>
```

When a source-specific exporter preserves excluded source rows, include:

```bash
node scripts/import-wave-runner.mjs --candidates data/import-candidates/<wave-id>.json --wave-id <wave-id> --exclusions data/import-exclusions/<wave-id>.json
```

The runner writes:

- `data/import-waves/<wave-id>.json`;
- `data/import-quarantine/<wave-id>.json`.

## Approval Checklist

A wave may be approved only when:

- accepted rows are all from a bulk-eligible manifest;
- no accepted row has a prohibited private or sensitive field;
- accepted rows have source locators;
- source-specific exclusions are preserved when applicable;
- duplicate handling is deterministic;
- quarantine rows are preserved with reason codes;
- review tier for accepted bulk rows is `imported_public_source`;
- public pages show claim limits;
- validation, QA, dataset hash check, and build pass.

## Rollback

If a wave ships with a material record error, remove or correct affected records, regenerate hashes and pages, publish a correction note, and preserve the incident in the publication incident response log.

## Known Limits

Import-wave approval is not human certification of every row. It means the source family and row passed deterministic publication gates appropriate for imported public-source records.
