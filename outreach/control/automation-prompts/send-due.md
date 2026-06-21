# Automation Prompt: Send Due

You are processing due CEL outreach queue rows. Default to dry-run. A real Gmail send is allowed only when the environment explicitly sets `REAL_SEND_ENABLED=true`.

## Boundary

- SQLite is authoritative.
- Gmail labels are only visibility aids.
- Local Node scripts do not call Gmail.
- Use the Gmail connector for live reads and real sends; persist `would_send`, `sent`, `blocked`, or `error` through local scripts.

## Default Mode

If `REAL_SEND_ENABLED` is absent or not exactly `true`, do not send. Verify every gate and record `would_send` for rows that would be safe to send.

## Required Gates Per Queue Row

Require every item below before either `would_send` or `sent` is recorded:

- `campaign_targets.approval_status = 'approved_for_draft'`.
- `outreach_queue.status = 'ready_to_send'`.
- Non-empty `outreach_queue.idempotency_key`.
- No prior `send_attempts.result = 'sent'` for the same idempotency key.
- Imported Gmail snapshot less than 24 hours old.
- Live Gmail checks are clear immediately before the send decision.
- Gmail draft id/message id/thread id match the queue row.
- Gmail draft recipient exactly matches the queue target recipient.
- Gmail draft subject matches the approved subject for the queue row and target context.
- Gmail draft body matches the approved target context and contains no `https://maximilian-kornstein.github.io/campus-evidence-lab/` URL.
- Daily caps remain usage <= 20 and protocol <= 10.

## Steps Per Due Row

1. Read the row from `outreach_queue` and its target/contact/organization context.
2. Use the Gmail connector to fetch the recorded draft by `gmail_draft_id` or `gmail_message_id`.
3. Verify idempotency, draft recipient, subject, body, queue status, and daily cap gates.
4. Use the Gmail connector to run live checks for person, recipient email, domain, organization, thread, and current draft.
5. Save evidence to `outreach/control/imports/live-check-QUEUE_ID.json`.
6. Run:

```sh
node scripts/cel-outreach-control/apply-live-check.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --json outreach/control/imports/live-check-QUEUE_ID.json
```

7. If any gate fails, keep the row blocked or record `blocked`; do not refill or replace that blocked row in this sender run.
8. If dry-run mode is active, record:

```sh
node scripts/cel-outreach-control/record-send-attempt.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --result would_send \
  --reason "dry run; all gates clear" \
  --live-check-summary "LIVE_CHECK_SUMMARY"
```

9. If and only if `REAL_SEND_ENABLED=true`, use the Gmail connector to send the exact recorded draft.
10. Persist the send:

```sh
node scripts/cel-outreach-control/record-send-attempt.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --result sent \
  --gmail-message-id GMAIL_SENT_MESSAGE_ID \
  --live-check-summary "LIVE_CHECK_SUMMARY"
```

11. Export reports:

```sh
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

Never replace blocked rows in the same sender run. Review `blocked-autonomous-sends.csv`, `send-attempts.csv`, and `automation-runs.csv` after the run.
