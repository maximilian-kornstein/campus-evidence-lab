# Outreach Preflight Checklist

Use this before drafting or sending any Campus Evidence Lab outreach. If any step fails, stop and ask Maximilian before drafting.

## 0. Confirm batch policy

Before any new daily batch, confirm:

- all public links use `https://campusevidencelab.org/`
- no new or revised draft uses `https://maximilian-kornstein.github.io/campus-evidence-lab/` unless the primary domain is unavailable
- the batch has no more than 30 total targets
- the batch is split into 20 standard CEL targets and 10 protocol-adjacent targets
- the protocol-adjacent targets are framed as coming-soon advice/routing/design-feedback outreach, not as a live-protocol announcement

## 1. Check the relationship ledger

Open `outreach/relationship-ledger.csv`.

Hard stop if the target's email, domain, organization, or obvious alias appears with any of these statuses:

- `Packet sent / engaged`
- `Feedback received / permission-limited`
- `Call scheduled`
- `Routed internally`
- `Declined`
- `Redirect suggested`

Allowed message types after a hard stop:

- direct reply in the existing thread
- post-call thank-you
- specific answer to a question they asked
- milestone update after the listed `next_action_date`
- recommendation-letter ask only much later, when Maximilian is actually applying to college

Not allowed:

- cold template
- first-touch pitch
- generic follow-up
- outreach to another person at the same organization without manual review

## 2. Search Gmail before drafting

Run targeted Gmail searches for all of these:

```text
(email@example.org OR example.org OR "Organization Name") -in:trash
"Person Name" -in:trash
("Campus Evidence Lab" OR "campus civil-rights" OR "public-source archive") (email@example.org OR example.org) -in:trash
```

Before creating or revising any draft, also run a CEL-label sweep that includes drafts, sent mail, replies, and scheduled/future-looking outreach:

```text
label:CEL (email@example.org OR example.org OR "Organization Name" OR "Person Name") -in:trash
("Campus Evidence Lab" OR "campus civil-rights" OR "public-source archive") (email@example.org OR example.org OR "Organization Name" OR "Person Name") -in:trash
```

Also check:

- `STARRED`
- `SENT`
- `DRAFT`
- all CEL-labeled mail for the target person, email, domain, and organization
- scheduled/future-looking CEL outreach, including reminder drafts and follow-up labels
- every relevant `CEL/Outreach/YYYY-MM-DD` label
- every relevant `CEL/Followup/Drafts/...` label
- `CEL/Outreach/Domain Migrated 2026-06-20`, which holds the 168 domain-migrated drafts whose prior scheduling labels may not have survived Gmail draft updates

Hard stop if Gmail shows:

- the person replied
- the person was sent a packet
- a call is scheduled
- a draft already exists
- a scheduled/future CEL item already exists for the same person, domain, or organization
- the same organization has multiple recent sends or drafts
- the recipient declined, redirected, or sent an out-of-office that changes routing

If an existing CEL draft or scheduled/future item is found, update or delete the existing item only after manual review. Do not create a second draft for the same person, domain, or organization.

## 2A. Check the autonomous control plane

Open the latest local reports under `outreach/control/reports/` and, if needed, inspect `outreach/control/cel-outreach.sqlite` directly.

Hard stop if the autonomous queue or send-attempt history shows any duplicate or active row for the same:

- target
- Gmail thread
- recipient email
- domain
- organization
- idempotency key

Hard stop if any of these are true:

- `outreach_queue` already has a `planned`, `draft_created`, `ready_to_send`, or `sent` row for the same target, thread, domain, or organization
- `send_attempts` already has `result = 'sent'` for the same idempotency key
- `followup_queue` already has a candidate, draft, ready, sent, blocked, or error row for the same source thread and sequence
- an autonomous row is `blocked` or `error` for the same target, thread, domain, organization, or idempotency key and has not been manually reviewed
- `outreach/control/reports/blocked-autonomous-sends.csv` lists the same target, thread, domain, organization, or idempotency key
- the local Gmail snapshot is missing, incomplete, or more than 24 hours old

Blocked autonomous rows are not replacement capacity. Do not add another target from the same organization, domain, thread, or idempotency context in the same run.

## 3. Apply the organization-level rule

If one person at an organization is meaningfully engaged, the whole organization becomes `warm` until manually reviewed.

For warm organizations:

- do not send new cold outreach to another person there just because they are on a list
- decide whether the existing contact should be the relationship owner
- if contacting another person is still justified, mention why and keep it narrow

Current warm organizations from the audit:

- The Hechinger Report, because Meredith Kolodner is engaged and several Hechinger sends/drafts already exist.
- ADL, because Masha Zemtsov provided feedback and permission limits.
- AMCHA Initiative, because Naomi Younger has a call scheduled.
- Clery Center, because Kristen Sweeney routed the project internally.
- ProPublica, because Mollie Simon responded and several ProPublica contacts have already been contacted.
- Penn State Dickinson Law / Penn State, because Andrea Martin has a Zoom call scheduled.

## 4. Relationship-warming cadence

Do not stay in touch just to stay visible. Send only when there is a real reason.

Suggested cadence:

- after a call: thank-you within 24 hours, with one concrete next step
- after feedback is incorporated: send a short update showing the change
- no open loop: wait 4-8 weeks before a light milestone update
- college recommendation season: ask only after the relationship has substance and the application timeline is real

For Masha / ADL:

- no immediate follow-up needed
- use her feedback without naming her or ADL
- next good touch is a meaningful milestone or incorporated-feedback update

For Naomi / AMCHA:

- next touch is the July 9, 2026 call at 5:00 PM ET
- after the call, send thanks plus any promised artifact

For Meredith / Hechinger:

- wait for her response to the packet
- do not cold-contact Meredith again
- pause additional generic Hechinger outreach unless Maximilian explicitly approves a targeted reason

## 5. Draft review line

Every future outreach batch should include a short preflight note before drafts are created:

```text
Preflight checked against Gmail search, CEL-labeled mail, starred relationship threads, drafts, sent mail, scheduled/future-looking outreach, and outreach/relationship-ledger.csv. Blocked contacts/orgs are listed below with the reason for removal. Remaining recipients appear to be first-touch or manually approved.
```

If that sentence cannot be made honestly, do not draft the batch.
