# Campus Evidence Lab MVP PRD

## Product Thesis

Campus Evidence Lab is an open-source intelligence platform that converts scattered public reports of campus civil rights incidents into verified, source-backed records, school timelines, weekly briefs, and tamper-evident public datasets.

Short positioning:

> Public evidence infrastructure for campus civil rights accountability.

Long positioning:

> Civil rights incidents on campuses are often scattered across student newspapers, lawsuits, university statements, public complaints, public safety notices, nonprofit reports, and local journalism. Campus Evidence Lab creates a structured, source-backed, tamper-evident public record so researchers, journalists, students, families, and campus organizations can understand what happened, how institutions responded, and how patterns change over time.

The MVP should feel like a severe, disciplined public research archive: sparse, exact, source-driven, and difficult to dismiss. It should not feel like a campaign site, a SaaS marketing page, a social network, or a crypto product.

## Assumptions

- The public name is Campus Evidence Lab.
- The MVP begins with campus antisemitism as the first focused dataset.
- The underlying data model supports broader campus civil rights categories from day one.
- The MVP uses only public-source information.
- Human review is mandatory before publication.
- AI assistance is internal and optional for the first release.
- The website is static-first and should cost nothing or almost nothing to operate.
- GitHub is used for public version history, contribution workflow, issue-based corrections, and release artifacts.
- The first version prioritizes credibility, restraint, and repeatable publishing over breadth.

## Problem Statement

Students, families, researchers, journalists, and campus organizations lack a centralized, transparent, and rigorously sourced way to understand identity-based civil rights incidents on college campuses and how institutions respond to them.

Public information exists, but it is fragmented across campus newspapers, university statements, OCR complaints, public lawsuits, public safety releases, nonprofit reports, and local media. This fragmentation makes it difficult to compare events across schools, understand timelines, assess institutional responses, find source material, or build a credible historical record.

The founder's initial motivation comes from personal experience with antisemitism. The product should begin with a focused, high-quality wedge in campus antisemitism records while using an architecture broad enough to support other affected communities, including anti-Asian hate, anti-Black racism, anti-Native discrimination, anti-Latino racism, Islamophobia, and other identity-based civil rights categories.

The core problem is not a lack of opinions. The core problem is a lack of structured public evidence.

## Solution

Build a static-first, open-source public website and dataset for campus civil rights intelligence.

The MVP will provide:

- A searchable public event database.
- Source-backed event detail pages.
- School profile pages with timelines and response histories.
- Weekly intelligence briefs generated from approved records.
- Public methodology, source standards, confidence scoring, and correction process.
- Downloadable datasets and snapshot manifests.
- Record-level hashes and dataset snapshot hashes for integrity.
- GitHub-based contribution and correction workflows.
- A severe, restrained, minimalist visual system that emphasizes trust, source material, and institutional seriousness.

The MVP should be possible to operate for free or near-free:

- Static hosting.
- Public data files as the database.
- GitHub as the collaboration, review, issue, changelog, and version-history layer.
- Manual review as the initial quality-control system.
- AI assistance as an optional internal accelerator, not as an unreviewed publisher.

## MVP Goals

1. Establish Campus Evidence Lab as a credible public evidence project.
2. Publish a clean, source-backed dataset of campus civil rights records.
3. Prove that the system can track incidents and institutional responses across schools.
4. Create a repeatable weekly publishing rhythm.
5. Make the methodology transparent enough that serious readers can evaluate the project.
6. Demonstrate technical seriousness through open-source data, static search, integrity hashes, and reproducible snapshots.
7. Avoid legal, ethical, and credibility risks by requiring public sources, neutral language, and human review.

## Non-Goals

The MVP will not:

- Accept private evidence uploads from victims or witnesses.
- Store sensitive personal documents.
- Publish names of private individuals unless they are already central in a public source and necessary to the record.
- Operate as a social network or public accusation platform.
- Score schools with a simplistic ranking system.
- Claim definitive legal conclusions.
- Use tokens, NFTs, wallets, or speculative crypto mechanics.
- Automatically publish AI-generated incident records without human review.
- Build user accounts, permissions, or a paid admin dashboard.
- Scrape private platforms, bypass paywalls, or use aggressive scraping tactics.

## Primary Audience

