# Takedown And Redaction Policy

## 1. Purpose

Campus Evidence Lab (referred to here as "the project," "we," or "us") maintains a static-first public archive of campus-related civil rights records drawn from public sources. Because the project publishes information that can affect real people and institutions, we maintain a structured process for reviewing requests to redact, correct, or remove content. This policy explains what can be redacted or taken down, what information a request must include, how urgent safety or privacy matters are handled, and what limits apply to removal given that the project's software and data are published openly and may already be copied, cached, or reused by others.

This policy is not legal advice, is not a legal finding, and does not create any right to removal beyond what is described below. Every request is reviewed on its own facts, and the outcome of a review is not an admission that a record was inaccurate, improper, or wrongly published.

## 2. Grounds For Redaction

Redaction means removing, masking, or limiting specific fields or portions of a record while the underlying record may otherwise remain in the archive. We will consider redaction where a record contains one or more of the following:

- **Private personal information** not necessary to understand the public-source event, such as personal identifiers unrelated to the substance of the record.
- **Private contact information**, including personal phone numbers, personal email addresses, or home addresses of individuals named in a record.
- **Minors identified inappropriately**, where a minor is named or identifiable in a way that is not necessary to the public-source record or that exposes the minor to harm.
- **Doxxing risk**, meaning information that, alone or combined with other published fields, could be used to locate, harass, or target a named individual.
- **Safety risk**, meaning information whose publication could reasonably endanger a person's physical safety or wellbeing.
- **Confidential material**, meaning information that was not lawfully public at its source or that appears to have been obtained through a confidentiality-protected channel.
- **Private screenshots**, meaning images of private conversations, private accounts, or private platforms that were not lawfully public.
- **Direct messages**, meaning the content of private one-to-one or private group communications.
- **Unsupported allegations**, meaning claims presented as fact that are not tied to a public source and cannot be verified against one.
- **Source mistake**, meaning the underlying public source was itself later corrected, retracted, or shown to be inaccurate.
- **Copyright issue**, meaning the record incorporates material in a way that raises a good-faith copyright concern, handled under Section 8.
- **Clear policy violation**, meaning the record was added in violation of the evidence rules in this project's data model, including reliance on private testimony, private screenshots, direct messages, doxxing, sensitive personal information, or unsupported allegations.

## 3. Takedown Grounds And Narrower Alternatives

Takedown means removing an entire record from public pages and exports, rather than redacting specific fields. Because takedown removes public-source information that may still have legitimate public interest, we treat it as a stronger step than redaction and use it only where redaction cannot adequately address the concern. Before granting a full takedown, we consider whether one of the following narrower alternatives can resolve the issue instead:

- Redacting specific fields or passages while keeping the remainder of the record published.
- Downgrading a record's review tier, together with a published limit noting the reasons for reduced confidence.
- Adding a correction note or right-of-reply note to the record rather than removing it.
- Removing a specific attachment, image, or linked exhibit while keeping the underlying event record.
- Marking a record as disputed or under review pending further verification.

Full takedown will be considered where a record consists substantially of private testimony, private screenshots, direct messages, doxxing-enabling material, confidential material, or content that presents a clear and immediate safety risk, and where none of the narrower alternatives above would adequately address the concern. Takedown will also be considered where a record was published in clear violation of the evidence rules and cannot be salvaged through redaction.

## 4. Information Required For A Request

To review a redaction or takedown request, we need enough information to identify the record and evaluate the claim. A request should include:

- The specific record, page, export row, or snapshot identifier affected, or enough detail (names, dates, source links) to locate it.
- The specific ground from Section 2 or Section 3 being asserted.
- A description of the harm or inaccuracy, including why the information is private, unsafe, unsupported, or otherwise improper to publish.
- Any supporting material, such as a corrected or retracted source, evidence of private origin, or evidence of the requester's relationship to the record (for example, being the subject of the record).
- The requested outcome: redaction of specific fields, full takedown, a correction note, or a review-tier change.
- Contact information sufficient for us to follow up on the request, which will itself be treated as private submission information and not published.

Requests may be submitted through GitHub issue templates or the site's structured submit page, consistent with the project's correction channels.

## 5. Expedited Handling For Safety Or Privacy Risk

Requests asserting doxxing risk, safety risk, minors identified inappropriately, private contact information, direct messages, or private screenshots are treated as expedited. For expedited requests:

- The affected fields or record are provisionally hidden from public pages and future exports while review is conducted, rather than left published pending a full review cycle.
- Review is prioritized ahead of non-expedited correction and takedown requests.
- If the initial review cannot be completed quickly, the provisional hold remains in place rather than defaulting back to publication.

Expedited handling addresses the immediate exposure while the underlying request is evaluated against the grounds in Sections 2 and 3; it is not itself a final determination.

## 6. Public-Source Records That May Remain Published After Review

Not every request results in redaction or takedown. A record may remain published, in whole or in part, where it is:

