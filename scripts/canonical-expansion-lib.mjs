import { createHash } from "node:crypto";
import { ED_CAMPUS_SAFETY_2025_ZIP_URL } from "./ed-campus-safety-aggregate-lib.mjs";

export const CANONICAL_EXPANSION_ID = "canonical_10k_v1";
export const CANONICAL_EXPANSION_DATE = "2026-07-16";
export const CANONICAL_EXPANSION_SOURCE_ID = "src_ed_campus_safety_2025_hate_crime_data_files";
export const CANONICAL_EXPANSION_SIZE = 6000;
export const CANONICAL_EXPANSION_BASE_SIZE = 4000;
export const CANONICAL_EXPANSION_START_SEQUENCE = 3926;
export const CANONICAL_EXPANSION_MAX_PER_SCHOOL = 2;
export const CANONICAL_EXPANSION_BATCH_SIZE = 250;

const LOCATOR_PATTERN = /^(?<workbook>[^>]+?)\s*>\s*(?<sheet>[^>]+?)\s*>\s*row (?<row>\d+)\s*>\s*column (?<column>[^>]+?)\s*>\s*cell (?<cell>[A-Z]+\d+)\s*>\s*institution=(?<institution>[^>]+?)\s*>\s*scope=(?<scope>[^>]+?)\s*>\s*year=(?<year>\d{4})\s*>\s*statistic=(?<statistic>.+)$/;
const SUMMARY_COUNT_PATTERN = /listed (?<count>\d+) reported /;
const ALLOWED_SUBTYPES = new Set(["arrest_stat", "reported_crime_stat", "disciplinary_referral_stat", "vawa_stat"]);
const PROHIBITED_CLAIM_PATTERN = /\b(prevalence|trend|rate|ranking|safest|dangerous|misconduct|liability|typical|increased|decreased)\b/i;

function digestText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function parseAggregateLocator(locator) {
  const match = String(locator ?? "").match(LOCATOR_PATTERN);
  if (!match?.groups) return null;
  const parsed = { ...match.groups, row: Number(match.groups.row) };
  if (!Number.isInteger(parsed.row) || parsed.row < 2) return null;
  if (!parsed.cell.endsWith(String(parsed.row))) return null;
  return parsed;
}

export function aggregateCount(candidate) {
  const match = String(candidate?.summary ?? "").match(SUMMARY_COUNT_PATTERN);
  const count = Number(match?.groups?.count);
  return Number.isInteger(count) && count > 0 ? count : null;
}

export function candidateEligibility(candidate, schoolIds = new Set()) {
  const reasons = [];
  const locator = parseAggregateLocator(candidate?.source_locator);
  const count = aggregateCount(candidate);
  if (!candidate?.candidate_id) reasons.push("missing_candidate_id");
  if (candidate?.manifest_id !== "manifest_ed_campus_safety_dataset") reasons.push("wrong_manifest");
  if (candidate?.source_family !== "ed_campus_safety_dataset") reasons.push("wrong_source_family");
  if (candidate?.record_lane !== "aggregate_safety_stat") reasons.push("wrong_record_lane");
  if (candidate?.source_url !== ED_CAMPUS_SAFETY_2025_ZIP_URL) reasons.push("wrong_source_release");
  if (!schoolIds.has(candidate?.school_id)) reasons.push("unknown_school");
  if (!locator) reasons.push("invalid_locator");
  if (count === null) reasons.push("invalid_positive_count");
  if (!ALLOWED_SUBTYPES.has(candidate?.aggregate_stat_subtype)) reasons.push("invalid_subtype");
  if (candidate?.date !== `${locator?.year}-01-01` || candidate?.date_precision !== "year") reasons.push("date_locator_mismatch");
  if (candidate?.institution_name !== locator?.institution) reasons.push("institution_locator_mismatch");
  if (candidate?.category !== "Official aggregate safety statistic") reasons.push("invalid_category");
  if (JSON.stringify(candidate?.affected_communities) !== JSON.stringify(["Campus community"])) reasons.push("invalid_community_boundary");
  if (PROHIBITED_CLAIM_PATTERN.test(`${candidate?.summary ?? ""} ${candidate?.import_notes ?? ""}`)) reasons.push("prohibited_claim_language");
  return { eligible: reasons.length === 0, reasons, locator, count };
}

