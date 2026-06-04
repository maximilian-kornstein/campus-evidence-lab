import { existsSync } from "node:fs";
import { eventForHash, paths, readJson, sha256, writeJson } from "./lib.mjs";

const checkOnly = process.argv.includes("--check");

const [events, schools, sources, briefs, corrections, reviewLog] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs),
  readJson(paths.corrections),
  readJson(paths.reviewLog)
]);

const hashedEvents = events.map((event) => ({
  ...event,
  record_hash: sha256(eventForHash(event))
}));

const eventsHash = sha256(hashedEvents);
const schoolsHash = sha256(schools);
const sourcesHash = sha256(sources);
const stampedBriefs = briefs.map((brief) => ({
  ...brief,
  snapshot_hash: eventsHash
}));
const briefsHash = sha256(stampedBriefs);
const correctionsHash = sha256(corrections);
const reviewLogHash = sha256(reviewLog);

const previousManifest = existsSync(paths.manifest) ? await readJson(paths.manifest) : null;

const snapshotId = `snapshot_2026_06_03_${hashedEvents.length}_records`;
const previousSnapshotHash =
  previousManifest?.snapshot_id === snapshotId
    ? previousManifest.hashes.previous_snapshot ?? null
    : previousManifest?.hashes?.full_snapshot ?? null;

const manifest = {
  snapshot_id: snapshotId,
  created_at: "2026-06-03",
  schema_version: "0.1.0",
  totals: {
    events: hashedEvents.length,
    schools: schools.length,
    sources: sources.length,
    briefs: briefs.length,
    corrections: corrections.length,
    review_queues: reviewLog.queues.length
  },
  hashes: {
    events: eventsHash,
    schools: schoolsHash,
    sources: sourcesHash,
    briefs: briefsHash,
    corrections: correctionsHash,
    review_log: reviewLogHash,
    full_snapshot: sha256({
      events: eventsHash,
      schools: schoolsHash,
      sources: sourcesHash,
      briefs: briefsHash,
      corrections: correctionsHash,
      review_log: reviewLogHash
    }),
    previous_snapshot: previousSnapshotHash
  }
};

const currentEventsMatch = JSON.stringify(events) === JSON.stringify(hashedEvents);
const currentBriefsMatch = JSON.stringify(briefs) === JSON.stringify(stampedBriefs);
let currentManifestMatch = false;

if (previousManifest) {
  const comparablePrevious = structuredClone(previousManifest);
  const comparableManifest = structuredClone(manifest);
  currentManifestMatch = JSON.stringify(comparablePrevious) === JSON.stringify(comparableManifest);
}

if (checkOnly) {
  if (!currentEventsMatch) {
    console.error("Event hashes are stale. Run npm run hash:data.");
    process.exit(1);
  }
  if (!currentBriefsMatch) {
    console.error("Brief snapshot hashes are stale. Run npm run hash:data.");
    process.exit(1);
  }
  if (!previousManifest || !currentManifestMatch) {
    console.error("Snapshot manifest is missing or stale. Run npm run hash:data.");
    process.exit(1);
  }
  console.log(`Integrity check passed: ${manifest.hashes.full_snapshot}`);
  process.exit(0);
}

await writeJson(paths.events, hashedEvents);
await writeJson(paths.briefs, stampedBriefs);
await writeJson(paths.manifest, manifest);
await writeJson(`${paths.snapshotsDir}/${snapshotId}.json`, manifest);

console.log(`Wrote record hashes, brief snapshot hashes, and snapshot manifests.`);
console.log(manifest.hashes.full_snapshot);
