import { paths, readJson, writeJson } from "./lib.mjs";
import { buildExternalReviewPacket, validateExternalReviewPacket } from "./external-review-packet-lib.mjs";

const [events, sources, goldV1CertificationStatus, reviewDebtLedger, challengeQueues, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.sources),
  readJson(paths.goldV1CertificationStatus),
  readJson(paths.reviewDebtLedger),
  readJson(paths.challengeQueues),
  readJson(paths.manifest)
]);

const packet = buildExternalReviewPacket({
  events,
  sources,
  goldStatus: goldV1CertificationStatus,
  reviewDebtLedger,
  challengeQueues,
  manifest,
  limit: 25
});

const errors = validateExternalReviewPacket({
  packet,
  events,
  sources,
  goldStatus: goldV1CertificationStatus,
  reviewDebtLedger,
  manifest
});
if (errors.length) {
  throw new Error(`External review packet validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
}

await writeJson(paths.externalReviewPacket, packet);

console.log(
  `Generated external review packet: ${packet.records.length} certified Gold v1 records, ${packet.challenge_templates.length} challenge templates, ${packet.known_limits.unresolved_records.blocked} blocked review-debt records.`
);
