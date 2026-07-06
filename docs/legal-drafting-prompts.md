# Claude Legal And Trust Drafting Prompts

Use these prompts one at a time. They are for first-pass drafting only and are not legal advice. Each output should be reviewed before publication.

Shared project facts for every prompt:

- Project name: Campus Evidence Lab.
- Project type: static-first public evidence archive for campus civil rights records.
- Operator language: refer to "Campus Evidence Lab," "the project," "we," and "us"; do not invent a corporation, nonprofit entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Scope: United States campus-related public-source records.
- Data model: event records, school records, source records, review logs, correction logs, release notes, snapshot manifests, CSV/JSON exports, generated public pages, and GitHub issue-template submissions.
- Hosting and collaboration: public website, public GitHub repository, static pages, GitHub issues and pull requests, optional Cloudflare or GitHub Pages deployment.
- Current legal posture: software is MIT licensed; dataset files are Creative Commons Attribution 4.0 International unless a source imposes stricter limits.
- Core limits: the dataset is not legal advice, not a legal finding, not a ranking, not a school safety score, not a prevalence estimate, not a severity score, not an endorsement, and not a complete census of campus civil-rights incidents.
- Evidence rules: public-source-only; no private testimony, private screenshots, direct messages, doxxing, sensitive personal information, or unsupported allegations.
- Review model: not every public record is human-certified. Public records may have tiers: imported public source, source-family checked, internally certified, and externally reviewed. Lower-tier records may be published only with clear limits.
- Correction channels: public correction requests, duplicate reports, source submissions, and school metadata corrections may be submitted through GitHub issue templates or the site's structured submit page.
- Institutional response: schools and other named institutions should have a correction/right-of-reply path.
- AI use: AI may assist extraction, summarization, duplicate detection, and drafting, but AI does not independently publish records and does not replace human review for higher-tier statuses.

## Prompt 1: Terms Of Use

```text
Draft a complete Terms of Use document for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Terms Of Use
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a governing-law clause.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- acceptance of terms
- project description
- public-source evidence archive limits
- no legal advice, no legal findings, no rankings, no safety scores, no prevalence estimates, no severity scores, no endorsements, and no complete-census claim
- review tiers, including the fact that not every public record is human-certified
- permitted use of the website and data
- prohibited misuse, including harassment, doxxing, targeted abuse, false claims of endorsement, automated abuse, and use as a sole basis for high-stakes decisions
- source-review responsibility for users
- correction and right-of-reply path
- intellectual property summary that references MIT for software and CC BY 4.0 for dataset files unless stricter source limits apply
- third-party sources and external links
- user submissions through GitHub issues, pull requests, and structured submit forms
- disclaimer of warranties
- limitation of liability
- changes to terms
- contact path through the public correction/submission channels

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 2: Privacy Policy

```text
Draft a complete Privacy Policy document for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Privacy Policy
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- what Campus Evidence Lab is
- public website visits and ordinary technical logs
- public GitHub issues and pull requests
- structured submit-page packets
- email or direct outreach only if a user chooses to contact the project
- no intentional collection of private testimony, private screenshots, direct messages, private contact information, sensitive personal information, or unsupported allegations
- public-source records and why public-source material may contain names already present in reliable public sources
- correction, redaction, and right-of-reply requests
- how submitted public-source information may be reviewed, published, archived, quoted, or rejected
- service providers and public hosting platforms in general terms
- AI-assisted processing limits
- data retention principles for public issues, records, logs, and correction artifacts
- children's privacy, written conservatively for a campus-records archive that does not knowingly solicit children
- security limits for a static public project
- user choices and public removal limits when content is already in public GitHub records
- policy changes
- contact path through public correction/submission channels

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 3: Data License Addendum

```text
Draft a complete Data License Addendum for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Data License Addendum
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- relationship to DATA_LICENSE.md
- dataset files released under Creative Commons Attribution 4.0 International unless a source imposes stricter limits
- software remains under MIT license
- required attribution practices for reuse
- preservation of record IDs, source URLs, verification labels, confidence labels, review tiers, snapshot references, access dates, and dataset hash references
- no implication of endorsement, partnership, external validation, rankings, safety scores, prevalence estimates, severity scores, or legal findings
- source-level rights and stricter third-party source limits
- transformation and redistribution expectations
- correction propagation expectations for downstream users
- citation of snapshots and release notes
- responsible use limits
- warranty disclaimer for data

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 4: Submission Terms

```text
Draft complete Submission Terms for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Submission Terms
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- public-source-only submissions
- accepted submission types: source submissions, correction requests, duplicate reports, school metadata corrections, methodology feedback, and reviewer checklists
- prohibited submissions: private testimony, private screenshots, direct messages, private contact information, sensitive personal information, doxxing, unsupported allegations, confidential records, and material the submitter has no right to share
- submitter responsibility for accuracy, source URL, context, and rights to submit
- license to review, store, quote, summarize, publish, transform, reject, archive, and link submitted material
- GitHub issue and pull request public visibility
- no guarantee of publication, response time, acceptance, or continued publication
- human review before a submission becomes a higher-tier public record
- correction and redaction handling
- institutional right-of-reply handling
- misuse and bad-faith submissions
- AI-assisted triage disclosure

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 5: Corrections And Right-Of-Reply Policy

