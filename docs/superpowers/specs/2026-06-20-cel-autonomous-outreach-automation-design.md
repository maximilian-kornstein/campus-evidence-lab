# CEL Autonomous Outreach Automation Design

## Purpose

Campus Evidence Lab outreach should stop consuming manual scheduling time while preserving credibility and relationship safety. The system should autonomously maintain a daily cadence of 30 outbound emails:

- 20 usage-focused CEL outreach emails to the usual targets: organizations, journalists, student newsrooms, civil-rights reviewers, professors, clinics, and research/reporting contacts.
- 10 protocol-adjacent emails tied to the coming-soon Campus Evidence Lab open-source crypto protocol: civic tech, data provenance, open-source public-interest technologists, crypto public-goods builders, AI accountability, journalism innovation, digital preservation, and adjacent research groups.

The automation is allowed to send fully autonomously, but only after strict, repeatable checks. The model may draft language and classify targets; the system must decide whether an email is eligible to send.

## Existing Foundation

The current outreach control system already provides:

- `outreach/control/cel-outreach.sqlite`
- `outreach/control/schema.sql`
- `outreach/relationship-ledger.csv`
- `outreach/outreach-preflight-checklist.md`
- `scripts/cel-outreach-control/import-relationships.mjs`
- `scripts/cel-outreach-control/import-gmail-state.mjs`
- `scripts/cel-outreach-control/import-campaign-targets.mjs`
- `scripts/cel-outreach-control/run-duplicate-guard.mjs`
- `scripts/cel-outreach-control/export-reports.mjs`

It already blocks exact-recipient duplicates, future/scheduled conflicts, and warm organizations. The autonomous system should extend this control plane rather than replace it.

## Core Design

Use a queue-based automation with three independent gates before sending:

1. Database gate: the target must be imported, preflighted, and marked `approved_for_draft`.
2. Live Gmail gate: immediately before draft creation and again immediately before sending, Gmail must show no conflicting sent item, draft, reply, scheduled-looking item, warm thread, or CEL-labeled item for the same person, domain, or organization.
3. Queue gate: the queued outbound row must be due, in `ready_to_send`, have an unsent idempotency key, and match the expected Gmail draft id/message id.

Gmail labels are useful for visibility, but they are not the source of truth. Gmail labels can be lost during draft updates, so the SQLite queue and send ledger are authoritative.

## Data Model Additions

Add these tables to `outreach/control/schema.sql`.

### target_pool

Stores candidate contacts before they become campaign targets.

Fields:

- `id`
- `contact_name`
- `email`
- `organization_name`
- `domain`
- `lane`: `usage` or `protocol`
- `category`
- `source`
- `source_url`
- `fit_notes`
- `status`: `candidate`, `imported`, `blocked`, `exhausted`
- `created_at`
- `updated_at`

Unique constraints:

- unique non-empty `email`
- unique pair of `domain` plus normalized `contact_name` when no email is available

### outreach_queue

Stores one planned outbound action per approved target.

Fields:

- `id`
- `campaign_id`
- `target_id`
- `lane`: `usage` or `protocol`
- `send_date`
- `send_window_start`
- `send_window_end`
- `timezone`
- `status`: `planned`, `draft_created`, `ready_to_send`, `sent`, `blocked`, `error`, `cancelled`
- `gmail_draft_id`
- `gmail_message_id`
- `gmail_thread_id`
- `gmail_label`
- `idempotency_key`
- `last_preflight_run_id`
- `last_live_check_at`
- `last_error`
- `created_at`
- `updated_at`

Unique constraints:

- unique `idempotency_key`
- unique non-empty `gmail_draft_id`
- unique `target_id` for active statuses: `planned`, `draft_created`, `ready_to_send`

### send_attempts

Records every attempt to send, including blocked attempts.

Fields:

- `id`
- `queue_id`
- `idempotency_key`
- `attempted_at`
- `result`: `sent`, `blocked`, `error`, `would_send`
- `gmail_message_id`
- `reason`
- `live_check_summary`