1. Student leaders who need a source-backed record of campus civil rights developments.
2. Journalists researching campus incidents, institutional responses, or patterns across schools.
3. Researchers studying campus climate, civil rights, discrimination, or institutional accountability.
4. Families and prospective students who want transparent information about campus conditions.
5. Campus organizations that need public evidence for advocacy, education, or institutional conversations.
6. Open-source contributors who want to submit sources, corrections, or data improvements.
7. Admissions readers and external evaluators who need to see a serious, sustained, technically rigorous project.

## Product Principles

1. Evidence first.
   Every public record must point back to source material.

2. Neutral language.
   Records describe what public sources report, allege, document, or state. The platform should avoid inflammatory language and unsupported conclusions.

3. Human review.
   AI may assist extraction and summarization, but human review is required before publication.

4. Public-source only for MVP.
   The MVP should not collect private testimony or sensitive files.

5. Tamper-evident history.
   Dataset changes, record hashes, and snapshot hashes should make silent retroactive alteration difficult.

6. Broad architecture, narrow launch.
   The system should support many affected communities, but the initial launch should prioritize one focused dataset with high-quality records.

7. Severe minimalism.
   The interface should be restrained, sparse, exact, and institutional.

8. Free operation.
   The MVP should avoid paid infrastructure unless there is clear traction.

## Launch Scope

Recommended launch wedge:

- Campus antisemitism and related institutional responses across U.S. colleges and universities.

The system should be designed to support additional affected communities from day one:

- Jewish / antisemitism
- Asian / anti-Asian hate
- Black / anti-Black racism
- Native / Indigenous discrimination
- Latino / anti-Latino racism
- Muslim / Islamophobia
- Sikh
- Hindu
- LGBTQ+
- Disability
- Religion-based discrimination
- National origin discrimination
- Other protected or identity-based categories when supported by public sources

Public messaging should make clear that Campus Evidence Lab is a broader civil rights evidence platform beginning with a focused initial dataset.

## Core Website Pages

Recommended site map:

- Dashboard
- Events
- Event detail
- Schools
- School detail
- Briefs
- Brief detail
- Methodology
- Data / downloads
- Submit / correct
- About

### 1. Dashboard

Purpose:

Give visitors an immediate, sober view of the current public dataset.

Required content:

- Project name and concise thesis.
- Total verified records.
- Schools tracked.
- Affected communities represented.
- States and jurisdictions represented.
- Latest dataset update.
- Latest dataset version or snapshot hash.
- Search entry point.
- Recent verified records.
- Small trend charts.
- Link to latest weekly brief.
- Links to methodology and data downloads.

Design requirements:

- No marketing hero.
- No oversized emotional headline.
- No stock imagery.
- Use negative space, thin dividers, compact metrics, and restrained labels.
- First screen should communicate: this is an evidence system.

### 2. Event Database

Purpose:

Allow users to search, filter, sort, inspect, and export public records.

Required features:

- Full-text search across school, summary, category, tags, source title, institutional response, and affected community.
- Filter by school.
- Filter by state.
- Filter by affected community.
- Filter by event category.
- Filter by date range.
- Filter by confidence level.
- Filter by verification status.
- Filter by source type.
- Sort by date.
- Sort by school.
- Sort by recently updated.
- Sort by confidence level.
- Compact table or list view.
- Record count for current filters.
- Clear empty state.
- Link from each row to event detail page.
- Download current dataset as JSON.
- Download current dataset as CSV.

Event rows should display:

- Date.
- School.
- State.
- Category.
- Affected community.
- Short neutral summary.
- Verification status.
- Confidence level.
- Number of sources.
- Last updated.

### 3. Event Detail Page

Purpose:

Create a source-backed, auditable record for each event.

Required content:

- Event ID.
- School.
- Date or date range.
- Location if known.
- Affected community.
- Event category.
- Neutral summary.
- Source-backed description.
- Source list with source type, title, outlet/issuer, publication date, and URL.
- Institutional response if publicly available.
- Response date if publicly available.
- Legal/OCR status if applicable.
- Verification status.
- Confidence level.
- Reviewer notes or verification rationale.
- Record hash.
- Last updated date.
- Changelog entries.
- Correction request link.

Language requirements:

- Use "reported by," "alleged in," "stated by," "according to," and similar attribution.
- Avoid declaring disputed facts as settled unless public documentation supports it.
- Avoid naming private individuals unless necessary and already public in the source material.

### 4. Schools Index

Purpose:

Let users find institution-level profiles.

Required features:

