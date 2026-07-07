# CEL Outreach Control

This directory is the local control plane for CEL outreach. It exists to prevent duplicate drafts, scheduled duplicates, and accidental cold outreach to warm relationships.

## Current Policy

- Use `https://campusevidencelab.org/` in all new and revised outreach.
- Do not use the old GitHub Pages URL except as a fallback if the primary domain is unavailable.
- Future daily outreach capacity is 30 targets: 20 standard CEL outreach targets plus 10 protocol-adjacent targets for the coming-soon open-source crypto protocol.
- Protocol-adjacent targets should emphasize advice, fit, routing, collaboration perspective, or protocol-design feedback while the protocol is not yet live.

## Workflow

Run this before preparing any new CEL outreach batch:

```sh
node scripts/cel-outreach-control/init-db.mjs
node scripts/cel-outreach-control/import-relationships.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/relationship-ledger.csv
node scripts/cel-outreach-control/import-gmail-state.mjs --db outreach/control/cel-outreach.sqlite --json outreach/control/imports/current-cel-gmail-state.json
node scripts/cel-outreach-control/import-campaign-targets.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/control/imports/campaign-targets.csv
node scripts/cel-outreach-control/run-duplicate-guard.mjs --db outreach/control/cel-outreach.sqlite --checklist outreach/outreach-preflight-checklist.md --max-snapshot-age-hours 24
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

For the current relationship audit, the target file is:

```sh
node scripts/cel-outreach-control/import-campaign-targets.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/control/imports/current-relationship-audit-targets.csv
```

## What The Guard Blocks

- Exact recipient already has a CEL sent email.
- Exact recipient already has a CEL draft.
- Recipient/domain has a future-looking or scheduled CEL item.
- Organization is already warm, engaged, permission-limited, or otherwise relationship-blocked in `outreach/relationship-ledger.csv`.
- The domain-migrated draft holding label `CEL/Outreach/Domain Migrated 2026-06-20` must be included in Gmail snapshot refreshes and manual duplicate checks.

## Reports

- `reports/gmail-state.csv`: imported CEL drafts, sent items, replies, and future/scheduled indicators.
- `reports/gmail-snapshots.csv`: imported Gmail snapshot timestamp, source, item count, and label-count coverage.
- `reports/duplicate-flags.csv`: hard-stop evidence for campaign targets.
- `reports/campaign-targets.csv`: target-level approval status after preflight.
- `reports/warm-relationships.csv`: contacts and organizations to keep warm for future recommendation-letter asks.

The checklist remains part of the system: every duplicate-guard run stores the checklist path and SHA-256 in `preflight_runs`, so each target decision is tied back to the exact checklist version used.

Before any new batch is drafted, create or refresh `outreach/control/imports/campaign-targets.csv` with the proposed contacts, refresh the Gmail snapshot, import both, run the duplicate guard with `--max-snapshot-age-hours 24`, and only draft rows whose `campaign-targets.csv` report says `approved_for_draft`.
