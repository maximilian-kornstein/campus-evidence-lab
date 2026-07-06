# Corrections And Right-Of-Reply Policy

## 1. Purpose

Campus Evidence Lab (referred to throughout as "the project," "we," or "us") maintains a public-source archive of campus civil-rights-related records. Because records are drawn from public sources and processed through a mix of automated assistance and human review, errors, ambiguities, and disputes are expected. This policy establishes how corrections are requested, evaluated, and resolved, and how named institutions and individuals may respond to records that concern them. It exists to keep the dataset accurate, traceable, and fair to the people and institutions it describes, without turning the project into an adjudicator of legal disputes.

This policy applies to all event records, school records, source records, and associated metadata published by the project, including CSV/JSON exports and generated public pages.

## 2. Who May Submit

Corrections, duplicate reports, and right-of-reply submissions may be made by:

- Any member of the public who identifies a factual error, outdated information, duplicate entry, or missing public-source context.
- A school or other named institution, or an authorized representative of that institution, seeking to correct a record or append an institutional response.
- An individual named or identifiable in a record, where the request concerns factual accuracy, privacy, or safety rather than a request to remove a record solely because it is unfavorable.
- Contributors and reviewers identified through the project's GitHub repository or structured submission channels.

Submissions may be made anonymously, but anonymous submissions lacking verifiable public-source support will generally receive lower priority and may require additional corroboration before action is taken.

## 3. Submission Channels

Correction requests, duplicate reports, source submissions, and school metadata corrections must be submitted through the project's GitHub issue templates or the site's structured submission page. Submissions made through other channels (email, social media, direct message) will not be treated as valid corrections and will not create an obligation to act, though the project may, at its discretion, redirect such contacts to the proper channel.

## 4. Required Information For Correction Requests

A correction request must include:

1. Identification of the specific record or records at issue (record ID, URL, or sufficient descriptive detail to locate it).
2. A clear statement of what is alleged to be incorrect, outdated, duplicated, or improperly sourced.
3. The corrected information being proposed, where applicable.
4. Public-source citation(s) supporting the proposed correction (see Section 6). Citations should be specific enough to allow independent verification (e.g., a direct link, court docket number, publication name and date, or archived copy reference).
5. The nature of the requester's relationship to the record, if relevant to the request (e.g., named individual, school representative, unaffiliated member of the public).
6. Any request for redaction, correction-log annotation, or takedown, stated explicitly.

Requests missing required elements may be marked "needs more evidence" and held pending additional information rather than acted upon or rejected outright.

## 5. Required Information For Institutional Replies

A school or other named institution seeking to exercise its right of reply must submit:

1. Identification of the specific record(s) the reply addresses.
2. The text of the proposed reply or response.
3. Confirmation of the submitter's authority to speak on behalf of the institution, or a statement of the submitter's role if authority cannot be independently confirmed.
4. Any public-source material the institution wishes to cite in support of its response.

Institutional replies are treated as a distinct category from corrections: a reply may be appended to a record without altering the underlying record content, whereas a correction request seeks to change the record itself.

## 6. Public-Source Support Requirement

Consistent with the project's evidence rules, no correction, reply, or dataset entry will incorporate private testimony, private screenshots, direct messages, doxxing, sensitive personal information, or unsupported allegations. Any factual claim offered in support of a correction or reply must be traceable to a public source. Material that is not public-source-supported will not be added to a record, even if submitted as part of an otherwise valid correction or reply, though it may inform internal review without being published.

## 7. Handling Of Unsupported, Private, Confidential, Abusive, Or Overbroad Requests

- **Unsupported requests**: Requests lacking public-source support will be marked "needs more evidence" and held open for a defined period to allow supplementation, after which they may be closed as rejected.
- **Private or confidential material**: Any private testimony, private communications, or sensitive personal information submitted as part of a request will not be published and will not be used as a basis for a public correction. Such material may be considered only for the limited purpose of assessing whether an expedited redaction is warranted (Section 12).
- **Abusive submissions**: Requests containing harassment, threats, doxxing attempts, or abusive language toward record subjects, institutions, contributors, or reviewers will be closed without substantive action and may result in the submitter being barred from future submissions.
- **Overbroad requests**: Requests seeking removal of an entire record, source, or school's records without specific, sourced factual objections will not be treated as a substantive correction request. Such requests will be evaluated only against the standards in Section 13 (no removal solely because a record is disputed) and Section 12 (expedited redaction), as applicable.

## 8. Possible Outcomes

Each correction or reply request will be resolved with one of the following outcomes, recorded in the correction log:

