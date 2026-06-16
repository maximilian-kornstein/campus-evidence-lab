import { paths, readJson, writeJson } from "./lib.mjs";
import { buildEvidenceCapsules, buildSourceProvenanceQueues } from "./evidence-capsules-lib.mjs";

const [events, sources, manifest] = await Promise.all([readJson(paths.events), readJson(paths.sources), readJson(paths.manifest)]);

const evidenceCapsules = buildEvidenceCapsules({ events, sources, manifest });
const sourceProvenanceQueues = buildSourceProvenanceQueues({ capsules: evidenceCapsules, limit: 25 });

await Promise.all([
  writeJson(paths.evidenceCapsules, evidenceCapsules),
  writeJson(paths.sourceProvenanceQueues, sourceProvenanceQueues)
]);

console.log(
  `Generated evidence capsules for ${evidenceCapsules.records.length} records and ${sourceProvenanceQueues.queues.length} source-provenance queues.`
);