- Search by school name.
- Filter by state.
- Sort by school name.
- Sort by number of records.
- Sort by most recent update.
- Display tracked schools with record counts and latest event date.

Required row/card content:

- School name.
- State.
- Total records.
- Affected communities represented.
- Latest record date.
- Last updated.

### 5. School Profile Page

Purpose:

Show institution-level timelines and response histories.

Required content:

- School name.
- State.
- Optional school type if known.
- Total records.
- Records by category.
- Records by affected community.
- Timeline of events.
- Institutional responses.
- Public legal/OCR items if applicable.
- Related source list.
- Latest update.
- Dataset version or snapshot reference.
- Link to event database filtered to the school.

Design requirements:

- Use timeline and compact tables.
- Avoid "school score" in MVP.
- Avoid implying ranking or judgment beyond the source-backed records.

### 6. Weekly Briefs Index

Purpose:

Show publishing consistency and allow readers to browse prior updates.

Required features:

- List weekly briefs by date.
- Display title, publication date, number of new records, number of updated records, and dataset snapshot hash.
- Link to each brief detail page.
- RSS feed if simple to provide.

### 7. Weekly Brief Detail Page

Purpose:

Publish a recurring research memo based on the dataset.

Required content:

- Week/date range.
- Executive summary in neutral language.
- Newly added verified records.
- Updated records.
- Corrections issued.
- Notable institutional responses.
- Legal/OCR updates if any.
- Source-type breakdown.
- Dataset version.
- Snapshot hash.
- Links to dataset downloads.

Design requirements:

- Should feel like an intelligence memo.
- Use terse section headers, tables, and source links.
- Avoid dramatic editorial language.

### 8. Methodology

Purpose:

Make the project credible, transparent, and defensible.

Required sections:

- What the project tracks.
- What the project does not track.
- Inclusion criteria.
- Exclusion criteria.
- Source standards.
- Source type definitions.
- Event category definitions.
- Affected community definitions.
- Verification status definitions.
- Confidence scoring.
- Human review workflow.
- AI-use policy.
- Correction and dispute process.
- Privacy policy.
- Limitations.
- Versioning and audit policy.

This is one of the most important pages in the MVP.

### 9. Data / Downloads

Purpose:

Make the project open, reusable, and research-friendly.

Required content:

- Latest dataset download in JSON.
- Latest dataset download in CSV.
- Schools dataset download.
- Source index download.
- Weekly snapshot downloads.
- Snapshot manifest.
- Dataset license.
- Changelog.
- Data dictionary.
- Citation guidance.

Required features:

- Show last updated date.
- Show latest snapshot hash.
- Show record count.
- Show schema version.

### 10. Submit / Correct

Purpose:

Provide a lightweight, free contribution workflow.

Required user actions:

- Submit a public source.
- Request a correction.
- Report a duplicate.
- Suggest school metadata correction.
- Contribute through GitHub.

Implementation direction:

- Use GitHub issue templates or free forms for MVP.
- Require public source URLs for new record suggestions.
- Clearly state that private testimony and sensitive evidence should not be submitted in MVP.

### 11. About

Purpose:

Explain the project without turning the site into a personal essay or marketing page.

Required content:

- Project mission.
- Founder note.
- Why the project begins with campus antisemitism.
- Why the architecture supports broader civil rights categories.
- Open-source commitment.
- Contact/contribution links.

Tone:

- Disciplined.
- Personal but not performative.
- Serious and public-service oriented.

## Data Model Requirements

### Event Record

Each event record should include:

- Stable event ID.
- School ID.
- School name.
- State.
- Date or date range.
- Location if known.
- Affected communities.
- Event category.
- Neutral summary.
- Detailed source-backed description.
- Source IDs or source references.
- Source URLs.
- Source types.
- Institutional response summary.
- Institutional response date if known.
- Legal/OCR status if applicable.
- Verification status.
- Confidence level.
- Tags.
- Created date.
- Last updated date.
- Record hash.
- Changelog.

### School Record

Each school record should include:

- Stable school ID.
- School name.
- State.
- City if useful.
- Website if useful.
- Total event count generated from event data.
- Latest record date generated from event data.
- Last updated date.

### Source Record

Each source record should include:

- Stable source ID.
- Title.
- URL.
- Publisher or issuing organization.
- Source type.
- Publication date if known.
- Access date.
- Related event IDs.

### Weekly Brief Record

