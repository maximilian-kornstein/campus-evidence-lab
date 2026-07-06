# Reviewer Agreement

## 1. Purpose and Scope

This Reviewer Agreement governs participation as a reviewer for Campus Evidence Lab, a static-first public evidence archive of United States campus-related public-source records. Reviewers assist in verifying, tiering, correcting, and documenting event records, school records, source records, review logs, correction logs, release notes, snapshot manifests, and related exports and generated pages. This agreement applies to anyone who reviews, certifies, tiers, or approves changes to records in the dataset, whether through the public GitHub repository, GitHub issues and pull requests, or the site's structured submission tools.

Campus Evidence Lab is not a corporation, law firm, or governing legal body. Reviewers act as contributors to the project and not as agents, employees, or representatives of any entity. Nothing in this agreement creates an employment, partnership, or attorney-client relationship between a reviewer and the project, and no such relationship should be represented to any third party.

## 2. Public-Source-Only Review

Reviewers may only rely on public-source material when evaluating, certifying, or advancing a record. Acceptable sources are limited to material that is already publicly accessible and independently verifiable, such as published news coverage, public institutional statements, public court or agency filings, and other material that a member of the public could locate without special access.

Reviewers must not introduce, rely on, request, or retain:

- private testimony not otherwise public,
- private screenshots or private message contents,
- direct messages or private correspondence,
- doxxing material or information intended to expose a private individual's identity or location without a public-source basis,
- sensitive personal information not already publicly disclosed in a qualifying public source, or
- unsupported allegations that lack any identifiable public-source basis.

If a reviewer receives any of the above material through a correction request, submission, or outside communication, the reviewer must not use it to advance, certify, or alter a record's tier, and should route the matter as described in Section 11.

## 3. Neutrality and Source-Faithful Language

Reviewers must evaluate and edit records neutrally. Review work must track what a public source actually states, using source-faithful language rather than a reviewer's own characterization, inference, or embellishment. Where a source is ambiguous, incomplete, or disputed, the record and any reviewer notes must reflect that ambiguity rather than resolve it through the reviewer's personal judgment.

Reviewers must not add editorializing language, speculative motive, or characterizations that go beyond what the cited public source supports. Category labels, affected-community labels, and institutional-response descriptions must be grounded in the source material, not in a reviewer's personal assessment of the underlying conduct.

## 4. Conflict Disclosure

A reviewer must disclose any conflict of interest before reviewing or certifying a record. A conflict of interest includes, without limitation, any current or past affiliation with a school, organization, or individual named in the record, any personal involvement in the underlying event, or any other relationship that could reasonably affect the reviewer's neutrality.

Where a conflict exists, the reviewer must not independently certify or advance the record's tier and must instead flag the conflict so that another reviewer without the conflict can perform the review.

## 5. Prohibited Public Claims

Neither the dataset nor any individual record may be described, publicly or in any reviewer communication, as any of the following:

- an endorsement of, or partnership with, any school, organization, or individual;
- a legal finding or legal advice;
- an externally validated result, unless a specific record has in fact undergone external review consistent with Section 6 and is labeled accordingly;
- a ranking of schools or institutions;
- a school safety score;
- a prevalence estimate of campus civil-rights incidents; or
- a severity score of any incident.

Reviewers must not make or imply any of the above claims in commit messages, issue comments, pull request descriptions, correction responses, or any other project communication, and must correct any such claim if one is discovered in existing project material.

## 6. Review Tiers

Records in the dataset may carry one of the following tiers:

**Imported public source.** The record reflects a public source that has been added to the dataset but has not yet undergone reviewer checking. A reviewer may create or update a record at this tier by citing a qualifying public source, but may not represent the record as checked or certified.

**Source-family checked.** The record has been checked against its cited source and, where available, related sources reporting on the same event, for basic consistency (dates, parties, described conduct, and source attribution). A reviewer may certify this tier only after performing the checks described in Section 7.

**Internally certified.** The record has undergone the source-family check described above and has additionally been reviewed for category accuracy, affected-community label accuracy, and institutional-response completeness as described in Sections 8 and 9. A reviewer may certify this tier only after completing those checks and documenting them per Section 12.

**Externally reviewed.** The record has undergone additional review by a party outside the core project reviewer group. A reviewer may not unilaterally assign this tier; it may only be applied once the external review has actually occurred and is documented.

