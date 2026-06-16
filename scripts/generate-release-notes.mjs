import { writeFile } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";

const [manifest, snapshotIndex, changelog, sourceAudit, sourceAuditLive, briefs] = await Promise.all([
  readJson(paths.manifest),
  readJson(paths.snapshotIndex),
  readJson(paths.changelog),
  readJson(paths.sourceAudit),
  readJson(paths.sourceAuditLive),
  readJson(paths.briefs)
]);

const latestBriefs = [...briefs]
  .sort((a, b) => b.published_date.localeCompare(a.published_date) || a.title.localeCompare(b.title))
  .slice(0, 5);

const previousSnapshot = snapshotIndex.snapshots?.find((snapshot) => snapshot.snapshot_id !== manifest.snapshot_id);

function bullet(label, value) {
  return `- ${label}: ${value}`;
}

const lines = [
  "# Release Notes",
  "",
  `Generated for \`${manifest.snapshot_id}\`.`,
  "",
  "## Snapshot",
  "",
  bullet("Created", `\`${manifest.created_at}\``),
  bullet("Schema version", `\`${manifest.schema_version}\``),
  bullet("Full snapshot hash", `\`${manifest.hashes.full_snapshot}\``),
  bullet("Previous snapshot hash", manifest.hashes.previous_snapshot ? `\`${manifest.hashes.previous_snapshot}\`` : "None"),
  bullet("Archived snapshot", `\`/data/snapshots/${manifest.snapshot_id}.json\``),
  "",
  "## Dataset Counts",
  "",
  bullet("Events", manifest.totals.events),
  bullet("Schools", manifest.totals.schools),
  bullet("Sources", manifest.totals.sources),
  bullet("Briefs", manifest.totals.briefs),
  bullet("Corrections", manifest.totals.corrections),
  bullet("Review queues", manifest.totals.review_queues),
  bullet("Review samples", manifest.totals.review_samples),
  bullet("Review ledger entries", manifest.totals.review_ledger_entries),
  bullet("Methodology examples", manifest.totals.methodology_examples),
  bullet("Workflows", manifest.totals.workflows),
  bullet("Evidence-depth queues", manifest.totals.evidence_depth_queues),
  bullet("Gold record candidates", manifest.totals.gold_record_candidates),
  bullet("Reviewer challenge records", manifest.totals.reviewer_challenge_records),
  "",
  "## Dataset Hashes",
  "",
  bullet("Events", `\`${manifest.hashes.events}\``),
  bullet("Schools", `\`${manifest.hashes.schools}\``),
  bullet("Sources", `\`${manifest.hashes.sources}\``),
  bullet("Briefs", `\`${manifest.hashes.briefs}\``),
  bullet("Corrections", `\`${manifest.hashes.corrections}\``),
  bullet("Review log", `\`${manifest.hashes.review_log}\``),
  bullet("Review samples", `\`${manifest.hashes.review_samples}\``),
  bullet("Review ledger", `\`${manifest.hashes.review_ledger}\``),
  bullet("Methodology examples", `\`${manifest.hashes.methodology_examples}\``),
  bullet("Workflows", `\`${manifest.hashes.workflows}\``),
  bullet("Robustness metrics", `\`${manifest.hashes.robustness_metrics}\``),
  bullet("Evidence-depth queues", `\`${manifest.hashes.evidence_depth_queues}\``),
  bullet("Gold record set", `\`${manifest.hashes.gold_record_set}\``),
  bullet("Reviewer challenge pack", `\`${manifest.hashes.reviewer_challenge_pack}\``),
  "",
  "## Evidence Depth & Robustness",
  "",
  "- Robustness dashboard: `/robustness/`",
  "- Robustness metrics: `/data/robustness-metrics.json`",
  "- Evidence-depth queues: `/data/evidence-depth-queues.json`",
  "- Gold record candidates: `/data/gold-record-set.json`",
  "- Reviewer challenge pack: `/data/reviewer-challenge-pack.json`",
  "- These artifacts describe current dataset composition and review priorities; they must not be used as comparative campus judgments, frequency measures, risk ratings, or approval claims.",
  "",
  "## Public Briefs",
  "",
  ...latestBriefs.map((brief) => `- ${brief.published_date}: [${brief.title}](/briefs/${brief.id}/) (${brief.new_event_ids.length} new, ${brief.updated_event_ids.length} updated)`),
  "",
  "## Changelog",
  "",
  bullet("Public changelog entries", changelog.entry_count),
  bullet("Changelog artifact", "`/data/changelog.json`"),
  "",
  "## Source Audit",
  "",
  bullet("Audit mode", `\`${sourceAudit.mode}\``),
  bullet("Audited sources", sourceAudit.source_count),
  bullet("Referenced events", sourceAudit.event_count),
  bullet("Audit hash", `\`${sourceAudit.audit_hash}\``),
  bullet("Audit artifact", "`/data/source-audit.json`"),
  bullet("Live audit artifact", "`/data/source-audit-live.json`"),
  bullet("Live checked sources", sourceAuditLive.entries?.filter((entry) => entry.launch_check_status === "live_checked").length ?? 0),
  bullet("Live audit hash", `\`${sourceAuditLive.audit_hash}\``),
  "",
  "## Replication",
  "",
  "- Replication packet: `/replicate/`",
  "- Releases artifact: `/data/releases.json`",
  "- Release verification: `/data/release-verification.json`",
  "- Required commands: `npm ci`, `npm run check`, `npm run build`",
  "",
  "## Credibility Boundary",
  "",
  "- Credibility status: `/data/credibility-status.json`",
  "- Public acknowledgments require documented scope and display permission.",
  "- Local verification does not imply outside validation, endorsement, completeness, frequency measurement, or legal truth.",
  "",
  "## Research Exports",
  "",
  "- `/data/events-research.json` and `/data/events-research.csv` join event records with school and source fields.",
  "- `/data/schools-research.json` and `/data/schools-research.csv` add derived event counts, dates, communities, categories, and event IDs.",
  "- `/data/sources-research.json` and `/data/sources-research.csv` add related event IDs, counts, and schools.",
  "",
  "## Prior Snapshot",
  "",
  previousSnapshot
    ? `Previous archived snapshot: \`${previousSnapshot.snapshot_id}\` with full hash \`${previousSnapshot.full_snapshot_hash}\`.`
    : "No prior archived snapshot is currently indexed.",
  "",
  "## Verification",
  "",
  "This release is generated by `npm run release-notes:data` and verified by `npm run build`.",
  ""
];

await writeFile(path.join(rootDir, "RELEASE_NOTES.md"), `${lines.join("\n")}`);

console.log(`Generated release notes for ${manifest.snapshot_id}.`);