Each weekly brief should include:

- Stable brief ID.
- Week start date.
- Week end date.
- Publication date.
- New event IDs.
- Updated event IDs.
- Correction IDs.
- Snapshot hash.
- Summary.

### Snapshot Manifest

Each dataset snapshot should include:

- Snapshot ID.
- Created date.
- Schema version.
- Total records.
- Total schools.
- Total sources.
- Event dataset hash.
- School dataset hash.
- Source dataset hash.
- Full snapshot hash.
- Prior snapshot hash if available.

## Event Categories

Initial categories should include:

- Harassment or threat.
- Vandalism.
- Discrimination allegation.
- Protest-related incident.
- Institutional response.
- Public statement.
- Policy change.
- Public safety notice.
- OCR complaint.
- Lawsuit or legal filing.
- Criminal investigation.
- Community response.
- Other source-backed civil rights event.

Categories should be defined in the methodology. Records may have one primary category and multiple tags.

## Verification Status

Recommended statuses:

- Pending review.
- Verified from public source.
- Verified from multiple public sources.
- Public allegation.
- Institutional statement only.
- Updated after correction.
- Archived / no longer included.

MVP public database should only show records that are approved for publication. If pending records are displayed later, they must be visually and semantically separate.

## Confidence Levels

Recommended levels:

- High: multiple reliable public sources or official documentation support the record.
- Medium: one reliable public source supports the record, or sources agree on the core event but details remain incomplete.
- Low: public source exists, but details are incomplete, disputed, or rely heavily on allegation framing.

Confidence must not be used to judge moral severity. It only communicates source confidence.

## Integrity and Audit Requirements

The MVP should include:

- Record-level hash for each published event.
- Dataset-level hash for each published snapshot.
- Snapshot manifest.
- Public changelog.
- Git commit history for changes.
- Correction history for amended records.

Optional but desirable:

- OpenTimestamps anchoring for weekly snapshot hashes.
- Public release notes for each weekly dataset version.

The product should describe this as "tamper-evident public datasets," not as a blockchain product.

## Recommended Technical Architecture

The MVP should use a static-first architecture.

Recommended components:

- Static frontend framework: Astro or Next.js static export.
- Client-side search: Fuse.js for MVP-scale fuzzy search, with a possible future move to FlexSearch if records grow substantially.
- Tables and filters: lightweight React components or framework-native components.
- Dataset format: structured JSON as the source of truth, with generated CSV downloads.
- Data validation: schema validation during build or pre-publish checks.
- Hashing: deterministic record hashing and snapshot hashing during build.
- Hosting: Cloudflare Pages, GitHub Pages, or Vercel free tier.
- Collaboration: GitHub issues, pull requests, labels, releases, and changelog.
- Weekly briefs: Markdown records rendered into static pages.
- Charts: static or client-rendered charts from approved dataset aggregates.

The MVP should avoid:

- Paid databases.
- User authentication.
- Serverless functions unless absolutely necessary.
- Realtime infrastructure.
- Paid search services.
- Paid scraping infrastructure.
- Complicated blockchain integrations.

## Source Standards

Acceptable source types for MVP:

- Campus newspaper articles.
- University statements.
- Public safety notices.
- Public legal filings.
- OCR complaints or public government releases.
- Local or national journalism.
- Nonprofit reports when source methodology is clear.
- Congressional or government letters when public.

Sources should be handled carefully:

- A single source can support a record if it is clear and reliable, but confidence may be lower.
- Multiple independent sources can raise confidence.
- Official statements can document institutional response, but should not be treated as the only perspective if the event itself is disputed.
- Social media should not be an MVP source unless embedded in or corroborated by a more reliable public source.
- Paywalled sources should be avoided unless enough public information is available to verify the record.
- Private submissions, direct messages, nonpublic screenshots, and sensitive evidence are out of scope.

## AI-Assisted Workflow

AI may be used internally to:

- Summarize public source material.
- Extract event candidates.
- Identify school, date, category, affected community, and source type.
- Suggest confidence level.
- Suggest duplicate matches.
- Draft weekly brief sections.

AI must not:

- Publish records automatically.
- Make unreviewed allegations.
- Generate facts not present in source material.
- Replace source citations.
- Decide final confidence level without human review.

The methodology must disclose how AI is used.

## Human Review Workflow

Required workflow:

