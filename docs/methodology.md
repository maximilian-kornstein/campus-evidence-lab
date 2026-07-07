# Methodology

Standards before scale.

Campus Evidence Lab tracks public-source records related to campus civil-rights matters, identity-based conflict, public enforcement activity, and institutional responses. The dataset is documentation infrastructure, not a verdict system.

## Current Scope

The current dataset covers U.S. campus civil-rights records across religion, race, ethnicity, national origin, sex, sexual orientation, gender identity, pregnancy, disability, and athletic-equity categories. Sexual-orientation and gender-identity matters may overlap with sex-discrimination law, but the archive treats them as distinct documentation signals when public sources support that narrower description. Community labels are assigned only when the public source supports them, and they describe what is documented in the source record rather than an independent project finding.

The MVP is not a comprehensive First Amendment or student-speech archive. Political belief, viewpoint, or ideology is not a standalone affected-community category in the current dataset. A speech, viewpoint, or ideology dispute is included only when public sources also connect the matter to the archive's current civil-rights scope, institutional response scope, or a source-backed protected-community label.

## Inclusion Criteria

A record can be included when it is:

- campus-related
- connected to identity-based civil rights, discrimination, harassment, public policy, legal action, or institutional response
- supported by at least one public source
- written in neutral, attributed language
- reviewed before publication

## Minimum Record Fields

A publishable event record must identify the school, date or date precision, location, category, affected community label, summary, description, source IDs, source types, verification status, confidence label, update date, and record hash. If a field cannot be supported by public source material, the record should remain unpublished or use an explicit limited-value field instead of inference.

## Event Record Unit

An event record is one source-backed public documentation unit. A record may describe an incident, public allegation, agency action, lawsuit, policy change, public safety notice, institutional response, or structured public dataset cell when that unit can be reproduced from the cited source.

Records are split or linked according to the public documentation:

- a prolonged protest or ongoing investigation is usually one record when the source describes it as one continuous matter
- a separate public filing, agency action, resolution, institutional statement, or dated update may become a separate linked record when it adds a distinct public action or procedural step
- multiple incidents on the same campus are separate records when the source identifies different dates, locations, affected groups, official actions, or source-backed factual units
- structured public datasets may use the dataset cell as the record unit when the source itself reports by institution, year, geography scope, offense, and bias code

The goal is reproducibility, not maximizing counts. When record boundaries are ambiguous, the safer choice is to preserve the narrower public-source unit and flag the matter for review.

## Deduplication Logic

Records should not be duplicated because the same public matter appears in multiple sources. A second source should usually be attached to the existing record unless it documents a distinct date, public action, legal step, institutional response, or source-backed update. Structured public datasets may use scoped deduplication keys such as school, year, geography scope, offense, and bias code so aggregate cells remain auditable without being merged incorrectly.

## Accepted Source Types

- campus newspaper reporting
- university statements and public policy notices
- public safety notices
- public legal filings
- OCR complaints, resolutions, and government releases
- local or national journalism
- nonprofit reports when methodology and source basis are clear

## Source Hierarchy

Official records and public datasets receive the strongest evidentiary weight. Reliable journalism and campus newspaper reporting can support inclusion when they identify the school, date, event type, and source basis. Advocacy or nonprofit reports require clear methodology and public source support before they can be used.

## Source Reliability Protocol

Source review asks whether a reader can reproduce the record from public material without private context. Reviewers check:

- publisher identity and document type
- public accessibility and link stability
- publication or dataset date
- whether the source directly supports the school, date or date precision, category, affected-community label, source type, and legal-status wording
- whether the source is official documentation, structured public data, reliable journalism, campus reporting, legal material, or an advocacy/nonprofit report with a clear source basis
- whether the record language attributes claims to the source instead of turning allegations into findings

Official records, public datasets, court filings, agency letters, and school statements usually carry the strongest evidentiary weight for the fields they directly document. Journalism and campus reporting can support inclusion when they identify the school, date, public record basis, and relevant civil-rights context. Nonprofit or advocacy reports require a clear methodology or underlying public source basis before they are used.

Current MVP review is maintainer-led. Sensitive, ambiguous, disputed, broad-label, low-confidence, or legal/OCR records are routed into review queues for additional source, classification, or responsible-use review. The project does not claim that every record has been independently second-reviewed unless a specific review artifact says so.

## Event Category Definitions

- Harassment or threat: public-source reports of targeted harassment, threats, intimidation, or hostile-environment allegations.
- Vandalism: public-source reports of property damage or defacement tied to identity-based hostility.
- Discrimination allegation: public complaints, lawsuits, OCR matters, or institutional records alleging unequal treatment.
- Protest-related incident: campus protest events where public sources identify civil-rights or identity-based conflict.
- Institutional response: public actions by a school, agency, court, or accreditor responding to a civil-rights matter.
- Public statement: official statements that materially document an event, policy position, or response.
- Policy change: public changes to rules, enforcement processes, training, access, or institutional obligations.
- Public safety notice: campus or law-enforcement notices relevant to the dataset scope.
- OCR complaint: public OCR complaints, investigations, letters, resolutions, or monitoring actions.
- Lawsuit or legal filing: public court filings or legal actions.
- Criminal investigation: public-source records of criminal investigation or prosecution.
- Community response: public-source responses by student, faculty, alumni, nonprofit, or civil-rights organizations.

