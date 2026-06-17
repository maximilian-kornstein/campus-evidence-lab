# Replicating a Campus Evidence Lab Release

## Requirements

- Node.js 22 or compatible current Node runtime
- npm
- Git

## Commands

```sh
npm ci
npm run check
npm run build
```

## Source-To-Record Replication

Use `data/external-review-packet.json`, `data/certification-ledger.json`, and `docs/source-to-record-replication-guide.md` when the task is to verify a specific record from public source locator to database field.

For each record:

1. Open the event page.
2. Open the linked source.
3. Confirm source metadata against `data/sources.json`.
4. Confirm the stored source locator.
5. Compare source evidence to each record field.
6. Check Gold v1 gate status when available.
7. Check the full certification ledger for the record's certification status, open gates, and next action.
8. File a source-backed challenge if a field is unsupported.

## What These Checks Prove

- Dataset files validate against project rules.
- Record hashes and snapshot hashes match generated artifacts.
- Static pages, links, accessibility checks, and render checks pass locally.

## What These Checks Do Not Prove

- They do not prove the archive is complete.
- They do not prove underlying frequency, campus safety, legal liability, endorsement, or outside validation.
- They do not replace source reading or institutional follow-up.
