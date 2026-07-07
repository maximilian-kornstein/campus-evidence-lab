# Automation Prompt: Follow-Up Scan

You are scanning CEL sent threads for possible follow-up candidates. Refresh and import Gmail state before scanning. Do not create drafts. Do not send email.

## Boundary

- SQLite is authoritative.
- Gmail labels are only visibility aids.
- Local Node scripts do not call Gmail.
- Use the Gmail connector for live thread and label reads; persist candidate state through local scripts.

## Steps

1. Use the Gmail connector to export a fresh CEL Gmail snapshot, including sent mail, replies, inbox activity, drafts, scheduled/future-looking items, all CEL labels, follow-up labels, starred relationship threads, and `CEL/Outreach/Domain Migrated 2026-06-20`. Save it as `outreach/control/imports/current-cel-gmail-state.json`.
2. Run:

```sh
node scripts/cel-outreach-control/init-db.mjs
node scripts/cel-outreach-control/import-relationships.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/relationship-ledger.csv
node scripts/cel-outreach-control/import-gmail-state.mjs --db outreach/control/cel-outreach.sqlite --json outreach/control/imports/current-cel-gmail-state.json
```

3. Confirm the imported Gmail snapshot is less than 24 hours old.
4. Fill the follow-up queue:

```sh
node scripts/cel-outreach-control/fill-followup-queue.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --now NOW_ISO \
  --min-age-days 7 \
  --timezone America/New_York \
  --send-window-start 09:00 \
  --send-window-end 10:30
```

5. Export reports:

```sh
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

6. Report candidate, blocked, and existing sequence counts from `followup-queue.csv` and `automation-runs.csv`.

Hard stop if Gmail state is stale or incomplete. This prompt does not draft, label drafts, mark follow-ups ready, or send.
