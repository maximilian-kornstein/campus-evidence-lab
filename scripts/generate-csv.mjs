import { paths, readJson, writeJson } from "./lib.mjs";
import { writeFile } from "node:fs/promises";

function csvEscape(value) {
  if (Array.isArray(value)) value = value.join("; ");
  if (value === null || value === undefined) value = "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toCsv(rows, columns) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))
  ].join("\n") + "\n";
}

const [events, schools, sources] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources)
]);

const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));

function researchEvent(event) {
  const school = schoolMap.get(event.school_id);
  const eventSources = event.source_ids.map((sourceId) => sourceMap.get(sourceId)).filter(Boolean);
  return {
    ...event,
    school_name: school?.name ?? "",
    school_city: school?.city ?? "",
    school_state: school?.state ?? "",
    school_country: school?.country ?? "",
    source_titles: eventSources.map((source) => source.title),
    source_publishers: eventSources.map((source) => source.publisher),
    source_urls: eventSources.map((source) => source.url),
    sources: eventSources.map((source) => ({
      id: source.id,
      title: source.title,
      url: source.url,
      publisher: source.publisher,
      source_type: source.source_type,
      published_date: source.published_date,
      accessed_date: source.accessed_date
    }))
  };
}

const researchEvents = events.map(researchEvent);

function researchSchool(school) {
  const schoolEvents = events.filter((event) => event.school_id === school.id);
  return {
    ...school,
    total_event_count: schoolEvents.length,
    latest_record_date: schoolEvents.map((event) => event.date).sort().at(-1) ?? "",
    last_updated_date: schoolEvents.map((event) => event.updated_at).sort().at(-1) ?? "",
    affected_communities: [...new Set(schoolEvents.flatMap((event) => event.affected_communities))].sort(),
    event_categories: [...new Set(schoolEvents.map((event) => event.category))].sort(),
    event_ids: schoolEvents.map((event) => event.id).sort()
  };
}

function researchSource(source) {
  const sourceEvents = events.filter((event) => event.source_ids.includes(source.id));
  return {
    ...source,
    related_event_ids: sourceEvents.map((event) => event.id).sort(),
    related_event_count: sourceEvents.length,
    related_school_ids: [...new Set(sourceEvents.map((event) => event.school_id))].sort(),
    related_school_names: [...new Set(sourceEvents.map((event) => schoolMap.get(event.school_id)?.name).filter(Boolean))].sort()
  };
}

const researchSchools = schools.map(researchSchool);
const researchSources = sources.map(researchSource);

await writeFile(
  paths.eventsCsv,
  toCsv(events, [
    "id",
    "school_id",
    "date",
    "date_precision",
    "location",
    "affected_communities",
    "category",
    "summary",
    "source_ids",
    "source_types",
    "institutional_response",
    "response_date",
    "legal_status",
    "verification_status",
    "confidence",
    "tags",
    "created_at",
    "updated_at",
    "record_hash"
  ])
);

await writeJson(paths.eventsResearchJson, researchEvents);

await writeFile(
  paths.eventsResearchCsv,
  toCsv(researchEvents, [
    "id",
    "school_id",
    "school_name",
    "school_city",
    "school_state",
    "school_country",
    "date",
    "date_precision",
    "location",
    "affected_communities",
    "category",
    "summary",
    "source_ids",
    "source_types",
    "source_titles",
    "source_publishers",
    "source_urls",
    "institutional_response",
    "response_date",
    "legal_status",
    "verification_status",
    "confidence",
    "tags",
    "created_at",
    "updated_at",
    "record_hash"
  ])
);

await writeFile(
  paths.schoolsCsv,
  toCsv(schools, ["id", "name", "city", "state", "country", "website"])
);

await writeJson(paths.schoolsResearchJson, researchSchools);

await writeFile(
  paths.schoolsResearchCsv,
  toCsv(researchSchools, [
    "id",
    "name",
    "city",
    "state",
    "country",
    "website",
    "total_event_count",
    "latest_record_date",
    "last_updated_date",
    "affected_communities",
    "event_categories",
    "event_ids"
  ])
);

await writeFile(
  paths.sourcesCsv,
  toCsv(sources, ["id", "title", "url", "publisher", "source_type", "published_date", "accessed_date"])
);

await writeJson(paths.sourcesResearchJson, researchSources);

await writeFile(
  paths.sourcesResearchCsv,
  toCsv(researchSources, [
    "id",
    "title",
    "url",
    "publisher",
    "source_type",
    "published_date",
    "accessed_date",
    "related_event_ids",
    "related_event_count",
    "related_school_ids",
    "related_school_names"
  ])
);

console.log(`Generated CSV exports: ${events.length} events, ${researchEvents.length} research events, ${schools.length} schools, ${researchSchools.length} research schools, ${sources.length} sources, ${researchSources.length} research sources.`);