## Affected Community Definitions

Affected communities are assigned only when supported by public source material. The field identifies the community named in the source record; it does not imply that Campus Evidence Lab independently determined motive, legal liability, or institutional fault. Multiple communities may be listed when a public source identifies more than one affected group.

The current dataset uses one public `affected_communities` field that mixes broad protected-category labels, such as Religion or National origin, with narrower source-identified identities, such as Jewish, Muslim, Arab, Israeli, Palestinian, Black, Asian, Latino, Native, Indigenous, Women, Pregnant students, Sexual orientation, Gender identity, LGBTQ+, and Students with disabilities. This is a known taxonomy limitation.

Responsible use should read the field as a source-identified documentation label, not a legal classification. The intended next taxonomy refinement is two-tier: a broad protected-area field plus a narrower affected-identity field when the source supports one. Until that migration exists, broad labels should be used only when a narrower source-backed identity would be unsupported, and narrow labels should not be treated as a complete legal category by themselves.

## Ideology, Zionism, and Source-Backed Identity Labels

Campus Evidence Lab does not independently decide whether a political, ideological, or geopolitical label is a proxy for protected identity. If a public source describes conduct as antisemitic, anti-Jewish, anti-Israeli, national-origin discrimination, or another source-backed civil-rights category, the record may use the supported protected-community label and should attribute the wording to the source. If a public source describes the same matter only as disagreement over Zionism, anti-Zionism, Israel policy, Palestinian advocacy, or political viewpoint, the record should not convert that into a protected-community label without source support.

Ambiguous records involving Zionist, anti-Zionist, Israeli, Palestinian, Jewish, Muslim, Arab, or political-ideology language should be routed for broad-label review. The safer public record is the narrower source-backed description plus a visible limitation, not an independent finding about motive, ideology, antisemitism, Islamophobia, national origin, or political belief.

## Exclusion Criteria

The MVP excludes:

- private testimony
- private screenshots or direct messages
- unverified social media-only claims
- records without public source links
- private personal information
- legal conclusions not present in source material

"Legal conclusions not present in source material" means the archive does not independently decide whether conduct legally constituted discrimination, harassment, a hostile environment, retaliation, institutional deliberate indifference, civil-rights liability, criminal guilt, or a Title VI/Title IX/ADA violation. If a public source says a complaint was filed, an investigation opened, a settlement announced, or an agency stated a finding, the record should attribute that posture to the source. If the source does not state a legal outcome, the record should say that no legal finding is stated rather than infer one.

## False, Disputed, or Hoax Allegations

When public sources later state that an allegation was false, unfounded, withdrawn, fabricated, or a hoax, the record must not preserve the original allegation as if it remained unqualified. The record should attach the corrective public source, update the description, confidence, verification status, limitations, and changelog, and make clear what each source says.

If the only public basis for a matter is an allegation that a reliable public source later describes as false or fabricated, the record should either remain unpublished, be corrected to document the public correction itself, or be retained only with explicit source-backed language explaining the disputed or false status. Campus Evidence Lab does not adjudicate truth beyond public sources, and it does not use source-audit risk, rumor, or later contradiction as a private finding.

## Verification Status

- Verified from public source: one reliable public source supports the record.
- Verified from multiple public sources: more than one public source supports the record.
- Public allegation: the record is grounded in a public complaint, lawsuit, or report, but the underlying claim remains alleged.
- Institutional statement only: the record is based on an institution's public statement or response.
- Updated after correction: the record was amended after review.

## Confidence

Confidence describes source support, not severity.

- High: official documentation or multiple reliable public sources support the record.
- Medium: one reliable public source supports the record, or public sources leave some details incomplete.
- Low: a public source exists, but important details remain limited or disputed.

## Review Workflow

1. A source is discovered or submitted.
2. A draft event record is created from public information only.
3. A reviewer checks the source, school, date, affected community, category, and attribution language.
4. The reviewer assigns verification status and confidence based on source support.
5. The record is published only after review.
6. Record hashes and snapshot hashes are regenerated after approved changes.

Operational review state is published in `data/review-log.json`. Source and correction intake can run through the repository issue templates without a paid backend.

Consistency is maintained through the public codebook, deterministic validation scripts, methodology examples, review-sample queues, review-debt artifacts, and correction logs. Ambiguous cases should be escalated into a review queue or kept narrower until the source support is clearer. External reviewers may critique methodology, source support, category language, affected-community labels, and responsible-use limits, but external review is not treated as endorsement.

## Reviewer Standard