Unique constraint:

- unique successful send for each `idempotency_key`

### automation_runs

Records each recurring automation run.

Fields:

- `id`
- `run_type`: `fill_queue`, `create_drafts`, `send_due`, `followup_scan`, `followup_send`
- `started_at`
- `finished_at`
- `result`: `ok`, `partial`, `blocked`, `error`
- `summary`
- `created_count`
- `sent_count`
- `blocked_count`
- `error_count`

### followup_queue

Stores thread-specific follow-up actions separately from cold outreach. Follow-ups are more sensitive than first-touch outreach because they happen inside existing threads.

Fields:

- `id`
- `source_thread_id`
- `source_message_id`
- `original_sent_message_id`
- `contact_id`
- `organization_id`
- `sequence_no`
- `due_date`
- `send_window_start`
- `send_window_end`
- `timezone`
- `status`: `candidate`, `draft_created`, `ready_to_send`, `sent`, `blocked`, `error`, `cancelled`
- `gmail_draft_id`
- `gmail_message_id`
- `idempotency_key`
- `last_thread_check_at`
- `last_error`
- `created_at`
- `updated_at`

Unique constraints:

- unique `source_thread_id` plus `sequence_no`
- unique `idempotency_key`
- unique non-empty `gmail_draft_id`

## Candidate Intake

The automation may select targets from structured candidate files and imported target pools, but not from unreviewed open-ended web search. A candidate source is acceptable when each row includes enough provenance to audit why the target entered the system:

- contact name or team name
- email or contact route
- organization
- domain
- lane: `usage` or `protocol`
- category
- source or source URL
- short fit note

If the candidate pool does not contain enough approved rows to fill a day, the day remains underfilled. The system should not invent contacts to hit the quota.

## Daily Campaign Selection

The fill-queue worker should:

1. Find the next draftless or underfilled send date.
2. Count existing active queue rows and Gmail drafts/sent items for that date.
3. Fill up to exactly 30 total planned rows:
   - 20 usage rows
   - 10 protocol rows
4. Never exceed either lane cap.
5. If one lane has insufficient approved candidates, leave the day underfilled rather than borrowing from the other lane.
6. Create one campaign per send date, for example `CEL Autonomous Outreach 2026-06-24`.

A day is considered draftless when:

- there are no active `outreach_queue` rows for the date, and
- Gmail has no active CEL date label for that date with draft or sent messages, and
- the local Gmail snapshot or live Gmail check does not show future-looking CEL items for that date.

## Draft Creation Workflow

The draft creator should:

1. Import or refresh relationship state.
2. Import or refresh Gmail state.
3. Run `run-duplicate-guard.mjs`.
4. Select only targets with `approval_status = approved_for_draft`.
5. Run live Gmail checks for each selected target.
6. Generate the email body using lane-specific templates.
7. Create the Gmail draft.
8. Apply visibility labels:
   - `CEL/Autonomous/Queued`
   - `CEL/Autonomous/YYYY-MM-DD`
   - `CEL/Autonomous/Usage` or `CEL/Autonomous/Protocol`
9. Store the Gmail draft id, message id, thread id, label, and idempotency key in `outreach_queue`.
10. Leave the row in `draft_created` unless all checks pass after draft creation; then move it to `ready_to_send`.

Drafts must use `https://campusevidencelab.org/` and must not use the old GitHub Pages URL.

## Sending Workflow

The sender automation should run during a narrow daily send window, for example 9:00-10:30 AM America/New_York.

For each due queue row in `ready_to_send`, the sender must:

1. Verify no successful `send_attempts` row exists for the idempotency key.
2. Read the current Gmail draft or thread.
3. Confirm the draft still matches the queued recipient and subject.
4. Run a fresh Gmail live check:
   - exact email in sent mail
   - exact email in drafts
   - person name
   - organization name
   - domain
   - CEL labels
   - starred mail
   - relationship labels
   - thread replies
   - warm relationship ledger
