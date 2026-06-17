import { paths, readJson, writeJson } from "./lib.mjs";
import { buildGovernmentReleaseResponseDepthRepairQueue } from "./government-release-response-depth-repair-queue-lib.mjs";

const [events, audit] = await Promise.all([readJson(paths.events), readJson(paths.governmentReleaseResponseDepthAudit)]);

const queue = buildGovernmentReleaseResponseDepthRepairQueue({ events, audit });

await writeJson(paths.governmentReleaseResponseDepthRepairQueue, queue);

console.log(
  `Generated government-release response-depth repair queue: ${queue.proposed_repairs} proposed, ${queue.blocked_repairs} blocked.`
);