export function selectCanonicalCandidates({ candidates = [], schools = [], limit = CANONICAL_EXPANSION_SIZE } = {}) {
  const schoolIds = new Set(schools.map((school) => school.id));
  const unique = new Map();
  const rejected = [];
  for (const candidate of candidates) {
    const decision = candidateEligibility(candidate, schoolIds);
    if (!decision.eligible) {
      rejected.push({ candidate_id: candidate?.candidate_id ?? null, reasons: decision.reasons });
      continue;
    }
    if (unique.has(candidate.candidate_id)) {
      rejected.push({ candidate_id: candidate.candidate_id, reasons: ["duplicate_candidate_id"] });
      continue;
    }
    unique.set(candidate.candidate_id, { candidate, ...decision });
  }

  const ranked = [...unique.values()].sort((left, right) => {
    const byDigest = digestText(left.candidate.candidate_id).localeCompare(digestText(right.candidate.candidate_id));
    return byDigest || left.candidate.candidate_id.localeCompare(right.candidate.candidate_id);
  });
  const schoolCounts = new Map();
  const selected = [];
  for (const row of ranked) {
    const schoolId = row.candidate.school_id;
    if ((schoolCounts.get(schoolId) ?? 0) >= CANONICAL_EXPANSION_MAX_PER_SCHOOL) continue;
    schoolCounts.set(schoolId, (schoolCounts.get(schoolId) ?? 0) + 1);
    selected.push(row);
    if (selected.length === limit) break;
  }
  if (selected.length !== limit) throw new Error(`Only ${selected.length} eligible canonical candidates were available; ${limit} required`);
  return { selected, rejected, eligible_count: unique.size };
}

export function canonicalEventId(index) {
  return `evt_2026_${String(CANONICAL_EXPANSION_START_SEQUENCE + index).padStart(4, "0")}`;
}

export function candidateToCanonicalEvent({ row, index, school }) {
  const { candidate, locator, count } = row;
  const sourceIds = [CANONICAL_EXPANSION_SOURCE_ID];
  const countLabel = count === 1 ? "count" : "counts";
  return {
    id: canonicalEventId(index),
    school_id: candidate.school_id,
    date: candidate.date,
    date_precision: "year",
    location: `${school.city}, ${school.state}`,
    affected_communities: ["Campus community"],
    category: "Official aggregate safety statistic",
    summary: `ED Campus Safety data listed ${count} reported ${locator.scope} ${locator.statistic} for ${locator.institution} in ${locator.year}.`,
    description: `The U.S. Department of Education workbook reports ${count} ${countLabel} for ${locator.statistic} in the ${locator.scope} scope for ${locator.institution} in ${locator.year}. This is an aggregate statistical record, not an incident, allegation, adjudication, or finding about institutional conduct.`,
    classification_rationale: "The source is an official Department of Education Campus Safety and Security aggregate workbook, so the record is classified as an official aggregate safety statistic rather than an incident or case.",
    community_rationale: "The source reports an institution-level campus safety statistic and does not identify a specific affected person or protected group; the bounded community label is Campus community.",
    confidence_rationale: "High transcription confidence reflects an exact match among the official workbook cell, institution row, semantic column header, year, scope, and promoted numeric value; it does not rate institutional safety.",
    limitations: [
      "This single aggregate count does not establish incident prevalence, a trend, comparative institutional quality, or the circumstances behind the reported value.",
      "The record does not identify people, determine wrongdoing, evaluate institutional conduct, or substitute for the source documentation and its definitions.",
      "This expansion record carries the source-family checked review tier; its confidence label describes exact transcription only and does not broaden the record's permitted claims."
    ],
    field_support: [
      { field: "summary", source_ids: sourceIds, rationale: `The official workbook cell ${locator.cell} supplies the value ${count}, while its row and semantic header supply the institution and statistic.` },
      { field: "category", source_ids: sourceIds, rationale: "The cited Department of Education file is an aggregate Campus Safety and Security data workbook, supporting the aggregate-statistic category." },
      { field: "affected_communities", source_ids: sourceIds, rationale: "The workbook is institution-level and does not identify an individual or protected group, supporting only the bounded Campus community label." }
    ],
    source_locators: [{
      source_id: CANONICAL_EXPANSION_SOURCE_ID,
      locator_type: "workbook_cell",
      locator: candidate.source_locator,
      workbook: locator.workbook,
      sheet: locator.sheet,
      row: locator.row,
      column: locator.column,
      cell: locator.cell,
      item_label: `${locator.statistic}; ${locator.scope}; ${locator.year}`,
      review_note: `Exact source-cell transcription verified against the official Crime2025EXCEL.zip release; value=${count}.`
    }],
    source_ids: sourceIds,
    source_types: ["Government dataset"],
    institutional_response: "This aggregate statistical workbook record does not report or evaluate an institutional response. No response claim is made in this record.",
    legal_status: "Official aggregate statistic only; not a case, allegation, adjudication, legal finding, or determination of institutional responsibility.",
    verification_status: "Verified from public source",
    confidence: "High",
    review_tier: "source_family_checked",
    tags: ["department-of-education", "campus-safety-and-security", "aggregate-statistic", candidate.aggregate_stat_subtype.replaceAll("_", "-"), locator.scope, locator.year],
    created_at: CANONICAL_EXPANSION_DATE,
    updated_at: CANONICAL_EXPANSION_DATE,
    record_hash: "",
    changelog: [{ date: CANONICAL_EXPANSION_DATE, note: "Added through the canonical_10k_v1 deterministic source-cell promotion pipeline." }],
    expansion_id: CANONICAL_EXPANSION_ID,
    record_lane: "aggregate_safety_stat",
    source_family: "ed_campus_safety_dataset",
    aggregate_stat_subtype: candidate.aggregate_stat_subtype,
    aggregate_value: count,
    aggregate_unit: "reported count",
    aggregate_scope: locator.scope,
    aggregate_statistic: locator.statistic,
    aggregate_calculation: { method: "direct_cell_value", source_cell: locator.cell, value: count },
    candidate_id: candidate.candidate_id,
    raw_source_hash: candidate.raw_source_hash,
    selection_method: CANONICAL_EXPANSION_ID
  };
}

