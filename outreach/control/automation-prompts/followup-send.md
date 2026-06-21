# Automation Prompt: Follow-Up Send

You are processing due CEL follow-up queue rows. Default to dry-run. A real Gmail send is allowed only when the environment explicitly sets `REAL_SEND_ENABLED=true`.

## Boundary

- SQLite is authoritative.
- Gmail labels are only visibility aids.
- Local Node scripts do not call Gmail.
- Use the Gmail connector for live thread checks, draft creation, labeling, and real sends; persist outcomes through local scripts or, when no follow-up-specific recorder exists, through `automation-run.mjs` plus exported reports.

## Required Blocks

Block the follow-up if any condition is true:

- The recipient replied after the original CEL send.
- The thread, contact, organization, domain, or relationship ledger is warm, permission-limited, declined, routed, scheduled, or otherwise relationship-blocked.
- A duplicate follow-up exists for the same `source_thread_id` and `sequence_no`.
- A prior successful send exists for the same follow-up idempotency key.
- A Gmail draft or scheduled/future-looking item already exists for the same thread, person, domain, or organization.
- The draft recipient, subject, or body does not match the source thread context.
- The body contains `https://maximilian-kornstein.github.io/campus-evidence-lab/`.
- The imported Gmail snapshot is older than 24 hours.

## Steps Per Due Follow-Up

1. Refresh the source thread with the Gmail connector before drafting or sending.
2. Verify there is no reply, warm signal, duplicate follow-up, duplicate draft, or prior successful send for the same idempotency key.
3. If a condition blocks the follow-up, mark/report it as blocked and do not replace it in the same run.
4. In dry-run mode, do not draft or send. Record the run summary with:

```sh
node scripts/cel-outreach-control/automation-run.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --run-type followup_send \
  --result ok \
  --sent-count 0 \
  --blocked-count BLOCKED_COUNT \
  --summary "Dry run: WOULD_SEND_COUNT follow-ups would send; BLOCKED_COUNT blocked."
```

5. If and only if `REAL_SEND_ENABLED=true`, use the Gmail connector to create or send the exact safe follow-up for the source thread, then label it for follow-up visibility.
6. Persist the automation summary:

```sh
node scripts/cel-outreach-control/automation-run.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --run-type followup_send \
  --result ok \
  --sent-count SENT_COUNT \
  --blocked-count BLOCKED_COUNT \
  --summary "Sent SENT_COUNT follow-ups; BLOCKED_COUNT blocked."
```

7. Export reports:

```sh
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

Never send a follow-up when a reply, warm relationship signal, duplicate follow-up, duplicate Gmail draft, scheduled/future item, stale snapshot, or idempotency conflict is present. Never replace blocked follow-up rows in the same run.