A reviewer may only certify a tier for which they have personally completed the applicable checks. A reviewer must not advance a record to a higher tier than the checks actually performed support, and must not rely on another reviewer's unverified assertion that a check was completed.

## 7. Source-to-Record Checks

Before certifying a record at the source-family-checked tier or higher, a reviewer must confirm that:

- the record accurately reflects the content of its cited source or sources,
- all dates, named parties, and described conduct in the record match what the source states,
- the source link or citation is functional and points to the specific material relied upon, and
- where multiple sources report on the same event, the record does not omit a material discrepancy between them without noting it.

Any discrepancy between the record and its source must be corrected or flagged before certification.

## 8. Category and Affected-Community Label Checks

Before certifying a record at the internally-certified tier, a reviewer must confirm that any category label and any affected-community label applied to the record is directly supported by the cited public source, rather than inferred from context, assumption, or the reviewer's own read of the underlying conduct. If a source does not clearly support a given label, the reviewer must remove or qualify the label rather than certify it.

## 9. Institutional Response-Depth Checks

Before certifying a record at the internally-certified tier, a reviewer must confirm that any description of a named institution's response is supported by public source material and accurately reflects the depth and status of that response as reported (for example, whether a source describes an investigation as opened, ongoing, concluded, or unaddressed). Reviewers must not characterize an institutional response more favorably or more critically than the public source supports.

Named institutions have a correction and right-of-reply path through the channels described in Section 10. Reviewers should ensure that records reflect any public institutional response that is available in a qualifying source at the time of review.

## 10. Correction and Challenge Handling

Correction requests, duplicate reports, source submissions, and school metadata corrections may be submitted through GitHub issue templates or the site's structured submission page. A reviewer handling such a request must:

- evaluate the request on the basis of public-source material only,
- document the basis for accepting, rejecting, or modifying the request,
- update the record's tier if the correction changes the checks underlying its current certification, and
- respond to institutions exercising a correction or right-of-reply path through the same public channels, in source-faithful and neutral language.

A reviewer must not resolve a correction request based on private communication, off-channel pressure, or unsupported assertions from any party, including the subject of the record.

## 11. Confidentiality Limits

Campus Evidence Lab is designed for public-source work, and reviewers should expect that review activity, correction handling, and record history will generally occur in public channels such as GitHub issues, pull requests, and public release notes. Reviewers should not treat review discussions as confidential by default.

Where limited non-public coordination is necessary, such as discussing a conflict-of-interest disclosure, an active bad-faith submission, or a safety concern about a specific submitter, reviewers must keep such coordination limited to what is necessary to resolve the issue and must not use it as a basis to introduce non-public-source information into any record. Non-public coordination is not a substitute for public-source verification and does not itself provide a basis for certifying, rejecting, or altering a record's tier.

## 12. Use of AI

AI tools may assist reviewers with extraction, summarization, duplicate detection, and drafting of record text, correction responses, or reviewer notes. AI assistance does not independently publish records and does not substitute for human review at the internally-certified or externally-reviewed tiers. A reviewer who uses AI assistance remains fully responsible for verifying that any AI-assisted output satisfies the source-to-record, category and label, and institutional-response checks described in Sections 7 through 9 before certifying a record.

## 13. Reviewer Documentation

Reviewers must document their review work in reviewer notes, commit messages, pull request descriptions, or review logs sufficient to show:

- which sources were checked and relied upon,
- which checks under Sections 7 through 9 were performed and their outcome,
- the tier assigned or changed and the reason for the change,
- any conflict of interest disclosed and how it was handled, and
- the basis for any correction or challenge resolution under Section 10.

Documentation must be specific enough that another reviewer can understand and, if necessary, re-verify the basis for a certification without needing to contact the original reviewer.

## 14. Removal from Review Work

A reviewer may be removed from review work for bad-faith conduct, unsafe conduct, or unsupported review behavior. This includes, without limitation:

- certifying a tier without performing the checks required for that tier,
- introducing private testimony, private screenshots, direct messages, sensitive personal information, or unsupported allegations into a record,
- making or permitting a prohibited public claim described in Section 5,
- failing to disclose a known conflict of interest,
- using non-public coordination to justify a certification instead of public-source verification,
- repeated or serious failure to document review work as required by Section 13, or
- conduct that creates a safety risk to any individual named in, or associated with, a record or correction request.

Removal from review work does not require prior review activity to be automatically reversed, but any record certified in violation of this agreement is subject to re-review and retiering.