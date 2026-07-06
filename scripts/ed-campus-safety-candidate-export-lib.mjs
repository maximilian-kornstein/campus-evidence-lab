import { sha256 } from "./lib.mjs";

const ED_CAMPUS_SAFETY_MANIFEST_ID = "manifest_ed_campus_safety_dataset";
const ED_CAMPUS_SAFETY_SOURCE_FAMILY = "ed_campus_safety_dataset";

function hasStoredSourceLocator(event) {
  return Array.isArray(event?.source_locators) && event.source_locators.length > 0;
}

function locatorText(row) {
  if (typeof row?.locator === "string") return row.locator;
  return row?.locator?.locator ?? "";
}

function stableCandidateId(eventId) {
  return `cand_ed_${eventId}`;
}

function rawSourceHashFor(row) {
  return sha256({
    event_id: row.event_id,
    source_id: row.source_id,
    workbook: row.workbook,
    scope: row.scope,
    source_year: row.source_year,
    code_tag: row.code_tag,
    expected_column: row.expected_column,
    expected_count: row.expected_count,
    locator: row.locator
  });
}

function candidateForRow({ row, event, school, source, waveId }) {
  return {
    candidate_id: stableCandidateId(event.id),
    existing_event_id: event.id,
    wave_id: waveId,
    manifest_id: ED_CAMPUS_SAFETY_MANIFEST_ID,
    source_family: ED_CAMPUS_SAFETY_SOURCE_FAMILY,
    source_url: source.url,
    source_locator: locatorText(row),
    school_id: school.id,
    institution_name: school.name,
    date: event.date,
    date_precision: event.date_precision,
    category: event.category,
    affected_communities: event.affected_communities,
    summary: event.summary,
    raw_source_hash: rawSourceHashFor(row),
    import_notes:
      `Exported from ED Campus Safety source-cell provenance audit for import-wave QA. ` +
      `Existing canonical record ${event.id} remains unchanged until a separate merge step is approved.`
  };
}

export function buildEdCampusSafetyWaveCandidates({
  waveId,
  limit = 250,
  events = [],
  schools = [],
  sources = [],
  edDatasetProvenanceAudit = {},
  usedCandidateIds = new Set()
} = {}) {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const schoolById = new Map(schools.map((school) => [school.id, school]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const candidates = [];

  const matchedRows = (edDatasetProvenanceAudit.records ?? [])
    .filter((row) => row.provenance_status === "matched" && locatorText(row))
    .sort((a, b) => a.event_id.localeCompare(b.event_id));

  for (const row of matchedRows) {
    if (candidates.length >= limit) break;

    const event = eventById.get(row.event_id);
    if (!event || hasStoredSourceLocator(event)) continue;

    const candidateId = stableCandidateId(event.id);
    if (usedCandidateIds.has(candidateId)) continue;

    const school = schoolById.get(event.school_id);
    const source = sourceById.get(row.source_id);
    if (!school || !source?.url) continue;

    candidates.push(candidateForRow({ row, event, school, source, waveId }));
  }

  return candidates;
}