- Drawn from a genuinely public source and does not contain private personal information, private contact information, doxxing-enabling detail, confidential material, private screenshots, or direct message content.
- Supported by an identifiable public source, even if a subject of the record disagrees with the source's characterization of events.
- Already limited to the tier-appropriate confidence level, with any applicable limits, corrections, or right-of-reply notes attached.
- The subject of a takedown request based solely on reputational objection to accurate, public-source information, since disagreement with accurate reporting is not itself a ground for removal under Section 2 or Section 3.

Where a record remains published following review, we will note in the record's history that a request was received and evaluated, without necessarily disclosing the requester's identity or private submission details.

## 7. Source Removal Or Link Rot

Public records are drawn from public sources that we do not control. Where an underlying source is later deleted, moved, or becomes otherwise unavailable:

- The record's citation will be updated to reflect the source's unavailability where this is discovered.
- Snapshot manifests and prior exports retain the source reference and any archived context that was captured at the time of import, consistent with the project's review and snapshot model.
- Source unavailability alone is not treated as a retraction of the underlying record; if the disappearance of a source is accompanied by evidence that the source itself was mistaken or retracted, the record is instead evaluated under the source-mistake ground in Section 2.
- Where a source becomes unavailable and no independent corroboration exists, the record's review tier may be downgraded to reflect reduced verifiability.

## 8. Copyright Complaints

Where a record or an attached exhibit incorporates material that a rights holder believes infringes their copyright, we will review the complaint and, where appropriate, remove or restrict the specific material at issue. This process is a good-faith, plain-English review process; it does not constitute a formal statutory takedown procedure, and the project does not claim status as a registered copyright agent under any particular jurisdiction's copyright statute. A copyright complaint should identify the specific material at issue, the copyrighted work it is said to infringe, and the basis for the complaint. Because the underlying software is MIT licensed and dataset files are licensed under Creative Commons Attribution 4.0 International unless a source imposes stricter limits, complaints should address the specific record or exhibit at issue rather than the project's licensing terms generally.

## 9. Correction-Log, Release-Note, Hash, And Snapshot Updates

When a redaction or takedown request is accepted, the following updates are made as part of the same change:

- A correction-log entry is created describing the nature of the change (redaction, takedown, correction, or tier change) without necessarily reproducing the redacted content itself.
- A release note is issued describing the change at a level appropriate for public changelog review.
- Affected CSV/JSON exports and generated public pages are regenerated to reflect the accepted change.
- A new snapshot manifest and corresponding hash are generated to reflect the updated dataset state, so that the prior and revised states of the dataset remain distinguishable.
- Prior snapshot manifests and hashes are not altered retroactively; they remain as a historical record of what was published at that time, consistent with the project's snapshot and review-log model.

## 10. GitHub History And Downstream Reuse Limits

The project's software is MIT licensed, and dataset files are licensed under Creative Commons Attribution 4.0 International unless a source imposes stricter limits. Because of this, and because the project operates through a public GitHub repository:

- Accepted redactions and takedowns are applied to the current public website, current exports, and current snapshot going forward, but prior commits, issues, pull requests, and snapshot manifests already published in GitHub history may remain visible in that history.
- Copies of the dataset or repository already downloaded, forked, mirrored, or redistributed by third parties before a redaction or takedown was applied are outside the project's control, and this policy cannot compel their removal.
- Where feasible, we will note in the current release notes and correction log that a prior version contained material that was later redacted or removed, so that downstream reusers have notice of the change.
- Requesters should understand that acceptance of a redaction or takedown request addresses the project's current public output but does not guarantee removal from all historical or downstream copies.

## 11. Abusive Or Bad-Faith Requests

Requests submitted to harass a requester's opponent, to suppress accurate public-source information for reputational reasons, to intimidate contributors, or that misrepresent the requester's relationship to a record will not be granted on their stated terms. Indicators of an abusive or bad-faith request include repeated resubmission of a previously denied request without new information, requests that misstate the content of the record, requests aimed at records about the requester's own conduct without addressing any of the grounds in Section 2 or Section 3, and requests accompanied by threats or harassment directed at contributors or reviewers. Records or discussion associated with abusive or bad-faith requests may be documented in the correction log, and repeated bad-faith submissions may result in the submitter's future requests receiving reduced priority or closer scrutiny.

## 12. Institutional Response And Interaction With Takedown Requests

Schools and other named institutions have a correction and right-of-reply path independent of the takedown and redaction grounds in this policy. An institution's submission of a correction, clarification, or right-of-reply statement is handled as a correction-log addition to the relevant record and is not, by itself, treated as a request for redaction or takedown. Where an institution instead requests redaction or takedown of a record concerning it, that request is evaluated under the same grounds and process described in Sections 2 through 5, and accurate public-source information is not removed solely because a named institution disputes its characterization or prefers it not be published. Institutional right-of-reply content is itself subject to the evidence rules in this policy: it must relate to a public-source record and may not be used to introduce private personal information, private contact information, or unsupported allegations about other individuals.