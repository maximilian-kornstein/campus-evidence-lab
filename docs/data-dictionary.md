# Data Dictionary

## events.json

- id: stable event identifier.
- school_id: stable school identifier.
- date: event, publication, resolution, or public-response date.
- date_precision: day, month, or year.
- location: campus or city/state context when known.
- affected_communities: communities identified by public source material.
- category: primary event category.
- summary: neutral one-sentence record summary.
- description: source-backed description using attributed language.
- source_ids: source records supporting the event.
- source_types: source categories supporting the event.
- institutional_response: public institutional response if available.
- response_depth: optional response-depth label for enriched records. Allowed values are direct_institutional_response, agency_described_institutional_action, limited_public_response_note, and no_public_response_found.
- response_date: response date if available.
- legal_status: public legal, OCR, or procedural status.
- verification_status: type of public support behind the record.
- confidence: source confidence, not severity.
- tags: secondary descriptors.
- created_at: date added to the dataset.
- updated_at: latest dataset edit date.
- record_hash: deterministic hash of the event record.
- classification_rationale: optional reviewer-written explanation for why the event category is appropriate.
- community_rationale: optional reviewer-written explanation for why affected-community labels are source-supported.
- confidence_rationale: optional reviewer-written explanation for why the confidence label reflects source support.
- limitations: optional record-specific use limits beyond the default public-claim boundaries.
- field_support: optional source-to-field support rows identifying which source IDs support specific fields and what reviewers should check.
- changelog: public record-edit history.

## Record audit profiles

Event pages and Research Workspace packets generate an audit profile for every record. If optional rationale fields are absent, the public site derives conservative audit text from existing event fields, linked sources, source types, verification status, and confidence. Derived audit profiles are review aids; they do not add new factual claims beyond the canonical event record and linked public sources.

## events-research.json and events-research.csv

Generated research exports denormalize each event with joined school and source fields while preserving the canonical event fields above.

- school_name: institution name joined from `schools.json`.
- school_city: institution city joined from `schools.json`.
- school_state: institution state joined from `schools.json`.
- school_country: institution country joined from `schools.json`.
- source_titles: source titles joined from `sources.json`.
- source_publishers: source publishers joined from `sources.json`.
- source_urls: public source URLs joined from `sources.json`.
- sources: JSON-only source objects with id, title, URL, publisher, source type, publication date, and access date.

## schools.json

- id: stable school identifier.
- name: institution name.
- city: institution city.
- state: institution state.
- country: institution country.
- website: institution homepage when recorded.

## schools-research.json and schools-research.csv

Generated research exports denormalize each school with event-derived fields.

- total_event_count: number of published event records for the school.
- latest_record_date: latest event date for the school.
- last_updated_date: latest event update date for the school.
- affected_communities: affected communities represented in the school's records.
- event_categories: event categories represented in the school's records.
- event_ids: published event IDs associated with the school.

## sources.json

- id: stable source identifier.
- title: source title.
- url: public source URL.
- publisher: publisher or issuing institution.
- source_type: source category.
- published_date: publication date when known.
- accessed_date: date Campus Evidence Lab accessed the source.

## sources-research.json and sources-research.csv

Generated research exports denormalize each source with event-derived references.

- related_event_ids: published event IDs supported by the source.
- related_event_count: number of published event records supported by the source.
- related_school_ids: school IDs associated with the source's event records.
- related_school_names: school names associated with the source's event records.

## source-audit.json

- generated_at: audit generation date.
- mode: metadata or live.
- source_count: number of source records audited.
- event_count: number of event records in the audited dataset.
- unchecked_external_urls: number of URLs not checked in metadata mode.
- notes: audit-mode explanation.
- entries: per-source provenance and launch-check rows.
- audit_hash: deterministic hash of the audit artifact.

## changelog.json

- generated_at: changelog generation date.
- entry_count: number of public changelog entries.
- entries: record-level edit history derived from approved event changelogs.
- event_id: stable event identifier for the changed record.
- record_hash: record hash after the logged change.

## snapshot-manifest.json

- snapshot_id: stable snapshot identifier.
- created_at: snapshot date.
- schema_version: dataset schema version.
- totals: counts by dataset file.
- hashes: deterministic hashes for dataset files and full snapshot.

Flagship artifacts cite the full source snapshot hash. Their own hashes are tracked in `hashes.flagship_report` and `hashes.gold_record_v1` so reviewers can detect stale public review artifacts without making `full_snapshot` self-referential.

## snapshot-index.json

- generated_at: snapshot index generation date.
- snapshot_count: number of archived snapshot manifests.
- snapshots: archived snapshot metadata and download paths.
- events_hash: deterministic hash of the event dataset represented by the snapshot.
- full_snapshot_hash: deterministic hash of the full public dataset state.