A reviewer should be able to reproduce the record from public material without private context. Review checks include source availability, source type, date precision, school identity, category choice, affected community label, legal-status wording, privacy risk, duplicate risk, neutral language, and whether confidence describes source support instead of severity.

## No Ranking System

Campus Evidence Lab does not rank schools by hate, safety, severity, or moral standing. Record counts reflect public-source availability, source discovery, reporting practices, school size, jurisdiction, institutional transparency, and reviewer capacity. If future coverage signals describe documentation density or source diversity, they should remain documentation signals rather than comparative school judgments.

## Submit Public Sources

Users can suggest public-source events, corrections, duplicates, or school metadata updates through the public Submit page. Submissions must provide a public URL and enough context to check the record; private testimony, screenshots, direct messages, and sensitive personal information are excluded.

## Update Cadence

The archive is updated when source-backed records, corrections, review artifacts, or product improvements are ready to publish and pass the project checks. Product/archive improvements are tracked in the public Updates page. Dataset updates regenerate hashes, exports, source-audit artifacts, snapshot manifests, and the changelog before publication.

## Flagship and Gold v1 Review Artifacts

The flagship report and gold v1 packet set are review infrastructure, not external validation.

- `data/flagship-report.json` publishes a bounded thesis about the project as public evidence infrastructure and links each finding to local data or review artifacts.
- `data/gold-record-v1.json` publishes 25 deterministic review packets with source basis, rationale fields, review questions, workspace links, correction links, and challenge links.
- `data/record-quality-audit.json` publishes deterministic pre-review triage for every event record and expanded issue notes for Gold v1 records.
- `data/record-quality-reviewer-packet.json` packages the highest-priority audit issues, live source-link checks, and reviewer checklist into a bounded challenge packet.
- `data/gold-v1-certification-status.json` tracks whether each Gold v1 record has cleared internal source-to-record certification gates.
- Gold v1 means "selected for structured review packet display." It does not mean outside audit, approval, adjudication, or greater importance than other records.
- Once a Gold v1 cohort is under repair, regeneration preserves that cohort and recomputes its packet fields from current records instead of silently replacing repaired records with newly higher-scoring candidates.
- The packet set is deliberately bounded. It improves reviewability before scale and should be used to find weaknesses, not to make claims about school safety, prevalence, severity, or institutional quality.

## Correction Process

Corrections must identify the record ID, the disputed field, and a public source supporting the change. Accepted corrections update `data/corrections.json`, the event changelog, the event record hash, the event dataset hash, and the current snapshot manifest. Rejected or incomplete corrections should preserve a short public rationale in `data/corrections.json`.

## Privacy Limits

The MVP does not collect private testimony or sensitive evidence. Public records should avoid naming private individuals unless a name is necessary to understand the public record and already appears in source material from a reliable public source.

## Content Safety

Records must remain neutral, attributed, and source-backed. Automated content QA screens for missing attribution, private contact patterns, private or unverified evidence references, inflammatory wording, and legal-judgment language before publication. The detailed standard is maintained in `docs/content-safety.md`.

## AI Use

AI may assist with extraction, summarization, duplicate detection, and brief drafting. AI does not publish records, determine legal meaning, or assign final classification without human review. Human review is required before a record appears in the public dataset.

## Integrity

Each event receives a deterministic record hash. Each dataset snapshot receives a snapshot hash. Hashes are used to make silent retroactive edits easier to detect.

Snapshot manifests are published in two places:

- `data/snapshot-manifest.json` for the current snapshot
- `data/snapshots/` for archived snapshot manifests

Weekly briefs reference the event dataset hash used for their record set.

Review workflow details are maintained in `docs/review-workflow.md`.

## Limitations

The dataset is not a complete census of campus civil-rights incidents. It reflects public-source availability, reviewer capacity, source discoverability, and the current scope of the MVP. Records should not be used as rankings, severity scores, prevalence measures, or proof of legal liability. Absence from the dataset does not mean absence of incidents, complaints, or institutional responses.

Known sources of bias include differences in campus transparency, local media coverage, student-newsroom capacity, public-records access, legal disclosure requirements, agency publication practices, school reporting incentives, advocacy attention, terminology differences, and the likelihood that some communities or incidents are documented publicly while others remain private or undiscovered.

The current source mix includes substantial Department of Education and Office for Civil Rights (OCR) material, including government releases, OCR materials, and public campus-safety datasets. That makes the archive useful for narrow questions about public documentation, agency action, and administration priorities in the current snapshot, but it also creates source-mix and time window limitations. The archive is not a complete longitudinal record. If the project continues across future publication cycles, changes in Department of Education and OCR source availability may become a useful research signal, but the current snapshot should not be read as proof of underlying prevalence or institutional conditions.

## Versioning and Audit Policy

Public changes regenerate record hashes, dataset hashes, snapshot manifests, the snapshot index, CSV exports, source audit metadata, and the public changelog. Archived snapshot manifests remain available in `data/snapshots/`. Before launch or major publication cycles, maintainers should run the advisory live source audit and manually review any failures.
