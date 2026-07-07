# Reviewer Outreach Notes

## Current Batch

First outreach batch sent on 2026-06-05.

Before drafting any new batch or follow-up, run `outreach/outreach-preflight-checklist.md` and update `outreach/relationship-ledger.csv`. Do not rely on memory, starred mail alone, or a single date label. A contact or organization that has replied, received a packet, scheduled a call, routed the project internally, declined, or has a future draft is not eligible for cold outreach without manual review.

## Current Link Policy

Use the primary domain in all new and revised outreach:

```text
Public site: https://campusevidencelab.org/
Research guide: https://campusevidencelab.org/research-guide/
Press brief: https://campusevidencelab.org/press/
Journalist guide: https://campusevidencelab.org/journalist-guide/
Reviewer brief: https://campusevidencelab.org/reviewer-brief/
```

Do not use the old GitHub Pages URL in new drafts except as a fallback if the primary domain is unavailable.

## Daily Outreach Composition

Starting with future batches, daily outreach capacity is 30 total targets:

- 20 core CEL outreach targets: organizations, journalists, professors, clinics, civil-rights reviewers, student newsrooms, and public-interest reporting/research contacts.
- 10 protocol-adjacent targets for the coming-soon Campus Evidence Lab open-source crypto protocol.

The 10 protocol-adjacent targets should come from these categories:

- antisemitism research organizations
- data journalists and investigative reporters
- journalism innovation labs
- law school civil-rights clinics
- professors studying hate, discrimination, extremism, or campus climate
- civic tech organizations
- open-source public-interest technologists
- crypto public-goods builders
- data provenance / attestation protocol builders
- nonprofit technology grantmakers
- AI accountability researchers
- digital archive and preservation groups
- student civil-rights organizations
- university policy researchers

Protocol-adjacent outreach should still be framed carefully: the protocol is coming soon, so the ask should be for advice, fit, routing, collaboration perspective, or protocol-design feedback, not a claim that the protocol is already live.

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
- `Use-test offered`
- `Use feedback received`
- `Call scheduled`
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
- `Use test`
- `Reporting workflow`
- `Routing`
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

I know trying a new archive may not be realistic. Even one sentence on whether it seems useful for reporting, research, routing, or issue tracking would help me decide what to improve next.

Public site: https://campusevidencelab.org/
Research guide: https://campusevidencelab.org/research-guide/

