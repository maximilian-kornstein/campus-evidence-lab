import { paths, readJson, writeJson } from "./lib.mjs";
import { buildGovernmentReleaseResponseDepthAudit } from "./government-release-response-depth-audit-lib.mjs";

const [events, sources] = await Promise.all([readJson(paths.events), readJson(paths.sources)]);

const audit = buildGovernmentReleaseResponseDepthAudit({ events, sources });

await writeJson(paths.governmentReleaseResponseDepthAudit, audit);

console.log(
  `Generated government-release response-depth audit: ${audit.records_reviewed} records reviewed, ${audit.flagged_records} flagged.`
);
