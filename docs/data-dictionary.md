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
- response_date: response date if available.
- legal_status: public legal, OCR, or procedural status.
- verification_status: type of public support behind the record.
- confidence: source confidence, not severity.
- tags: secondary descriptors.
- created_at: date added to the dataset.
- updated_at: latest dataset edit date.
- record_hash: deterministic hash of the event record.
- changelog: public record-edit history.

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