1. A source is discovered or submitted.
2. A draft event record is created.
3. Reviewer checks source material.
4. Reviewer confirms inclusion criteria.
5. Reviewer edits language for neutrality and attribution.
6. Reviewer assigns category, affected community, verification status, and confidence level.
7. Record is approved and published.
8. Hashes and snapshot metadata are regenerated.
9. Weekly brief includes new or updated record if relevant.

Correction workflow:

1. Correction request is submitted.
2. Reviewer evaluates source-backed correction.
3. Record is edited, rejected, or archived.
4. Changelog entry is added.
5. Record hash changes.
6. Future snapshot captures the update.

## User Stories

1. As a journalist, I want to search campus civil rights records by school, so that I can quickly understand recent public developments at an institution.
2. As a journalist, I want each event to include source links, so that I can verify claims before citing them.
3. As a researcher, I want downloadable datasets, so that I can analyze records outside the website.
4. As a researcher, I want a data dictionary, so that I understand how fields are defined.
5. As a researcher, I want weekly snapshots, so that I can track how the dataset changes over time.
6. As a student leader, I want school profile pages, so that I can understand the public record at my campus.
7. As a student leader, I want timelines of events, so that I can discuss institutional history with context.
8. As a family member, I want a clear school search, so that I can find information about a college quickly.
9. As a family member, I want neutral summaries, so that I can understand records without reading every source immediately.
10. As a campus organization, I want institutional responses collected in one place, so that I can see whether and how schools responded publicly.
11. As a campus organization, I want correction links, so that errors can be fixed publicly and responsibly.
12. As an open-source contributor, I want submission guidelines, so that I can contribute public sources correctly.
13. As an open-source contributor, I want issue templates, so that source submissions and corrections are structured.
14. As a reviewer, I want draft records to require source URLs, so that unsupported records are not published.
15. As a reviewer, I want confidence definitions, so that records are classified consistently.
16. As a reviewer, I want category definitions, so that records are not labeled arbitrarily.
17. As a reviewer, I want changelog entries, so that edits are transparent.
18. As a reviewer, I want duplicate detection support, so that repeated articles do not create duplicate event records.
19. As a reader, I want to filter by affected community, so that I can focus on relevant records.
20. As a reader, I want to filter by source type, so that I can distinguish lawsuits, university statements, campus journalism, and other materials.
21. As a reader, I want to filter by date range, so that I can understand a specific period.
22. As a reader, I want to filter by verification status, so that I can understand the reliability of records.
23. As a reader, I want record hashes, so that I can see that published records are part of a versioned dataset.
24. As a reader, I want a methodology page, so that I can evaluate the project's standards.
25. As a reader, I want limitations to be disclosed, so that I do not overinterpret the dataset.
26. As a reader, I want the site to avoid dramatic or partisan presentation, so that the evidence feels credible.
27. As a prospective contributor, I want to know what is out of scope, so that I do not submit private evidence or sensitive material.
28. As a journalist, I want weekly briefs, so that I can monitor notable developments without checking the database daily.
29. As a researcher, I want snapshot hashes, so that I can cite a specific dataset version.
30. As a student, I want event pages to distinguish between allegations, official statements, and verified public documentation, so that records do not overstate certainty.
31. As a reviewer, I want AI assistance to draft structured fields, so that review is faster without sacrificing human judgment.
32. As a reviewer, I want AI usage disclosed, so that the project remains transparent.
33. As a visitor, I want a fast static site, so that the database loads quickly without account creation.
34. As a mobile visitor, I want readable event cards, so that I can search and inspect records on a phone.
35. As a desktop visitor, I want dense table views, so that I can scan many records efficiently.
36. As a founder, I want public weekly publishing, so that the project demonstrates consistency and discipline over time.
37. As a founder, I want GitHub-based collaboration, so that the MVP can operate for free.
38. As a founder, I want the system to begin narrow but support broader civil rights categories, so that the product can expand after the first dataset proves the methodology.
39. As an evaluator, I want to see public artifacts, so that I can assess seriousness beyond a pitch deck.
40. As an evaluator, I want to see a restrained interface and rigorous methodology, so that the project feels mature and defensible.

## Implementation Decisions