- **Accepted correction**: The proposed change is adopted in full.
- **Partial correction**: Some but not all proposed changes are adopted.
- **Rejected correction**: The proposed change is not adopted, with a stated rationale.
- **Needs more evidence**: The request is held pending additional public-source support.
- **Duplicate merge**: The record is merged with an existing record covering the same event or subject.
- **Redaction**: Specific fields or content are removed or obscured, typically due to privacy or safety concerns.
- **Takedown**: A record is removed from publication entirely, typically only where continued publication would violate the project's evidence rules or expose private or unsupported allegations without adequate source support.
- **Response appended**: An institutional or subject reply is added directly to the record.
- **Response linked**: An institutional or subject reply is referenced via link rather than reproduced in full, typically for lengthy responses.
- **No change**: The record is reviewed and left as published, with rationale recorded.

## 9. Publication Of Correction Rationale

For every resolved correction or reply request, the project will publish a rationale summarizing what was requested, what public-source material was considered, and the outcome reached. This rationale is recorded in the correction log and, where the outcome affects a published record, linked from that record. Rationale will describe the basis for the decision without reproducing private, confidential, or unsupported material that was excluded under Section 7.

## 10. Updates To Hashes, Snapshots, Release Notes, And Correction Logs

When a correction, redaction, or takedown is accepted (in whole or in part):

1. The affected record's hash is regenerated to reflect the updated content.
2. The dataset hash for the relevant export (CSV/JSON) is regenerated to reflect the change.
3. A new snapshot manifest entry is created capturing the pre-change and post-change state.
4. Release notes are updated to describe the nature of the change at a level of detail consistent with this policy (i.e., without republishing excluded private or unsupported material).
5. The correction log is updated with the request, outcome, and rationale under Section 9.

No record content is altered outside of this documented process, and no correction is applied retroactively to prior snapshots; prior snapshots remain as historical record, with the correction reflected prospectively.

## 11. Right-Of-Reply Limits

Institutional and subject replies accepted for publication are subject to the following limits:

- Replies may be summarized rather than reproduced verbatim, where length or format requires it.
- Replies may be linked to an external source rather than hosted in full.
- Replies may be edited for safety, formatting, or length, provided such edits do not change the substantive meaning of the reply.
- Replies may be rejected where they contain private, confidential, abusive, or unsupported material inconsistent with Sections 6 and 7.
- Acceptance of a reply is not an endorsement of its content and does not constitute a finding that the reply is accurate; it is presented as the institution's or subject's own statement.

## 12. Expedited Redaction Path

Where a submission credibly identifies any of the following, the project will prioritize review and may act on an expedited basis, ahead of the standard correction queue:

- Private testimony, private communications, or sensitive personal information published in apparent violation of the project's evidence rules.
- A credible safety risk to a named individual arising from published content.
- A clear violation of this policy or the project's evidence rules that is apparent on the face of the record without requiring extended fact-finding.

Expedited redaction may result in temporary removal or obscuring of the affected content pending full review, followed by a standard resolution recorded under Sections 8 through 10.

## 13. No Adjudication Of Disputes

The project does not adjudicate legal disputes, determine truth in contested factual matters, or make findings of legal liability. Corrections and replies are evaluated solely against public-source support, the project's evidence rules, and the record-keeping standards in this policy. A record will not be removed, hidden, or altered solely because it is disputed by a subject or institution; removal, redaction, or takedown occurs only where warranted under Sections 7, 8, and 12. Consistent with the project's core limits, no record, correction, or reply constitutes legal advice, a legal finding, a ranking, a safety score, a prevalence estimate, a severity score, or an endorsement.

## 14. Review-Tier Changes After Corrections

A record's review tier (imported public source, source-family checked, internally certified, or externally reviewed) may change as a result of the correction process:

- A record may move to a higher tier where a correction is resolved through verification against additional public sources or through externally reviewed confirmation.
- A record may move to a lower tier where a correction, partial correction, or redaction reveals that prior sourcing was weaker than previously reflected.
- Duplicate merges carry forward the highest review tier supported by the surviving public-source record.
- Any tier change resulting from a correction is recorded in the correction log alongside the rationale required under Section 9.

## 15. Role Of Automated Assistance

Automated tools may assist in processing correction requests, extracting cited source material, detecting duplicates, and drafting rationale text. Automated assistance does not independently resolve a correction, does not independently change a record's review tier, and does not substitute for human review of higher-tier statuses. All outcomes under Section 8 are subject to human confirmation before publication.