5. Block if any check finds a reply, packet sent, call scheduled, routed relationship, permission-limited status, decline, redirect, existing sent item, existing draft outside this queue row, or future/scheduled conflict.
6. Send the draft only if all checks pass.
7. Write a `send_attempts` row.
8. Mark `outreach_queue.status = sent`.
9. Mark `campaign_targets.draft_status = sent`.
10. Refresh or append local Gmail/relationship evidence after send.

If a row blocks, mark it `blocked` and record the exact reason. Do not replace it automatically the same day; replacement should happen in the next fill-queue run after the block is visible in reports.

## Live Gmail Check Requirements

Live Gmail checks are mandatory because the local snapshot can be stale. A target is unsafe if Gmail shows any of these:

- a prior CEL sent email to the same address
- a CEL draft to the same address, except the exact draft attached to the current queue row
- a thread where the person replied
- a starred thread involving the target, domain, or organization
- a `CEL/Relationship/*` label involving the person, domain, or organization
- a `CEL/Outreach/*` or `CEL/Autonomous/*` label involving the person, domain, or organization
- a migrated-domain holding-label match involving the person, domain, or organization
- an inbound or sent thread that indicates packet sent, call scheduled, routed internally, declined, redirected, or permission-limited feedback

The check should save a compact evidence summary into `send_attempts.live_check_summary` or the blocking queue row.

## Templates

### Usage Lane

Usage emails should ask recipients to try Campus Evidence Lab for one real reporting, research, routing, or issue-tracking question. They should not ask for coverage by default.

Core ask:

```text
Would you be willing to try Campus Evidence Lab for one real reporting, research, routing, or issue-tracking question and tell me what would make it more useful?
```

### Protocol Lane

Protocol-adjacent emails should frame the protocol as coming soon. They should not imply a live blockchain protocol exists yet.

Core ask:

```text
I’m exploring the protocol layer behind Campus Evidence Lab and would value one narrow reaction on whether this design direction seems useful, risky, or worth routing to someone with stronger data-provenance or public-interest technology experience.
```

Protocol emails should emphasize advice, fit, routing, collaboration perspective, or protocol-design feedback.

## Follow-Up Automation

Follow-ups should be a separate automation and queue. They should not share the cold outreach queue.

Use the separate `followup_queue` table. Do not mix follow-up rows into `outreach_queue`.

A follow-up candidate is eligible only when:

- the original outbound was sent by the system or is imported into the ledger,
- the follow-up window has elapsed,
- there has been no inbound reply after the original send,
- the thread is not warm,
- no packet was sent,
- no call is scheduled,
- no relationship label indicates keep-warm, permission-limited, routed, declined, or org-review-required,
- no prior follow-up in the same sequence was sent.

Follow-up idempotency key:

```text
followup:<thread_id>:<sequence_no>
```

Default follow-up cadence:

- first follow-up after 5-7 days
- no second follow-up unless explicitly enabled later
- never follow up on warm relationships unless the follow-up is a relationship-specific promised next step

## Automation Schedule

Use Codex cron automations after implementation.

Recommended jobs:

1. `CEL Outreach Fill Queue`
   - Runs daily in the evening.
   - Finds the next draftless or underfilled day.
   - Imports candidates.
   - Runs duplicate guard.
   - Creates queue rows.

2. `CEL Outreach Draft Creator`
   - Runs after fill-queue.
   - Creates Gmail drafts for approved rows.
   - Labels drafts.
   - Moves rows to `ready_to_send` only after live Gmail checks.

3. `CEL Outreach Sender`
   - Runs each morning.
   - Sends due `ready_to_send` rows only after final live Gmail checks.
   - Records all send attempts.

4. `CEL Follow-Up Scanner`
   - Runs daily or every other day.
   - Finds eligible follow-up candidates.
   - Creates follow-up queue rows only when thread checks are clean.

5. `CEL Follow-Up Sender`
   - Runs after scanner or in a separate morning window.
   - Sends only eligible follow-ups after a fresh thread read.

## Failure Behavior

The automation must be safe to retry.

