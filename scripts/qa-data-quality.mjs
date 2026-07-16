import { readdir } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";

const currentDate = "2026-07-16";
const [events, schools, sources, briefs, corrections, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs),
  readJson(paths.corrections),
  readJson(paths.manifest)
]);

const errors = [];
const warnings = [];
const eventMap = new Map(events.map((event) => [event.id, event]));
const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
const correctionMap = new Map(corrections.map((correction) => [correction.id, correction]));
const officialSourcePattern = /government|university statement|public legal filing|government letter|government case summary|government guidance/i;

function compareDate(a, b) {
  return a.localeCompare(b);
}

function exactDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function readJsonFilesFromDir(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => path.join(dir, entry.name));
    return Promise.all(files.map((filePath) => readJson(filePath)));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

for (const event of events) {
  if (compareDate(event.date, currentDate) > 0) {
    errors.push(`Event ${event.id} date is in the future`);
  }
  if (compareDate(event.created_at, currentDate) > 0 || compareDate(event.updated_at, currentDate) > 0) {
    errors.push(`Event ${event.id} created_at or updated_at is in the future`);
  }
  if (compareDate(event.created_at, event.updated_at) > 0) {
    errors.push(`Event ${event.id} created_at is after updated_at`);
  }
  if (event.response_date && exactDate(event.response_date) && compareDate(event.response_date, currentDate) > 0) {
    errors.push(`Event ${event.id} response_date is in the future`);
  }

  const actualSourceTypes = [...new Set(event.source_ids.map((id) => sourceMap.get(id)?.source_type).filter(Boolean))].sort();
  const storedSourceTypes = [...new Set(event.source_types)].sort();
  if (JSON.stringify(actualSourceTypes) !== JSON.stringify(storedSourceTypes)) {
    errors.push(`Event ${event.id} source_types ${storedSourceTypes.join(", ")} do not match referenced sources ${actualSourceTypes.join(", ")}`);
  }

  if (event.verification_status === "Verified from multiple public sources" && event.source_ids.length < 2) {
    errors.push(`Event ${event.id} claims multiple-source verification with fewer than 2 sources`);
  }

  const eventSources = event.source_ids.map((id) => sourceMap.get(id)).filter(Boolean);
  const hasOfficialSource = eventSources.some((source) => officialSourcePattern.test(source.source_type));
  if (event.confidence === "High" && !hasOfficialSource && event.source_ids.length < 2) {
    errors.push(`Event ${event.id} has High confidence without an official source or multiple public sources`);
  }

  if (event.summary.length > 220) {
    warnings.push(`Event ${event.id} summary is long (${event.summary.length} characters)`);
  }
  if (!/[.!?]$/.test(event.summary)) {
    errors.push(`Event ${event.id} summary must end with punctuation`);
  }

  for (const tag of event.tags ?? []) {
    if (!/^[a-z0-9+.-]+$/.test(tag)) {
      errors.push(`Event ${event.id} has non-slug tag "${tag}"`);
    }
  }

  const latestChangelogDate = [...event.changelog].map((entry) => entry.date).sort().at(-1);
  if (latestChangelogDate && compareDate(latestChangelogDate, event.updated_at) > 0) {
    errors.push(`Event ${event.id} changelog date is after updated_at`);
  }

  if (!schoolMap.has(event.school_id)) {
    errors.push(`Event ${event.id} references missing school ${event.school_id}`);
  }
}

for (const source of sources) {
  if (compareDate(source.accessed_date, currentDate) > 0) {
    errors.push(`Source ${source.id} accessed_date is in the future`);
  }
  if (exactDate(source.published_date) && compareDate(source.published_date, source.accessed_date) > 0) {
    errors.push(`Source ${source.id} published_date is after accessed_date`);
  }
}

const eventBriefCounts = new Map();
for (const brief of briefs) {
  if (compareDate(brief.week_start, brief.week_end) > 0) {
    errors.push(`Brief ${brief.id} week_start is after week_end`);
  }
  if (brief.snapshot_hash !== manifest.hashes.events) {
    errors.push(`Brief ${brief.id} snapshot_hash does not match current event hash`);
  }

  const seenInBrief = new Set();
  for (const eventId of [...brief.new_event_ids, ...brief.updated_event_ids]) {
    if (!eventMap.has(eventId)) {
      errors.push(`Brief ${brief.id} references missing event ${eventId}`);
      continue;
    }
    if (seenInBrief.has(eventId)) {
      errors.push(`Brief ${brief.id} lists event ${eventId} more than once`);
    }
    seenInBrief.add(eventId);
    increment(eventBriefCounts, eventId);
  }

  for (const correctionId of brief.correction_ids) {
    if (!correctionMap.has(correctionId)) {
      errors.push(`Brief ${brief.id} references missing correction ${correctionId}`);
    }
  }
}

for (const event of events) {
  if (!eventBriefCounts.has(event.id)) {
    errors.push(`Event ${event.id} is not referenced by any brief`);
  }
  if ((eventBriefCounts.get(event.id) ?? 0) > 1) {
    errors.push(`Event ${event.id} is referenced by multiple briefs`);
  }
}

const referencedSources = new Set(events.flatMap((event) => event.source_ids));
for (const source of sources) {
  if (!referencedSources.has(source.id)) {
    errors.push(`Source ${source.id} is not referenced by any event`);
  }
}

const importCandidateFiles = await readJsonFilesFromDir(path.join(rootDir, "data", "import-candidates"));
const referencedSchools = new Set([
  ...events.map((event) => event.school_id),
  ...importCandidateFiles.flatMap((rows) => (Array.isArray(rows) ? rows.map((row) => row.school_id).filter(Boolean) : []))
]);
for (const school of schools) {
  if (!referencedSchools.has(school.id)) {
    errors.push(`School ${school.id} is not referenced by any event`);
  }
}

const communities = new Set(events.flatMap((event) => event.affected_communities));
for (const requiredCommunity of ["Jewish", "Women", "Black", "Asian", "Latino", "Native", "Indigenous"]) {
  if (!communities.has(requiredCommunity)) {
    errors.push(`Dataset is missing required MVP community coverage: ${requiredCommunity}`);
  }
}

if (manifest.totals.events !== events.length || manifest.totals.schools !== schools.length || manifest.totals.sources !== sources.length || manifest.totals.briefs !== briefs.length) {
  errors.push("Snapshot manifest totals do not match current dataset lengths");
}

if (errors.length) {
  console.error(`Data quality QA failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) {
    console.error(`Warnings:`);
    for (const warning of warnings) console.error(`- ${warning}`);
  }
  process.exit(1);
}

if (warnings.length) {
  console.warn(`Data quality QA passed with ${warnings.length} warning(s):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
} else {
  console.log(`Data quality QA passed: ${events.length} events, ${schools.length} schools, ${sources.length} sources, ${briefs.length} briefs.`);
}
