import { buildReviewSamples } from "./review-samples-lib.mjs";
import { paths, readJson, writeJson } from "./lib.mjs";

const [events, manifest, sourceAuditLive] = await Promise.all([
  readJson(paths.events),
  readJson(paths.manifest),
  readJson(paths.sourceAuditLive)
]);

const samples = buildReviewSamples({
  records: events,
  sourceAuditLive,
  snapshotId: manifest.snapshot_id,
  snapshotHash: manifest.hashes.events
});

await writeJson(paths.reviewSamples, samples);

console.log(`Generated ${samples.samples.length} deterministic review samples for ${manifest.snapshot_id}.`);