- If draft creation fails after creating a Gmail draft but before updating SQLite, the next run must detect the existing draft via Gmail and either attach it to the queue row or block for manual review.
- If sending fails after Gmail sends but before SQLite updates, the next run must detect the sent message via Gmail and mark the queue row sent rather than sending again.
- If Gmail labels disappear, the queue remains authoritative and the next run reapplies labels.
- If the Gmail snapshot is older than 24 hours, draft creation and sending stop.
- If live Gmail search is unavailable, sending stops.
- If any target has ambiguous duplicate evidence, sending stops for that target.

## Reports

Extend `export-reports.mjs` to produce:

- `reports/outreach-queue.csv`
- `reports/send-attempts.csv`
- `reports/automation-runs.csv`
- `reports/blocked-autonomous-sends.csv`
- `reports/daily-capacity.csv`
- `reports/followup-queue.csv`

Reports should show:

- send date
- lane
- recipient
- organization
- status
- draft id
- sent message id
- block reason
- last live check time
- idempotency key

## Never-Send Rules

The autonomous sender must never send when:

- duplicate guard has not passed
- the local Gmail snapshot is stale
- live Gmail check fails or is unavailable
- target has any warm relationship conflict
- exact recipient has a CEL sent item
- exact recipient has a CEL draft other than the current queue draft
- target organization is engaged, permission-limited, routed internally, declined, redirected, packet-sent, call-scheduled, or marked org-review-required
- the current draft does not match the queued recipient
- the draft body contains the old GitHub Pages URL
- the queue row has no idempotency key
- the idempotency key has already been sent
- the row is outside the allowed send window
- the system would exceed 20 usage emails or 10 protocol emails for that date
- the system would exceed 30 total emails for that date

## Testing Strategy

Tests should cover:

- queue creation respects 20 usage / 10 protocol caps
- underfilled lanes are not borrowed across lanes
- duplicate guard blocks known warm contacts and organizations
- live-check parser blocks sent, draft, reply, starred, CEL-labeled, and relationship-labeled conflicts
- idempotency prevents duplicate sends on retry
- stale Gmail snapshot blocks draft creation and sending
- lost Gmail labels are reapplied from queue state
- blocked rows are not replaced during the same send run
- follow-up queue excludes warm, replied, packet-sent, call-scheduled, and already-followed-up threads
- reports export expected queue and send-attempt state

Use dry-run tests before any real Gmail send path is enabled.

## Implementation Phases

### Phase 1: Queue Infrastructure

Add schema tables, import/export scripts, and reports. No Gmail sending.

### Phase 2: Draft Automation

Generate queue rows and create Gmail drafts autonomously. Still no automatic sending.

### Phase 3: Dry-Run Sender

Run the sender in dry-run mode. It performs all checks and writes send-attempt records with `blocked` or `would_send`, but does not send.

### Phase 4: Limited Autonomous Sending

Enable real sending for a small cap, such as 3 usage and 2 protocol emails on one day, with reports inspected afterward.

### Phase 5: Full Daily Cadence

Enable the full 30/day cadence after dry-run and limited-send evidence is clean.

### Phase 6: Follow-Up Automation

Add the separate follow-up queue and sender only after cold outreach automation is stable.

## Acceptance Criteria

The system is ready for full autonomous use when:

- daily queue fill creates no more than 20 usage and 10 protocol rows
- every queue row has a stable idempotency key
- every send attempt is recorded
- duplicate guard and live Gmail checks both run immediately before sending
- test coverage proves duplicate, stale-snapshot, warm-thread, and retry-safety behavior
- dry-run sender produces correct `would_send` and `blocked` reports
- limited autonomous sending completes without duplicates or warm-thread mistakes
- reports make every autonomous send auditable after the fact

## Non-Goals

- Building a public CRM UI.
- Replacing Gmail as the delivery provider.
- Using Gmail labels as the authoritative state.
- Automatically selecting targets from the open web without a reviewable candidate source.
- Automating college recommendation-letter asks.
- Sending second or third follow-ups by default.
