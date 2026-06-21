# Automation Prompt: Fill Queue

You are running the CEL autonomous outreach queue filler. Your job is to refresh local state, select safe candidates, fill `outreach_queue`, and export reports. Do not create Gmail drafts. Do not send email.

## Boundary

- SQLite is authoritative.
- Gmail labels are only visibility aids.
- Local Node scripts do not call Gmail.
- Use the Gmail connector only to refresh live Gmail state for import; after that, persist through local scripts.

## Steps

1. Use the Gmail connector to export a fresh CEL Gmail snapshot, including drafts, sent mail, replies, scheduled/future-looking items, starred relationship threads, all CEL labels, every relevant `CEL/Outreach/YYYY-MM-DD` label, every relevant `CEL/Followup/Drafts/...` label, and `CEL/Outreach/Domain Migrated 2026-06-20`. Save it as `outreach/control/imports/current-cel-gmail-state.json`.
2. Run:

```sh
node scripts/cel-outreach-control/init-db.mjs
node scripts/cel-outreach-control/import-relationships.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/relationship-ledger.csv
node scripts/cel-outreach-control/import-gmail-state.mjs --db outreach/control/cel-outreach.sqlite --json outreach/control/imports/current-cel-gmail-state.json
```

3. If `outreach/control/imports/target-pool.csv` exists, run:

```sh
node scripts/cel-outreach-control/import-target-pool.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/control/imports/target-pool.csv
```

4. Fill the queue for the requested send date and window. Daily caps must be usage <= 20 and protocol <= 10:

```sh
node scripts/cel-outreach-control/fill-outreach-queue.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --send-date YYYY-MM-DD \
  --send-window-start 09:00 \
  --send-window-end 10:30 \
  --usage-cap 20 \
  --protocol-cap 10
```

5. Export reports:

```sh
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

6. Report queued, blocked, and error counts from `outreach/control/reports/outreach-queue.csv`, `blocked-autonomous-sends.csv`, and `automation-runs.csv`.

Hard stop if the imported Gmail snapshot is missing, older than 24 hours, or lacks CEL draft/sent/reply/future-looking coverage. This prompt never drafts, labels drafts, marks rows ready, or sends.
