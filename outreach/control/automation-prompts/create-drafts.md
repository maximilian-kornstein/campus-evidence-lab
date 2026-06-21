# Automation Prompt: Create Drafts

You are creating CEL outreach drafts from `outreach_queue`. Create at most one Gmail draft for a queue row only when it is safe. Never send email.

## Boundary

- SQLite is authoritative.
- Gmail labels are only visibility aids.
- Local Node scripts do not call Gmail.
- Use the Gmail connector for live reads, draft creation, and labeling; persist every result through local scripts.

## Required Gates Before Drafting

For each candidate row, require:

- `campaign_targets.approval_status = 'approved_for_draft'`.
- `outreach_queue.status = 'planned'`.
- Non-empty `outreach_queue.idempotency_key`.
- No prior `send_attempts.result = 'sent'` for the idempotency key.
- Imported Gmail snapshot less than 24 hours old.
- Daily caps still usage <= 20 and protocol <= 10.
- No legacy GitHub Pages CEL URL in the subject, body, or source material.

## Steps Per Row

1. Use the Gmail connector to run live Gmail checks for the target person, recipient email, domain, organization, and any existing CEL labels. Include drafts, sent mail, replies, scheduled/future-looking items, and the domain-migrated label.
2. Save the live evidence to `outreach/control/imports/live-check-QUEUE_ID.json`.
3. Run:

```sh
node scripts/cel-outreach-control/apply-live-check.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --json outreach/control/imports/live-check-QUEUE_ID.json
```

4. Continue only if the live-check result is safe and the queue row is still `planned`.
5. Use the Gmail connector to create exactly one draft for the recorded target. The draft must use `https://campusevidencelab.org/` and must not contain the GitHub Pages CEL URL.
6. Use the Gmail connector to apply the queue row's `gmail_label` to the draft.
7. Record the draft:

```sh
node scripts/cel-outreach-control/record-draft-created.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --gmail-draft-id GMAIL_DRAFT_ID \
  --gmail-message-id GMAIL_MESSAGE_ID \
  --gmail-thread-id GMAIL_THREAD_ID
```

8. Run a second live Gmail check after the draft exists. Confirm that the only draft conflict is the draft just recorded on the queue row.
9. Save the second evidence file and run `apply-live-check.mjs` again.
10. Mark ready only when the second live check is safe:

```sh
node scripts/cel-outreach-control/mark-queue-ready.mjs \
  --db outreach/control/cel-outreach.sqlite \
  --queue-id QUEUE_ID \
  --live-check-at CHECKED_AT_ISO
```

11. Export reports:

```sh
node scripts/cel-outreach-control/export-reports.mjs --db outreach/control/cel-outreach.sqlite --out outreach/control/reports
```

If any gate fails, leave or mark the row `blocked` through `apply-live-check.mjs`, report the reason, and do not create a replacement draft in the same run.