Thank you,
Maximilian Kornstein
```

## Next Batch Rule

Do not send large batches just to increase volume. Prefer targeted outreaches where the recipient can plausibly use the archive, route it to someone who can, or provide a narrow review.

Good next categories for third-party use:

- student newspapers and campus newsrooms
- higher-education journalists
- civil-rights reporters and editors
- public-data and accountability reporters
- organizations that route resources to reporters, researchers, or campus professionals

Good next categories for critical review:

- university civil-rights research centers
- law school civil-rights clinics
- data journalism labs
- professors studying hate, higher education, civil rights, discrimination, or public data

## Primary Use Ask

For journalists, student newsrooms, researchers, and organizations that may actually use the archive, lead with real use:

```text
Would you be willing to try Campus Evidence Lab for one real reporting, research, routing, or issue-tracking question and tell me what would make it more useful?
```

The goal is not coverage by default. The goal is to learn whether the archive works outside Maximilian's own workflow.

## Secondary Review Ask

For legal, civil-rights, and methodology-heavy contacts, the strongest ask is still critical review, not endorsement:

```text
Would someone be willing to review the methodology page, source standards, use-limit language, or 10 sample records and tell me what feels weak, overstated, missing, risky, or methodologically immature?
```

Use this link for future outreach once published:

```text
Reviewer brief: https://campusevidencelab.org/reviewer-brief/
```

## Narrow-Ask Rule

Cold outreach should default to one of these use asks:

- try one real search or reporting workflow
- test one school dossier or community filter
- identify whether the archive would help with routing, research, or issue tracking
- tell us what would make the archive easier to use

For expert reviewers, cold outreach can still use one of these review asks:

- one-page methodology review
- one-page responsible-use / no-ranking review
- 10-record source-audit review

Do not ask strangers to review the whole project unless they explicitly offer.

## Conversion Rule

If someone replies positively, stop using the broad cold-email template.

Move immediately to:

- ask what question they want to use the archive for
- send a relevant filtered view, school page, source page, or 5-record sample
- send the reviewer brief
- send the 10-record packet when useful
- ask the three narrow review questions
- log the reply in the tracker

Also mark the person and, when appropriate, the organization as warm in `outreach/relationship-ledger.csv`. Future contact should continue the relationship; it should not restart the cold outreach sequence.

The first positive reply should convert into a documented use or review task, not another broad email.

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
- `Call scheduled with Naomi Younger for 2026-07-09 at 5:00 PM ET.`
- `Asked recipient to try one reporting workflow and report what was confusing.`
- `Offered methodology review; waiting on packet send.`
- `Declined but suggested redirect to campus-policy colleague.`
- `Gave critical feedback on no-ranking language; site update needed.`

## FIRE Methodology Feedback

Claire Ottenstein forwarded Robert Shibley's methodology and research-guide comments on 2026-06-29. Treat this as private implementation feedback, not an endorsement, approval, partnership, or permission to name FIRE publicly.

Implemented standards from the feedback:

- minimum record fields
- source hierarchy
- deduplication
- reviewer checklist
- documentation-not-prevalence language
- responsible-use limits for counts, comparisons, rankings, and legal conclusions

Future replies may thank Claire and Robert for specific feedback and note concrete changes. Do not publish their names, quote them, or imply organizational approval unless explicit acknowledgment permission is granted.

## Jean Norman Journalism Feedback

Jean Norman of Weber State University replied on 2026-06-29 after reviewing the 10-record packet from a journalist perspective. Treat this as useful journalism/user feedback, not peer review, endorsement, or formal evaluation.

Implemented standards from the feedback:

- spell out Office for Civil Rights (OCR) on journalist-facing first references
- add Department of Education source-mix and time-window limitations to journalist guidance and methodology
- frame the current dataset as a current snapshot, not a complete longitudinal record
- preserve the possible future value of tracking changes over time without claiming prevalence or policy effectiveness

Future replies may thank her for the concrete journalist perspective and mention the source-mix and time-window limitations added because of it. Do not describe her response as peer review.

## RAND Education Feedback

Julia Kaufman and Heather Schwartz of RAND replied on 2026-07-06 after the RAND Education team outreach was routed internally. Treat this as private implementation feedback and an active warm thread, not endorsement, approval, partnership, or permission to name RAND publicly.

Implemented standards from the feedback:

- make proof that Campus Evidence Lab is Maximilian Kornstein's project visible on About, Trust, and License surfaces
- add a first-use researcher page with use cases, trial steps, and specific feedback questions
- make the postsecondary scope visible on the homepage before users interpret counts
- summarize the source universe and major source families before the dashboard
- surface under-reporting, public-source availability, and source-discovery limits before users interpret record counts

Future replies may thank Julia and Heather for the specific implementation feedback and send the researcher-start page after the changes are live. Do not imply RAND endorsement, formal review, or public approval.

## Eugene Volokh Methodology Boundary Feedback

Eugene Volokh of UCLA School of Law replied on 2026-06-29 and 2026-06-30 with methodology-scope questions. Treat this as private methodology feedback, not endorsement, approval, partnership, or permission to name him publicly.

Implemented standards from the feedback:

- state that the MVP is not a comprehensive First Amendment or student-speech archive
- state that political belief, viewpoint, and ideology are not standalone affected-community labels in the current MVP
- break out sexual orientation and gender identity as distinct documentation labels when public sources support that distinction
- require corrective public-source handling for false, unfounded, withdrawn, fabricated, or hoax allegations
- clarify that Zionist, anti-Zionist, Israel-policy, Palestinian-advocacy, or similar ideological language should not be converted into protected-community labels unless public sources support that framing

Future replies may thank him for the specific boundary questions and mention concrete methodology changes. Do not imply endorsement or public approval.
