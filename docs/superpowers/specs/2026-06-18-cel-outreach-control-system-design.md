# CEL Outreach Control System Design

## Goal

Create a durable local control system for Campus Evidence Lab outreach that can ingest current Gmail/CEL state, preserve the existing preflight checklist as a required gate, prevent duplicate drafts/scheduled outreach, and generate reviewable tracker outputs for future campaigns.

## Current Problem

The current workflow mixes research, Gmail search, checklist review, drafting, and scheduling into one session. That makes each batch slow and increases the risk that a stale draft, scheduled-looking item, or warm relationship is missed. The current spreadsheet builder hardcodes batches and statuses, so it is useful as a snapshot but not strong enough to prevent duplicate outreach over hundreds of contacts.

## Architecture

The system uses a local SQLite database as the canonical outreach state. CSV/XLSX files are generated views for review, not the source of truth.

Core layers:

- Gmail state ingestion: CEL-related drafts, sent items, replies, starred relationship threads, future-looking drafts, and Gmail labels are imported into `gmail_items`.
- Relationship state ingestion: `outreach/relationship-ledger.csv` is imported into `relationship_events` and organization/contact records.
- Checklist enforcement: every campaign target must have a current preflight run referencing `outreach/outreach-preflight-checklist.md` before it can be approved for drafting.
- Duplicate guard: exact email, organization/domain, warm relationship, existing draft, sent history, and scheduled/future CEL conflicts are written to `duplicate_flags`.
- Review outputs: reports summarize eligible, blocked, warm-only, and manual-review targets before any new draft batch is created.

## Data Model

`contacts`

- `id`: stable slug.
- `name`, `email`, `organization_id`, `domain`.
- `category`, `status`, `relationship_status`.
- `created_at`, `updated_at`.

`organizations`

- `id`: stable slug.
- `name`, `domain`, `aliases`.
- `relationship_status`, `block_level`, `notes`.

`gmail_items`

- `id`: Gmail message ID or synthetic import ID.
- `thread_id`, `item_type`, `subject`, `from_email`, `to_emails`, `labels`.
- `email_ts`, `snippet`, `body_excerpt`.
- `is_cel`, `is_future_or_scheduled`, `person_key`, `domain_key`, `organization_key`.

`relationship_events`

- `id`: stable event ID.
- `contact_id`, `organization_id`, `event_type`, `event_date`.
- `permission`, `block_level`, `next_action`, `next_action_date`, `notes`.

`campaigns`

- `id`, `name`, `target_send_date`, `campaign_type`, `status`.

`campaign_targets`

- `id`, `campaign_id`, `contact_id`, `organization_id`.
- `intended_ask`, `template_type`, `approval_status`, `draft_status`, `scheduled_date`.
- `preflight_run_id`.

`preflight_runs`

- `id`, `campaign_id`, `target_id`, `checklist_path`, `checklist_sha256`.
- `ran_at`, `result`, `notes`.

`duplicate_flags`

- `id`, `target_id`, `contact_id`, `organization_id`.
- `flag_type`, `severity`, `evidence_item_id`, `evidence_summary`, `created_at`.

## Duplicate Guard Rules

The guard blocks or flags targets using these rules:

- `exact_email_existing_draft`: same email appears in a non-trash CEL draft.
- `exact_email_sent`: same email has already received CEL outreach.
- `future_or_scheduled_conflict`: same person, email, domain, or organization appears in CEL-labeled scheduled/future-looking outreach.
- `warm_org_conflict`: organization has a relationship-ledger status such as packet sent, feedback received, call scheduled, routed internally, declined, or redirected.
- `org_recent_activity`: same organization has recent CEL draft/sent activity and is not manually approved.
- `same_person_alias`: same person name appears with another email or thread.

Hard-block statuses from the checklist must block cold outreach. Soft conflicts become `needs_manual_review`.

## Required Workflow

1. Sync Gmail/CEL state into `gmail_items`.
2. Import `outreach/relationship-ledger.csv`.
3. Add or import candidate targets.
4. Run preflight for each target using `outreach/outreach-preflight-checklist.md`.
5. Run duplicate guard.
6. Generate reports.
7. Draft only targets with `approval_status = approved_for_draft`.
8. After drafts are created or scheduled, sync Gmail again.

## Outputs

Initial outputs:

- `outreach/control/cel-outreach.sqlite`: canonical database.
- `outreach/control/reports/duplicate-flags.csv`: duplicate and relationship conflicts.
- `outreach/control/reports/campaign-targets.csv`: campaign target status view.
- `outreach/control/reports/gmail-items.csv`: imported Gmail state view.
- `outreach/control/README.md`: operator guide.

Later output:

- generated XLSX tracker view replacing hardcoded rows in `outreach/build_outreach_tracker.mjs`.

## Non-Goals

- Automatically sending emails.
- Permanently deleting Gmail messages.
- Replacing human review for warm relationships.
- Publishing private relationship details to the public site.

## Success Criteria

- Current CEL Gmail state can be imported into local canonical storage.
- The relationship ledger is imported and influences duplicate flags.
- The checklist path and hash are recorded for preflight runs.
- Duplicate reports identify exact email, domain/org, sent-history, draft-history, future/scheduled-looking, and warm relationship conflicts.
- Future campaign drafting can require a clean preflight result before any draft is created.