```text
Draft a complete Corrections And Right-Of-Reply Policy for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Corrections And Right-Of-Reply Policy
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- purpose of corrections and institutional response
- who may submit corrections or replies
- required information for correction requests
- required information for institutional replies
- public-source support requirement
- handling of unsupported, private, confidential, abusive, or overbroad requests
- possible outcomes: accepted correction, partial correction, rejected correction, needs more evidence, duplicate merge, redaction, takedown, response appended, response linked, or no change
- publication of correction rationale
- update of record hashes, dataset hashes, snapshots, release notes, and correction logs after accepted changes
- right-of-reply limits: replies may be summarized, linked, rejected, or edited for safety/format without changing source meaning
- no promise to adjudicate disputes, determine truth, decide legal liability, or remove source-backed public records solely because they are disputed
- expedited redaction path for private information, safety risk, or clear policy violation
- review-tier changes after corrections

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 6: Responsible Use Policy

```text
Draft a complete Responsible Use Policy for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Responsible Use Policy
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- appropriate uses: research, journalism, institutional accountability, source review, public-interest analysis, methodology critique, and correction work
- inappropriate uses: harassment, doxxing, school rankings, safety rankings, prevalence claims, severity scoring, legal-liability claims, employment/admissions/disciplinary decisions, and claims that absence from the dataset means absence of incidents
- source review expectations
- limitations of public-source datasets
- review-tier interpretation
- confidence label interpretation
- affected-community label interpretation
- institution response-depth interpretation
- citation and snapshot expectations
- correction and right-of-reply expectations
- AI and automated analysis cautions
- examples of acceptable and unacceptable claim phrasing

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 7: AI Use Disclosure

```text
Draft a complete AI Use Disclosure for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # AI Use Disclosure
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- permitted AI assistance: extraction, summarization, classification suggestions, duplicate detection, source-family mapping, draft copy, QA scans, and release-note drafting
- prohibited AI use: publishing unsupported facts, inventing sources, inferring motive or liability, assigning review tiers without gates, creating private allegations, or replacing required human review for higher tiers
- human review boundaries
- public-source-only input rules
- privacy and sensitive-information handling
- known AI limitations
- auditability expectations: source IDs, record IDs, rationale fields, hashes, snapshots, and review logs
- correction handling when AI-assisted work is wrong
- disclosure to users and contributors

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 8: Takedown And Redaction Policy

```text
Draft a complete Takedown And Redaction Policy for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Takedown And Redaction Policy
- Write in production-ready legal-policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- purpose of takedown and redaction review
- redaction grounds: private personal information, private contact information, minors where inappropriate, doxxing risk, safety risk, confidential material, private screenshots, direct messages, unsupported allegations, source mistake, copyright issue, and clear policy violation
- takedown grounds and narrower alternatives
- information required for a request
- expedited handling for safety or privacy risk
- public-source records that may remain published after review
- source removal or link rot
- copyright complaints in plain-English process terms without claiming formal DMCA-agent status
- correction-log, release-note, hash, and snapshot updates after accepted changes
- GitHub history and downstream reuse limits
- abusive or bad-faith requests
- institutional response interaction with takedown requests

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```

## Prompt 9: Reviewer Agreement

```text
Draft a complete Reviewer Agreement for Campus Evidence Lab using the shared project facts listed at the top of docs/legal-drafting-prompts.md.

Output requirements:
- Output only the document body in Markdown.
- Begin with exactly: # Reviewer Agreement
- Write in production-ready policy prose.
- Do not include bracket placeholders, drafting notes, comments to me, alternatives, optional clauses, questions, or explanatory preface.
- Do not invent a legal entity, mailing address, phone number, attorney, registered agent, or governing-law jurisdiction.
- Do not include a last-updated date.
- Use plain English but keep the document rigorous.

The document must cover:
- reviewer role and scope
- public-source-only review
- no private testimony, private screenshots, direct messages, sensitive personal information, or unsupported allegations
- neutrality and source-faithful language
- conflict disclosure
- no public claims of endorsement, partnership, legal finding, external validation, ranking, safety score, prevalence estimate, or severity score
- review-tier definitions and what a reviewer may or may not certify
- source-to-record checks
- category and affected-community label checks
- institutional response-depth checks
- correction and challenge handling
- confidentiality limits for non-public coordination, while making clear the project is designed for public-source work
- use of AI as assistance only
- documentation expectations for reviewer notes
- removal from review work for bad-faith, unsafe, or unsupported review behavior

Use the shared project facts listed at the top of docs/legal-drafting-prompts.md as authoritative context.
```