- The MVP will be static-first.
- The public dataset will be stored as structured public data rather than in a paid database.
- Search and filtering will run client-side for MVP scale.
- The site will be hosted on a free static hosting provider.
- GitHub will provide version history, issue-based submissions, correction requests, and public review artifacts.
- Human review is required before records become public.
- AI assistance is optional and internal-facing for the MVP.
- The first public wedge should focus on campus antisemitism unless a strategic reason emerges to launch with a different single category.
- The data architecture must support multiple affected communities from the beginning.
- The UI will avoid startup landing-page conventions and present the dashboard as the primary first screen.
- School scoring and rankings are out of scope for MVP.
- Dataset integrity will use cryptographic hashes and public version history rather than speculative blockchain mechanics.
- Weekly briefs will be generated from approved records and edited by a human before publication.
- Public event pages will use attribution-focused language to reduce legal and credibility risk.
- The site should be accessible, responsive, and fast without user accounts.

## Visual Design Requirements

The aesthetic should be severe, disciplined, and restrained.

Visual principles:

- Extreme clarity.
- Large areas of negative space.
- Sparse use of color.
- Thin dividers.
- Quiet typography.
- Compact data layouts.
- Institutional seriousness.
- No decorative visual noise.

Palette direction:

- White or near-white background.
- Black or near-black text.
- Graphite and gray supporting tones.
- One restrained accent color used sparingly for links or active states.
- Muted status colors only where necessary.

Typography direction:

- Clean sans-serif for interface and prose.
- Monospace only for IDs, hashes, timestamps, dataset versions, and technical metadata.
- No negative letter spacing.
- No oversized hero typography except restrained project title treatment.

Layout direction:

- Dashboard first, not marketing first.
- Wide negative space around content.
- Narrow prose width for methodology and briefs.
- Dense but breathable tables for records.
- Minimal page chrome.
- Clear hierarchy through size, spacing, and rules, not decoration.

Avoid:

- Gradients.
- Decorative blobs or orbs.
- Stock imagery.
- Crypto visual language.
- Token/web3 imagery.
- Loud activist colors.
- Emotional poster-like design.
- Large rounded cards.
- Nested cards.
- Marketing hero sections.
- Generic SaaS screenshots.
- Overly friendly or playful UI.

Reference feel:

- Public research lab.
- Intelligence memo.
- Court record index.
- Academic data archive.
- Bloomberg-like restraint without visual clutter.
- Stripe-docs-level clarity without startup polish excess.

## Accessibility Requirements

- Keyboard navigable search, filters, links, and table rows.
- Visible focus states.
- Sufficient text contrast.
- Responsive event cards for mobile.
- Tables must not become unreadable on small screens.
- Links must have clear labels.
- Status should not rely on color alone.
- Charts must have textual summaries or accessible labels.

## Performance Requirements

- Initial MVP should load quickly on static hosting.
- Search should remain responsive for the first several thousand records.
- Data payloads should be reasonably compact.
- The site should not require authentication.
- Pages should be indexable by search engines unless specific records are intentionally excluded.

## Content Requirements

Tone:

- Neutral.
- Precise.
- Evidence-based.
- Restrained.
- Mature.

Avoid:

- Hype.
- Outrage language.
- Unsupported claims.
- Legal conclusions.
- Overpersonalized founder narrative.
- Buzzword-heavy AI/blockchain framing.

Preferred phrasing:

- "Public records indicate..."
- "According to..."
- "The complaint alleges..."
- "The university stated..."
- "The incident was reported by..."
- "Source material reviewed by Campus Evidence Lab..."

## Success Metrics

Launch metrics:

- 100 or more public event records.
- 25 or more schools tracked.
- 1 published methodology.
- 1 downloadable dataset.
- 1 snapshot manifest.
- 1 weekly brief.
- Public submission and correction flow.

Early traction metrics:

- 250 or more public event records.
- 75 or more schools tracked.
- 8 consecutive weekly briefs.
- 10 or more public correction/source submissions.
- 5 or more external contributors or reviewers.
- 100 or more GitHub stars.
- 100 or more newsletter subscribers.
- At least 1 citation or mention by a student publication, journalist, researcher, or campus organization.

Strong spike metrics:

- 500 or more public records.
- 100 or more schools tracked.
- 20 consecutive weekly briefs.
- Multiple contributors.
- Dataset downloads by external users.
- Public citations.
- Partnerships or informal use by campus organizations.

## Testing Decisions

Good tests should validate external behavior and data integrity, not implementation details.

Recommended test coverage:

