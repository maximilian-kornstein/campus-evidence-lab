# Autonomous Outreach Automation Runbook

This runbook is the operating contract for autonomous CEL outreach. It is intentionally conservative: SQLite is authoritative, Gmail labels are visibility aids, and every Gmail action must be reconciled back into the local control database before the next step runs.

## Authority Model

- `outreach/control/cel-outreach.sqlite` is authoritative for targets, queue rows, readiness, idempotency keys, send attempts, follow-up candidates, automation runs, and block decisions.
- Gmail labels are only visibility aids. They help humans and automations find drafts, sent mail, and follow-up state, but labels do not approve drafts, clear blocks, or prove that a send is safe.
- Local Node scripts do not call Gmail. They initialize/import/export/evaluate/persist local state only.
- Automations do live Gmail reads, create drafts, apply labels, send messages, and read thread state through the Gmail connector. After each Gmail-side action, automations persist the result through local scripts.

## Required Gates Before Any Autonomous Send

Do not send unless every gate is true for the queue row and the exact Gmail draft being sent:

- `campaign_targets.approval_status` is `approved_for_draft`.
- `outreach_queue.status` is `ready_to_send`.
- `outreach_queue.idempotency_key` is non-empty.
- No prior `send_attempts` row has `result = 'sent'` for the same idempotency key.
- The imported Gmail snapshot is less than 24 hours old.
- Live Gmail checks are clear for the person, recipient email, domain, organization, thread, and current draft.
- The Gmail draft recipient and subject exactly match the queue row and target context.
- The Gmail draft body passes the same live safety checks, has no GitHub Pages CEL URL, and contains no `https://maximilian-kornstein.github.io/campus-evidence-lab/` URL.
- The daily caps are not exceeded: <=20 usage and <=10 protocol, with usage lane <= 20 and protocol lane <= 10.
- The Gmail draft being sent is the draft recorded on the queue row.

When any gate fails, block the row and record the reason. Do not create, draft, send, or replace another row in the same run to compensate.

## Rollout Stages

1. Infrastructure: build and verify the SQLite schema, imports, queue filler, live-check evaluator, send-attempt recorder, exports, and reports.
2. Draft automation: allow the Gmail connector to create labeled drafts only after live checks pass; no sending.
3. Dry-run sender: evaluate due `ready_to_send` rows, verify drafts, and record `would_send`; no real sends.
4. Limited real sender: allow `REAL_SEND_ENABLED=true` for a small reviewed subset while monitoring blocked reports and send-attempt records after each run.
5. Full 30/day: operate at the daily maximum of 20 usage-lane sends and 10 protocol-lane sends only after the limited sender has clean history.
6. Follow-up automation: scan sent CEL threads, queue safe follow-up candidates, dry-run follow-up sends, then enable limited real follow-up sends after review.

Do not skip a stage. If a stage produces unexpected blocks, duplicate flags, stale snapshots, connector errors, or draft mismatches, remain at that stage until the reports are reviewed and the cause is fixed.

## Standard Local Commands

Initialize and import local state:

```sh
node scripts/cel-outreach-control/init-db.mjs
node scripts/cel-outreach-control/import-relationships.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/relationship-ledger.csv
node scripts/cel-outreach-control/import-gmail-state.mjs --db outreach/control/cel-outreach.sqlite --json outreach/control/imports/current-cel-gmail-state.json
```

Import the optional target pool when present:

```sh
node scripts/cel-outreach-control/import-target-pool.mjs --db outreach/control/cel-outreach.sqlite --csv outreach/control/imports/target-pool.csv
```

Fill the autonomous outreach queue:

```sh
node scripts/cel-outreach-control/fill-outreach-queue.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --send-date YYYY-MM-DD \
  --send-window-start 09:00 \
  --send-window-end 10:30 \
  --usage-cap 20 \
  --protocol-cap 10
```

Persist a Gmail draft after the connector creates it:

```sh
node scripts/cel-outreach-control/record-draft-created.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --gmail-draft-id GMAIL_DRAFT_ID \
  --gmail-message-id GMAIL_MESSAGE_ID \
  --gmail-thread-id GMAIL_THREAD_ID
```

Apply a live-check evidence file:

```sh
node scripts/cel-outreach-control/apply-live-check.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --json outreach/control/imports/live-check-QUEUE_ID.json
```

Mark a draft-created row ready only after the second live check is safe:

```sh
node scripts/cel-outreach-control/mark-queue-ready.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --live-check-at 2026-06-20T13:00:00.000Z
```

Record a dry-run send:

```sh
node scripts/cel-outreach-control/record-send-attempt.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --result would_send \
  --reason "dry run; all gates clear" \
  --live-check-summary "Live check safe."
```

Record a real send only after the Gmail connector sends the recorded draft:

```sh
node scripts/cel-outreach-control/record-send-attempt.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --result sent \
  --gmail-message-id GMAIL_SENT_MESSAGE_ID \
  --live-check-summary "Live check safe immediately before send."
```

Export reports after every automation run:

```sh
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

## Block Handling

- Treat `blocked` and `error` queue rows as review work, not capacity to refill.
- A sender run must never replace blocked rows with fresh targets in the same run.
- Review `outreach/control/reports/blocked-autonomous-sends.csv`, `send-attempts.csv`, `duplicate-flags.csv`, and `automation-runs.csv` after each blocked or partial run.
- If a row blocks because Gmail shows a reply, warm relationship, duplicate draft, scheduled item, domain conflict, organization conflict, bad URL, or mismatched draft, keep it blocked until Maximilian manually reviews it.
- If the Gmail connector creates a draft but the second live check blocks, leave the row blocked and leave the draft labeled for review. Do not delete or replace it automatically.

## Prompt Files

Use the prompt files in `outreach/control/automation-prompts/` for recurring automations:

- `fill-queue.md`: imports state, fills the queue, and exports reports. It does not draft.
- `create-drafts.md`: creates one safe labeled draft per eligible row, records it, and marks it ready only after a second live check. It never sends.
- `send-due.md`: defaults to dry-run and records `would_send`; real send requires `REAL_SEND_ENABLED=true`.
- `followup-scan.md`: refreshes Gmail state and queues follow-up candidates. It does not draft or send.
- `followup-send.md`: defaults to dry-run and blocks replied, warm, duplicate, or unsafe follow-ups.
