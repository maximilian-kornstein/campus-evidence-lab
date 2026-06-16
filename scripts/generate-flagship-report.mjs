import { paths, readJson, writeJson } from "./lib.mjs";
import { buildFlagshipReport, buildGoldRecordV1 } from "./flagship-report-lib.mjs";

const [events, schools, sources, robustnessMetrics, challengeQueues, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.robustnessMetrics),
  readJson(paths.challengeQueues),
  readJson(paths.manifest)
]);

const flagshipReport = buildFlagshipReport({
  events,
  schools,
  sources,
  robustnessMetrics,
  challengeQueues,
  manifest
});

const goldRecordV1 = buildGoldRecordV1({
  events,
  schools,
  sources,
  challengeQueues,
  manifest,
  limit: 25
});

await Promise.all([writeJson(paths.flagshipReport, flagshipReport), writeJson(paths.goldRecordV1, goldRecordV1)]);

console.log(`Generated flagship report with ${flagshipReport.findings.length} findings and ${goldRecordV1.records.length} gold v1 packets.`);
