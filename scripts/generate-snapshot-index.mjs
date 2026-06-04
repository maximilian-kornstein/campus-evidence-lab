import { readdir } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, writeJson } from "./lib.mjs";

const snapshotFiles = (await readdir(paths.snapshotsDir))
  .filter((file) => /^snapshot_\d{4}_\d{2}_\d{2}_\d+_records\.json$/.test(file))
  .sort();

const snapshots = [];
for (const file of snapshotFiles) {
  const snapshot = await readJson(path.join(paths.snapshotsDir, file));
  snapshots.push({
    snapshot_id: snapshot.snapshot_id,
    path: `/data/snapshots/${file}`,
    created_at: snapshot.created_at,
    schema_version: snapshot.schema_version,
    totals: snapshot.totals,
    events_hash: snapshot.hashes.events,
    full_snapshot_hash: snapshot.hashes.full_snapshot
  });
}

snapshots.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.snapshot_id.localeCompare(a.snapshot_id));

await writeJson(paths.snapshotIndex, {
  generated_at: "2026-06-04",
  snapshot_count: snapshots.length,
  snapshots
});

console.log(`Generated snapshot index with ${snapshots.length} snapshots.`);