export function canonicalExpansionDigest(events) {
  return `sha256:${digestText(events.map((event) => ({ id: event.id, candidate_id: event.candidate_id, locator: event.source_locators[0].locator, value: event.aggregate_value })))}`;
}

export function validateCanonicalExpansion(events = []) {
  const errors = [];
  const selected = events.filter((event) => event.expansion_id === CANONICAL_EXPANSION_ID);
  if (selected.length !== CANONICAL_EXPANSION_SIZE) errors.push(`expected ${CANONICAL_EXPANSION_SIZE} expansion events, found ${selected.length}`);
  const ids = new Set();
  const candidateIds = new Set();
  const locatorKeys = new Set();
  const perSchool = new Map();
  for (const [index, event] of selected.entries()) {
    if (event.id !== canonicalEventId(index)) errors.push(`${event.id} is out of deterministic sequence at index ${index}`);
    for (const [label, value, set] of [["event", event.id, ids], ["candidate", event.candidate_id, candidateIds], ["locator", event.source_locators?.[0]?.locator, locatorKeys]]) {
      if (!value || set.has(value)) errors.push(`${event.id} has duplicate or missing ${label} identity`);
      set.add(value);
    }
    perSchool.set(event.school_id, (perSchool.get(event.school_id) ?? 0) + 1);
    if (event.record_lane !== "aggregate_safety_stat" || event.review_tier !== "source_family_checked") errors.push(`${event.id} has an invalid lane or review tier`);
    if (!Number.isInteger(event.aggregate_value) || event.aggregate_value <= 0) errors.push(`${event.id} has an invalid aggregate value`);
    if (event.aggregate_calculation?.value !== event.aggregate_value || event.aggregate_calculation?.method !== "direct_cell_value") errors.push(`${event.id} has a non-reproducible calculation`);
    if (PROHIBITED_CLAIM_PATTERN.test(`${event.summary} ${event.description}`)) errors.push(`${event.id} contains prohibited interpretive language`);
  }
  for (const [schoolId, count] of perSchool) if (count > CANONICAL_EXPANSION_MAX_PER_SCHOOL) errors.push(`${schoolId} exceeds the per-school cap`);
  return errors;
}
