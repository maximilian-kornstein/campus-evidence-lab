import { paths, readJson, writeJson } from "./lib.mjs";

const [events, schools, sources] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources)
]);

const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));

const entries = events
  .flatMap((event) =>
    event.changelog.map((entry) => ({
      date: entry.date,
      event_id: event.id,
      event_title: event.title,
      school_id: event.school_id,
      school_name: schoolMap.get(event.school_id)?.name ?? event.school_id,
      note: entry.note,
      record_hash: event.record_hash,
      source_titles: event.source_ids.map((sourceId) => sourceMap.get(sourceId)?.title ?? sourceId)
    }))
  )
  .sort((a, b) => {
    const dateOrder = b.date.localeCompare(a.date);
    if (dateOrder !== 0) return dateOrder;
    return a.event_id.localeCompare(b.event_id);
  });

const changelog = {
  generated_at: "2026-06-04",
  entry_count: entries.length,
  entries
};

await writeJson(paths.changelog, changelog);
console.log(`Generated public changelog with ${entries.length} entries.`);
