# Methodology

Campus Evidence Lab tracks public-source records related to campus civil rights incidents and institutional responses.

## Current Scope

The first dataset is a conservative public-source seed of U.S. campus civil-rights records. It includes antisemitism and shared-ancestry Title VI developments, Title IX and disability-access examples, and initial broader race and national-origin records involving Black, Asian, Latino, Native, and Indigenous communities.

## Inclusion Criteria

A record can be included when it is:

- campus-related
- connected to identity-based civil rights, discrimination, harassment, public policy, legal action, or institutional response
- supported by at least one public source
- written in neutral, attributed language
- reviewed before publication

## Accepted Source Types

- campus newspaper reporting
- university statements and public policy notices
- public safety notices
- public legal filings
- OCR complaints, resolutions, and government releases
- local or national journalism
- nonprofit reports when methodology and source basis are clear

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

## Exclusion Criteria

The MVP excludes:

- private testimony
- private screenshots or direct messages
- unverified social media-only claims
- records without public source links
- private personal information
- legal conclusions not present in source material

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

AI may assist with extraction, summarization, duplicate detection, and weekly brief drafting. AI does not publish records. Human review is required before a record appears in the public dataset.

## Integrity

Each event receives a deterministic record hash. Each dataset snapshot receives a snapshot hash. Hashes are used to make silent retroactive edits easier to detect.

Snapshot manifests are published in two places:

- `data/snapshot-manifest.json` for the current snapshot
- `data/snapshots/` for archived snapshot manifests

Weekly briefs reference the event dataset hash used for their record set.

Review workflow details are maintained in `docs/review-workflow.md`.

## Limitations

The dataset is not a complete census of campus civil-rights incidents. It reflects public-source availability, reviewer capacity, source discoverability, and the current scope of the MVP. Records should not be used as rankings, severity scores, or proof of legal liability. Absence from the dataset does not mean absence of incidents, complaints, or institutional responses.

## Versioning and Audit Policy

Public changes regenerate record hashes, dataset hashes, snapshot manifests, the snapshot index, CSV exports, source audit metadata, and the public changelog. Archived snapshot manifests remain available in `data/snapshots/`. Before launch or major publication cycles, maintainers should run the advisory live source audit and manually review any failures.
