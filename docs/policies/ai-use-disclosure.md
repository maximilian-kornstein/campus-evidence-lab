# AI Use Disclosure

Campus Evidence Lab uses artificial intelligence tools to assist with parts of its research, extraction, and publication workflow. This disclosure explains where AI assistance is permitted, where it is prohibited, how human review applies, and how the project handles privacy, limitations, auditability, and corrections related to AI-assisted work.

## Permitted AI Assistance

AI tools may be used to support the following tasks within the project's workflow:

- **Extraction** of relevant facts, dates, names, and details from public-source records.
- **Summarization** of source material into concise, neutral descriptions for event records, school records, and source records.
- **Classification suggestions**, such as proposing category, topic, or tag labels for a record, subject to human confirmation.
- **Duplicate detection**, including flagging candidate duplicate event or source records for human comparison.
- **Source-family mapping**, including suggesting relationships between related public sources describing the same event.
- **Draft copy**, including preliminary language for release notes, correction responses, and public page text, prior to human editing and approval.
- **QA scans**, including automated checks for missing fields, inconsistent formatting, broken links, or structural errors in records and exports.
- **Release-note drafting**, including preliminary summaries of changes made in a given release, subject to human review before publication.

In all of these uses, AI output is treated as a draft or suggestion. It does not become part of the published dataset or public pages until a human reviewer has evaluated it against the applicable review-tier requirements.

## Prohibited AI Use

AI tools are not permitted to:

- Publish facts, claims, or records that are not supported by an identifiable public source.
- Invent, fabricate, or hallucinate sources, citations, quotations, or source content.
- Infer or assert motive, intent, culpability, or legal liability on the part of any individual or institution.
- Assign a record to a higher review tier (source-family checked, internally certified, or externally reviewed) without the corresponding human review gate having been completed.
- Create, reconstruct, or publish private allegations, private testimony, private screenshots, direct messages, or other non-public claims.
- Independently publish any record, correction, or public page. AI does not have publication authority; publication requires human action.
- Replace the human review required for any tier above imported public source.

Any AI output that would result in one of the above outcomes must be discarded, revised, or escalated to human reviewers before any further action is taken.

## Human Review Boundaries

All AI-assisted output is subject to human review before it affects the public dataset or public pages. The scope of required review depends on the record's tier:

- **Imported public source** records reflect an unreviewed public source and may include AI-assisted extraction or summarization, but must be clearly labeled with the limits appropriate to that tier.
- **Source-family checked**, **internally certified**, and **externally reviewed** tiers each require a human reviewer to independently confirm the underlying facts, sourcing, and classification before the record may carry that tier. AI suggestions inform this process but do not substitute for it.
- Corrections, duplicate merges, and school metadata changes submitted through GitHub issue templates or the site's structured submit page are reviewed by a person before being applied, regardless of whether AI assisted in drafting the submission or a proposed resolution.

No AI process may alter a record's review tier, publish a record, or close a correction request without a corresponding human decision recorded in the review log.

## Public-Source-Only Input Rules

AI tools used in this project are restricted to processing public-source material consistent with the project's evidence rules. This means AI assistance may only operate on:

- Publicly available event records, school records, and source records.
- Publicly available documents, public statements, public filings, and other public-source material submitted through the project's intake channels.

AI tools must not be used to process, extract from, or incorporate private testimony, private screenshots, direct messages, doxxing material, sensitive personal information, or unsupported allegations. If such material is inadvertently submitted, it is excluded from AI-assisted processing and handled under the project's evidence rules rather than incorporated into any record.

## Privacy and Sensitive-Information Handling

AI assistance is not used to identify, infer, or add sensitive personal information beyond what is already present in a public source. Where an AI tool encounters or generates content that appears to include sensitive personal information, private communications, or unsupported personal claims, that content is not incorporated into any record, export, or public page. Human reviewers are responsible for removing or withholding such content and for applying the project's evidence rules before publication.

## Known AI Limitations

Contributors, reviewers, and users of the dataset should understand that AI tools used in this project:

- Can misread, mischaracterize, or omit material facts present in a source.
- Can suggest incorrect classifications, duplicate matches, or source-family relationships.
- Can produce plausible-sounding but inaccurate draft text, including in release notes and correction responses.
- Have no independent authority to verify facts, assess credibility, or determine legal significance.
- Do not have access to private, non-public, or restricted information, and cannot confirm facts beyond what is contained in the public sources provided to them.

Because of these limitations, AI-assisted output is treated as provisional at every tier until confirmed through the applicable human review process.

## Auditability Expectations

To support transparency and review, AI-assisted work is expected to remain traceable through the project's existing record-keeping structures, including:

- **Source IDs** linking each record to its originating public source.
- **Record IDs** identifying the specific event, school, or source record affected.
- **Rationale fields** documenting the basis for a classification, duplicate match, or source-family mapping suggestion, including where that suggestion originated from AI assistance.
- **Hashes** used to verify the integrity of source snapshots and exported data.
- **Snapshots** preserving the state of a public source at the time it was captured.
- **Review logs** recording who reviewed a record, what tier was applied or changed, and when that review occurred.

Where AI assistance contributed to a record, classification, draft, or export, that contribution should be identifiable within these existing fields and logs rather than hidden within the final output.

## Correction Handling When AI-Assisted Work Is Wrong

If AI-assisted extraction, summarization, classification, duplicate detection, source-family mapping, draft copy, QA output, or release-note drafting results in an error, the project's standard correction channels apply. Corrections may be submitted through GitHub issue templates or the site's structured submit page as public correction requests, duplicate reports, source submissions, or school metadata corrections.

Named institutions retain a correction and right-of-reply path consistent with the project's institutional response practices, regardless of whether the underlying error originated from AI assistance or human drafting. Errors traced to AI-assisted work are corrected through the same human-reviewed process as any other error, and the correction is reflected in the relevant record's review log.

## Disclosure to Users and Contributors

Campus Evidence Lab discloses that AI tools are used to assist, but not replace, human judgment in the workflows described above. Users of the public dataset and public pages should understand that:

- Some records may reflect AI-assisted extraction, summarization, or classification suggestions that have not yet reached a higher review tier.
- The tier markers applied to each record (imported public source, source-family checked, internally certified, externally reviewed) indicate the level of human review completed, independent of any AI assistance involved.
- The dataset remains, at every tier, not legal advice, not a legal finding, not a ranking, not a school safety score, not a prevalence estimate, not a severity score, not an endorsement, and not a complete census of campus civil-rights incidents.

Contributors submitting material through GitHub issues, pull requests, or the site's structured submit page should assume that AI tools may assist in the initial handling of their submission, subject to the human review and correction processes described in this disclosure.