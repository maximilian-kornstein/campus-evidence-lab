import { paths, readJson, writeJson } from "./lib.mjs";
import { buildChallengeLedger, buildChallengeQueues, buildChallengeStandards } from "./challenge-protocol-lib.mjs";

const [events, schools, corrections, evidenceCapsules, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.corrections),
  readJson(paths.evidenceCapsules),
  readJson(paths.manifest)
]);

const generatedAt = manifest.created_at ?? evidenceCapsules.generated_at ?? "2026-06-03";
const snapshotId = manifest.snapshot_id ?? evidenceCapsules.snapshot_id ?? "unversioned";

const challengeStandards = buildChallengeStandards({ snapshot_id: snapshotId, generated_at: generatedAt });
const challengeQueues = buildChallengeQueues({
  capsules: evidenceCapsules,
  events,
  schools,
  standards: challengeStandards,
  limit: 25,
  packetLimit: 75
});
const challengeLedger = buildChallengeLedger({ challengeQueues, corrections });

await Promise.all([
  writeJson(paths.challengeStandards, challengeStandards),
  writeJson(paths.challengeQueues, challengeQueues),
  writeJson(paths.challengeLedger, challengeLedger)
]);

console.log(
  `Generated ${challengeStandards.standards.length} challenge standards, ${challengeQueues.queues.length} challenge queues, ${challengeQueues.packets.length} challenge packets, and ${challengeLedger.entries.length} ledger entries.`
);
