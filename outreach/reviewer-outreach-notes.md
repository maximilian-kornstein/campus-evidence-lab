# Reviewer Outreach Notes

## Current Batch

First outreach batch sent on 2026-06-05.

The contact route is marked as `Unknown or mixed contact route` when the exact form or email is uncertain. This is acceptable for the tracker. Do not backfill details from memory unless the route can be verified from sent mail or a saved form receipt.

`cecr.psu.edu` was listed twice and is currently tracked as one organization with a duplicate-attempt note.

## Status Values

Use one of these values in `status`:

- `Not sent`
- `Sent`
- `Replied`
- `Declined`
- `Review offered`
- `Feedback received`
- `Follow-up sent`
- `Acknowledgment approved`

Avoid `Opened/seen` unless there is a reliable email-tracking signal. Normal email clients usually do not prove this.

## Feedback Type Values

Use one or more short values:

- `Methodology`
- `Source audit`
- `Record review`
- `Use limits`
- `Research guide`
- `Reviewer workflow`
- `Advisor conversation`
- `Other`

## Acknowledgment Permission Values

Use one of these values:

- `Unknown`
- `No`
- `Private only`
- `Name only`
- `Name + organization`
- `Quote approved`

Never publish a name, organization, quote, or implied endorsement without explicit permission.

## Follow-Up Rule

Wait 5-7 days before following up. For the 2026-06-05 batch, the first reasonable follow-up date is 2026-06-12.

Follow-up should be shorter than the original message:

```text
Hi [Name/Team],

I wanted to briefly follow up on my note about Campus Evidence Lab, a public-source campus civil-rights archive.

I know a full review may not be realistic. Even one sentence on what seems most risky, overstated, or methodologically weak would be useful.

Public MVP: https://maximilian-kornstein.github.io/campus-evidence-lab/
Reviewer brief: https://maximilian-kornstein.github.io/campus-evidence-lab/reviewer-brief/
Methodology: https://maximilian-kornstein.github.io/campus-evidence-lab/methodology/

Thank you,
Maximilian Kornstein
```

## Next Batch Rule

Do not send a large second batch immediately. Prefer 5-8 targeted outreaches after the reviewer brief exists.

Good next categories:

- university civil-rights research centers
- law school civil-rights clinics
- data journalism labs
- professors studying hate, higher education, civil rights, discrimination, or public data

## Review Ask

The strongest ask is critical review, not endorsement:

```text
Would someone be willing to review the methodology page, source standards, use-limit language, or 10 sample records and tell me what feels weak, overstated, missing, risky, or methodologically immature?
```

Use this link for future outreach once published:

```text
Reviewer brief: https://maximilian-kornstein.github.io/campus-evidence-lab/reviewer-brief/
```

## Narrow-Ask Rule

Cold outreach should default to one of these asks:

- one-page methodology review
- one-page responsible-use / no-ranking review
- 10-record source-audit review

Do not ask strangers to review the whole project unless they explicitly offer.

## Conversion Rule

If someone replies positively, stop using the broad cold-email template.

Move immediately to:

- send the reviewer brief
- send the 10-record packet when useful
- ask the three narrow review questions
- log the reply in the tracker

The first positive reply should convert into a documented review task, not another broad email.

## Reply Handling

Use these repo docs once outreach starts converting:

- `docs/outreach-email.md` for cold outreach and follow-up structure
- `docs/reviewer-response-playbook.md` for replies, packet sends, call offers, criticism, redirects, and acknowledgment questions

## Internal Logging Rule

When someone replies, update the tracker as soon as possible with:

- `status`
- `response_date`
- `feedback_type`
- `acknowledgment_permission`
- next step in `notes`

Good `notes` examples:

- `Requested 10-record sample packet on 2026-06-13.`
- `Offered methodology review; waiting on packet send.`
- `Declined but suggested redirect to campus-policy colleague.`
- `Gave critical feedback on no-ranking language; site update needed.`
