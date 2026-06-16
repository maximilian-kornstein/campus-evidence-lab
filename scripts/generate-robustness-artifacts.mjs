import { paths, readJson, writeJson } from "./lib.mjs";
import {
  buildEvidenceDepthQueues,
  buildReviewerChallengePack,
  buildRobustnessMetrics,
  selectGoldRecordCandidates
} from "./robustness-metrics-lib.mjs";

const [events, sources, manifest] = await Promise.all([readJson(paths.events), readJson(paths.sources), readJson(paths.manifest)]);

const robustnessMetrics = buildRobustnessMetrics({ events, sources, manifest });
const evidenceDepthQueues = buildEvidenceDepthQueues({ events, sources, manifest, limit: 25 });
const goldRecordSet = selectGoldRecordCandidates({ events, sources, manifest, limit: 100 });
const reviewerChallengePack = buildReviewerChallengePack({ queues: evidenceDepthQueues, limit: 25 });

await Promise.all([
  writeJson(paths.robustnessMetrics, robustnessMetrics),
  writeJson(paths.evidenceDepthQueues, evidenceDepthQueues),
  writeJson(paths.goldRecordSet, goldRecordSet),
  writeJson(paths.reviewerChallengePack, reviewerChallengePack)
]);

console.log(
  `Generated robustness artifacts: ${evidenceDepthQueues.queues.length} queues, ${goldRecordSet.records.length} gold candidates, ${reviewerChallengePack.records.length} challenge records.`
);