## data/snapshots

Each file in `data/snapshots/` is an archived snapshot manifest. The current manifest is duplicated at `data/snapshot-manifest.json` for stable access.

## briefs.json

- id: stable brief identifier.
- title: brief title.
- week_start: reporting-period start date.
- week_end: reporting-period end date.
- published_date: publication date.
- summary: neutral brief summary.
- new_event_ids: event IDs added in the brief.
- updated_event_ids: event IDs updated in the brief.
- correction_ids: correction IDs referenced by the brief.
- snapshot_hash: event dataset hash used by the brief.

## corrections.json

- id: stable correction identifier.
- record_id: event record the correction targets.
- status: pending, accepted, rejected, or needs_more_evidence.
- requested_at: date the correction was received.
- resolved_at: date the correction was resolved, or null while pending.
- field: event field the correction targets.
- requested_change: neutral description of the requested correction.
- public_source_urls: public source URLs supporting the correction request.
- public_rationale: short public explanation of the decision or requested change.
- applied_event_ids: event IDs changed by an accepted correction.

## review-log.json

- version: review log version.
- updated_at: latest review workflow update date.
- queues: public review queues and evidence rules.
- decision_counts: correction counts by status.
- service_standard: triage target and publication/correction rules.

## review-samples.json

- version: review sample artifact version.
- generated_at: generation date.
- snapshot_id: snapshot the samples are tied to.
- snapshot_hash: event hash used to seed deterministic sample ordering.
- method: public explanation that samples are review queues, not rankings or severity scores.
- samples: named deterministic samples such as random, low-confidence, single-source, broad-label, missing-response, legal/OCR, and source-audit follow-up samples.
- records: per-sample event rows with reason codes, review questions, packet URLs, and checklist URLs.

## review-ledger.json

- version: review ledger version.
- updated_at: latest ledger update date.
- entries: public review work entries tied to sample IDs, statuses, review types, record counts, findings summaries, issue URLs, resulting correction IDs, and resulting event IDs.

The review ledger records review activity separately from canonical event records. This keeps event hashes stable until a review produces an accepted correction or record update.

## methodology-examples.json

- id: stable example identifier.
- type: methodology example type.
- title: public example title.
- category: valid event category used to illustrate the rule.
- affected_communities: valid affected-community labels used to illustrate the rule.
- confidence: valid confidence label used to illustrate the rule.
- verification_status: valid verification status used to illustrate the rule.
- source_basis: why the example is source-supported, source-limited, or excluded.
- methodological_point: what rule the example demonstrates.
- public_claim_limit: what the example must not be used to claim.

## workflows.json

- version: workflow artifact version.
- updated_at: workflow artifact update date.
- workflows: task-based user entry points.
- workflow.id: stable workflow identifier.
- workflow.title: public workflow title.
- workflow.audience: intended users.
- workflow.start_url: page where the workflow starts.
- workflow.packet_url: packet or task URL for the workflow.
- workflow.steps: ordered task steps.
- workflow.supported_claims: claims the workflow can support.
- workflow.requires_followup: claims that require additional reporting or review.
- workflow.guardrail_links: methodology, codebook, coverage, or guide links users should inspect.

## releases.json

- id: stable release identifier.
- name: public release name.
- date: release date.
- snapshot_id: dataset snapshot represented by the release.
- snapshot_hash: full snapshot hash.
- event_count, school_count, source_count: release totals.
- release_notes_url: release notes path.
- replication_url: replication instructions path.
- verification_commands: commands required to reproduce release checks.
- known_limits: public limits that travel with the release.

## release-verification.json

- generated_at: date the local verification artifact was generated.
- snapshot_id: verified snapshot.
- snapshot_hash: verified full snapshot hash.
- status: passed or failed.
- commands: local verification commands and statuses.
- tool_versions: local tool versions used for verification.
- notes: public caveats about what verification does and does not prove.

## credibility-status.json

- status: bounded credibility status such as review requested, review in progress, review completed, collaboration completed, or public acknowledgment approved.
- display_name: public display name only when permission is clear.
- scope: scope of review or collaboration.
- permission_to_display: whether public display is approved.
- endorsement_language_approved: whether endorsement wording is explicitly approved.
- public_note: caveat-preserving public note.

## robustness-metrics.json

- snapshot_id: snapshot the metrics describe.
- generated_at: generation date.
- purpose: public explanation that metrics guide review priorities.
- totals: event, source, source-count, and explicit-rationale counts.
- source_type_concentration: source-type distribution for the current dataset.
- confidence: confidence-label distribution.
- date_precision: date-precision distribution.
- community_concentration: affected-community label distribution.
- category_concentration: category distribution.
- response_depth: stored public response-depth distribution.
- review_gaps: counts for follow-up priorities such as single-source records, year-level dates, limited response depth, and missing explicit rationales.
- known_limits: caveats that travel with the metrics.