- Dataset schema validation.
- Required fields for event records.
- Valid date formats.
- Valid category values.
- Valid affected community values.
- Valid verification status values.
- Valid confidence values.
- Source URL presence for published records.
- Hash generation determinism.
- Snapshot manifest generation.
- Search and filter behavior.
- CSV export correctness.
- Weekly brief generation from approved records.
- Accessibility checks for core pages.
- Responsive rendering checks for database and event pages.

Manual QA should verify:

- Dashboard communicates the product thesis without marketing fluff.
- Event database is usable on desktop and mobile.
- Event detail pages make source attribution clear.
- Methodology page is understandable and credible.
- Data downloads work.
- Correction and submission links work.
- Visual design stays severe and restrained.

## Risk Analysis

### Legal and Reputational Risk

Risk:

The platform may be accused of publishing defamatory, misleading, or politically biased claims.

Mitigation:

- Use public sources only.
- Attribute claims carefully.
- Avoid unsupported conclusions.
- Require human review.
- Publish corrections transparently.
- Use confidence and verification labels.
- Avoid private accusations.

### Data Quality Risk

Risk:

Records may be inconsistent or duplicated.

Mitigation:

- Define schema and category standards.
- Validate data before publication.
- Use duplicate checks.
- Require source links.
- Maintain changelog.

### Scope Risk

Risk:

Trying to cover every community and every school immediately could dilute quality.

Mitigation:

- Launch with a focused wedge.
- Design broad architecture.
- Expand only after methodology is proven.

### AI Risk

Risk:

AI could hallucinate, overstate, or misclassify sensitive events.

Mitigation:

- AI suggestions are internal only.
- Human review required.
- Source citations required.
- Methodology discloses AI usage.

### Aesthetic Risk

Risk:

The site could look too cold, empty, or unfinished.

Mitigation:

- Use severe minimalism with precise hierarchy.
- Prioritize excellent typography, spacing, and table design.
- Ensure negative space feels intentional.

## Out of Scope

- Private incident reporting.
- Victim/witness evidence vault.
- User accounts.
- Admin permissions.
- Real-time alerts.
- Paid subscriptions.
- Mobile app.
- Browser extension.
- School rankings.
- Automated web-scale crawling.
- Automated publishing from AI.
- Tokenized blockchain features.
- Paid database infrastructure.
- Social media scraping.
- Private platform monitoring.

## Future Opportunities

After MVP credibility is established:

- Add additional affected-community verticals.
- Add OCR/lawsuit tracker as its own section.
- Add alerts for selected schools.
- Add API access.
- Add embeddable charts.
- Add contributor dashboard.
- Add public review queue.
- Add source-monitor automation.
- Add school comparison tools with careful methodology.
- Add a private evidence preservation product only if legal, privacy, and trust requirements are properly designed.
- Add partnerships with campus organizations, researchers, journalists, or civil rights groups.

## Open Questions

1. Should the first public wedge be exclusively campus antisemitism, or should launch include a small sample of multiple affected-community categories?
2. Should the public name remain Campus Evidence Lab, or should a more formal variant be chosen before launch?
3. Should the MVP use Astro, Next.js static export, or another static-first framework?
4. Should weekly briefs be written manually at first, or generated from data and then edited?
5. What source types should be accepted in the first version?
6. What license should govern the dataset?
7. How much founder story should appear on the About page?

## Recommended MVP Build Order

1. Define data schema, methodology, categories, and confidence levels.
2. Create initial manually curated dataset.
3. Build dashboard, event database, and event detail pages.
4. Build school index and school profile pages.
5. Build data downloads and snapshot manifest generation.
6. Build methodology page.
7. Build submission and correction flows.
8. Build weekly brief templates and first brief.
9. Add integrity hashes and changelog workflow.
10. Polish severe minimalist visual system.
11. Run accessibility, data validation, and responsive QA.
12. Publish first dataset and first weekly brief.

## Definition of Done

The MVP is complete when:

- The public site is live on free static hosting.
- The dashboard presents dataset status and recent records.
- The event database supports search, filters, sorting, and downloads.
- Event detail pages exist for every public record.
- School profile pages exist for every tracked school.
- Weekly briefs can be published.
- Methodology is public and complete.
- Data downloads are available.
- Snapshot hashes and record hashes are visible.
- Submission and correction flows are available.
- The initial dataset contains enough source-backed records to demonstrate seriousness.
- The visual design is severe, restrained, accessible, and responsive.
- The project can be maintained without paid infrastructure.
