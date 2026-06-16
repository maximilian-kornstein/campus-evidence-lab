import { paths, readJson, writeJson } from "./lib.mjs";
import { selectEnrichmentBatch } from "./robustness-metrics-lib.mjs";

const [events, sources, manifest] = await Promise.all([readJson(paths.events), readJson(paths.sources), readJson(paths.manifest)]);
const batch = selectEnrichmentBatch({ events, sources, manifest, limit: 100 });
const enrichmentById = new Map(batch.records.map((record) => [record.event_id, record.enrichment]));
const selectedIds = new Set(enrichmentById.keys());
const enrichmentDate = manifest.created_at ?? "2026-06-03";

let updated = 0;
const nextEvents = events.map((event) => {
  const enrichment = enrichmentById.get(event.id);
  const note = "Added evidence-depth audit fields from existing local metadata.";
  const originalChangelog = Array.isArray(event.changelog) ? event.changelog : [];
  const hadGeneratedNote = originalChangelog.some((entry) => entry.note === note);
  const changelog = originalChangelog.filter((entry) => entry.note !== note);

  if (!enrichment) {
    if (!hadGeneratedNote || selectedIds.has(event.id)) return event;
    const {
      response_depth,
      classification_rationale,
      community_rationale,
      confidence_rationale,
      limitations,
      field_support,
      ...rest
    } = event;
    const latestChangelogDate = changelog.map((entry) => entry.date).sort().at(-1) ?? rest.created_at;
    return {
      ...rest,
      updated_at: latestChangelogDate,
      changelog
    };
  }

  updated += 1;
  changelog.push({ date: enrichmentDate, note });

  return {
    ...event,
    ...enrichment,
    updated_at: enrichmentDate,
    changelog
  };
});

await writeJson(paths.events, nextEvents);

console.log(`Applied evidence-depth enrichment to ${updated} records.`);