## evidence-depth-queues.json

- snapshot_id: snapshot the queues are tied to.
- generated_at: generation date.
- method: deterministic queue-generation note.
- queues: named review-priority queues.
- queue.records: event rows with source count, source types, response-depth label, reason codes, workspace URL, and packet URL.

## gold-record-set.json

- snapshot_id: snapshot the candidate set is tied to.
- generated_at: generation date.
- review_standard: current candidate standard.
- public_claim_limit: caveat explaining that candidate status is only a review-workflow label.
- records: records prioritized for deeper source-text review after existing-metadata enrichment.
- required_before_gold_status: checks required before a candidate can be described as fully reviewed.

## reviewer-challenge-pack.json

- snapshot_id: snapshot the challenge pack is tied to.
- generated_at: generation date.
- method: deterministic selection method.
- records: difficult or ambiguous records selected from evidence-depth queues.
- challenge_reason_codes: reasons reviewers should inspect the record closely.

## evidence-capsules.json

- snapshot_id: snapshot the capsules are tied to.
- generated_at: generation date.
- method: public explanation that capsules are generated from current local metadata.
- totals: record count and locator-count summary.
- import_family_counts: counts by derived import family such as Education campus-safety dataset, OCR/government release, annual security report, institutional public statement, or other public source.
- locator_quality_counts: counts by source locator quality.
- review_need_counts: counts by source-provenance review need.
- records: one source-to-field capsule per event record.
- record.import_family: derived import/provenance family based on source type, tags, and text patterns.
- record.locator_quality: conservative source locator label such as dataset_file, source_page, or metadata_only.
- record.source_basis: linked source IDs, source types, source count, and primary source metadata.
- record.field_evidence: field-level source support rows for school, date, category, affected communities, description, response, legal status, and confidence.
- record.review_needs: source-provenance follow-up needs such as dataset cell locator review, single-source review, response-depth review, or explicit rationale review.

## source-provenance-queues.json

- snapshot_id: snapshot the queues are tied to.
- generated_at: generation date.
- method: deterministic queue-generation note.
- queues: named source-provenance review queues.
- queue.records: event rows with import family, locator quality, source count, review needs, event URL, and workspace URL.

## challenge-standards.json

- snapshot_id: snapshot the standards are tied to.
- generated_at: date the standards artifact was generated.
- method: public explanation of what the standards do and do not claim.
- standards: challenge standards defining acceptable counterevidence, insufficient counterevidence, possible outcomes, fields that may change, and no-overclaiming warnings.

## challenge-queues.json

- snapshot_id: snapshot the queues are tied to.
- generated_at: date the queue artifact was generated.
- method: public explanation that queues are review workflow aids with bounded public-claim limits.
- queues: deterministic adversarial review queues with reason codes and record links.
- packets: bounded record-level challenge packets with review questions, acceptable counterevidence, possible outcomes, evidence capsule links, submission packet links, and public claim limits.

## challenge-ledger.json

- snapshot_id: snapshot the ledger is tied to.
- updated_at: latest ledger update date.
- method: public explanation that initial entries are seeded open packets, not external submissions.
- statuses: supported challenge status values.
- entries: challenge packet status rows with event IDs, challenge types, decision summaries, correction links, and public limitations.

## flagship-report.json

- id: stable report identifier.
- title: public report title.
- snapshot_id: source snapshot represented by the report.
- snapshot_hash: full source snapshot hash the report cites.
- generated_at: generation date.
- thesis: bounded public evidence infrastructure claim.
- public_claim_limit: explicit public-claim boundary for the report.
- recommended_next_reviews: review tasks that should happen before stronger public reuse.
- audience_paths: public routes for researchers, reviewers, and readers.
- inputs: event, school, source, and challenge-packet counts used by the report.
- findings: bounded findings with metric fields, local evidence links, challenge URLs, and use limits.

## gold-record-v1.json

- id: stable gold v1 artifact identifier.
- snapshot_id: source snapshot represented by the packet set.
- generated_at: generation date.
- status: review packet status.
- public_claim_limit: explicit public-claim boundary for gold v1 packet status.
- selection_version: deterministic selection algorithm version.
- selection_criteria: reasons records enter the packet set.
- coverage_summary: composition of the packet set by category, source type, confidence, date precision, challenge-link status, and state.
- selection_note: public explanation that order is review-priority order only.
- records: bounded review packets with event, school, source basis, rationale packet, review questions, correction links, workspace links, and challenge links.
