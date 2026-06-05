import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";

const errors = [];
const siteRoot = process.env.SITE_ROOT ? path.resolve(rootDir, process.env.SITE_ROOT) : rootDir;

const sitePaths = {
  events: path.join(siteRoot, "data", "events.json"),
  eventsResearch: path.join(siteRoot, "data", "events-research.json"),
  schools: path.join(siteRoot, "data", "schools.json"),
  schoolsResearch: path.join(siteRoot, "data", "schools-research.json"),
  sources: path.join(siteRoot, "data", "sources.json"),
  sourcesResearch: path.join(siteRoot, "data", "sources-research.json"),
  briefs: path.join(siteRoot, "data", "briefs.json"),
  manifest: path.join(siteRoot, "data", "snapshot-manifest.json")
};

async function readSiteJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function mustExist(relativePath) {
  try {
    await access(path.join(siteRoot, relativePath));
  } catch {
    errors.push(`Missing ${relativePath}`);
  }
}

async function mustContain(relativePath, text) {
  const filePath = path.join(siteRoot, relativePath);
  try {
    const content = await readFile(filePath, "utf8");
    if (!content.includes(text)) errors.push(`${relativePath} does not contain ${text}`);
  } catch {
    errors.push(`Unable to read ${relativePath}`);
  }
}

async function fileExists(relativePath) {
  try {
    await access(path.join(siteRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function htmlFiles(dir = siteRoot) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (siteRoot === rootDir && entry.name === "dist") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await htmlFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(fullPath);
    }
  }
  return files;
}

const [events, schools, sources, corrections, reviewLog, manifest] = await Promise.all([
  readSiteJson(sitePaths.events),
  readSiteJson(sitePaths.schools),
  readSiteJson(sitePaths.sources),
  readSiteJson(path.join(siteRoot, "data", "corrections.json")),
  readSiteJson(path.join(siteRoot, "data", "review-log.json")),
  readSiteJson(sitePaths.manifest)
]);
const researchEvents = await readSiteJson(sitePaths.eventsResearch);
const researchSchools = await readSiteJson(sitePaths.schoolsResearch);
const researchSources = await readSiteJson(sitePaths.sourcesResearch);

for (const route of [
  "index.html",
  "events/index.html",
  "schools/index.html",
  "briefs/index.html",
  "sources/index.html",
  "quality/index.html",
  "methodology/index.html",
  "impact/index.html",
  "trust/index.html",
  "acknowledgments/index.html",
  "guide/index.html",
  "research-guide/index.html",
  "downloads/index.html",
  "submit/index.html",
  "about/index.html",
  "license/index.html"
]) {
  await mustExist(route);
}

for (const artifact of [
  "data/events.json",
  "data/events.csv",
  "data/events-research.json",
  "data/events-research.csv",
  "data/schools.json",
  "data/schools.csv",
  "data/schools-research.json",
  "data/schools-research.csv",
  "data/sources.json",
  "data/sources.csv",
  "data/sources-research.json",
  "data/sources-research.csv",
  "data/source-audit.json",
  "data/source-audit-live.json",
  "data/changelog.json",
  "data/snapshot-index.json",
  "data/corrections.json",
  "data/review-log.json",
  "data/snapshot-manifest.json",
  `data/snapshots/${manifest.snapshot_id}.json`,
  "schema/correction.schema.json",
  "schema/review-log.schema.json",
  "docs/content-safety.md",
  "docs/contributing.md",
  "docs/citation.md",
  "docs/review-workflow.md",
  "docs/source-audit.md",
  "rss.xml",
  "sitemap.xml",
  "RELEASE_NOTES.md",
  "robots.txt",
  "LICENSE.md",
  "DATA_LICENSE.md",
  "_headers"
]) {
  await mustExist(artifact);
}

if (siteRoot === rootDir) {
  for (const workflowArtifact of [
    ".github/ISSUE_TEMPLATE/source-submission.yml",
    ".github/ISSUE_TEMPLATE/correction-request.yml",
    ".github/ISSUE_TEMPLATE/duplicate-report.yml",
    ".github/ISSUE_TEMPLATE/school-metadata-correction.yml",
    ".github/ISSUE_TEMPLATE/reviewer-checklist.yml",
    ".github/workflows/check.yml",
    ".github/workflows/pages.yml"
  ]) {
    await mustExist(workflowArtifact);
  }
}

for (const submitCopy of [
  "source suggestions",
  "corrections",
  "duplicate reports",
  "school metadata corrections",
  "docs/contributing.md"
]) {
  await mustContain("submit/index.html", submitCopy);
}

for (const contributingCopy of [
  "Ways to Contribute",
  "GitHub Workflow",
  "Review Standard",
  "Pull Request Checklist",
  ".github/ISSUE_TEMPLATE/source-submission.yml",
  ".github/ISSUE_TEMPLATE/correction-request.yml",
  ".github/ISSUE_TEMPLATE/duplicate-report.yml",
  ".github/ISSUE_TEMPLATE/school-metadata-correction.yml",
  ".github/ISSUE_TEMPLATE/reviewer-checklist.yml",
  "npm run prepare:data",
  "npm run check"
]) {
  await mustContain("docs/contributing.md", contributingCopy);
}

for (const methodologyCopy of [
  "Current Scope",
  "Event Category Definitions",
  "Affected Community Definitions",
  "No Ranking System",
  "Limitations",
  "Versioning and Audit Policy"
]) {
  await mustContain("methodology/index.html", methodologyCopy);
}

for (const impactCopy of [
  "Proof of infrastructure",
  "Current Reach",
  "Research Infrastructure",
  "Trust and Accountability",
  "Current Use Cases",
  "Public Roadmap",
  "Partnership Status",
  "Claims Not Made",
  "not school rankings"
]) {
  await mustContain("impact/index.html", impactCopy);
}

for (const trustCopy of [
  "Trust & Review Packet",
  "Current Proof Package",
  "What A Reviewer Can Audit In 30 Minutes",
  "Review Tasks",
  "What Trust Signals Prove",
  "What They Do Not Prove",
  "Reviewer Entry Points",
  "Acknowledgment Rule",
  "reviewer-checklist.yml",
  "docs/outreach-email.md",
  "docs/partner-acknowledgment-policy.md"
]) {
  await mustContain("trust/index.html", trustCopy);
}

for (const acknowledgmentCopy of [
  "No public acknowledgments yet",
  "Acknowledgment Criteria",
  "Future Categories",
  "Methodology reviewer",
  "Source audit reviewer",
  "Organizational collaborator",
  "partner-acknowledgment-policy.md"
]) {
  await mustContain("acknowledgments/index.html", acknowledgmentCopy);
}

for (const guideCopy of [
  "Contributor Guide",
  "Ways to Contribute",
  "Accepted Sources",
  "Rejected Material",
  "Submission Workflow",
  "Partner and Reviewer Path",
  "Trust & Review Packet",
  "reviewer-checklist.yml",
  "Research Guide",
  "npm run prepare:data",
  "npm run check"
]) {
  await mustContain("guide/index.html", guideCopy);
}

for (const researchGuideCopy of [
  "Research Guide",
  "Use the archive without overstating it",
  "Read Counts As Documentation",
  "Check Source Support",
  "Cite The Snapshot",
  "Responsible Output Checklist"
]) {
  await mustContain("research-guide/index.html", researchGuideCopy);
}

for (const eventsCopy of ["source type", "date range", "verification", "sort"]) {
  await mustContain("events/index.html", eventsCopy);
}
for (const eventsDownload of ["data/events.json", "data/events.csv", "data/events-research.json", "data/events-research.csv", "Current events data is downloadable"]) {
  await mustContain("events/index.html", eventsDownload);
}

for (const schoolsCopy of ["Search schools", "filter by state", "most recent update"]) {
  await mustContain("schools/index.html", schoolsCopy);
}

for (const sourcesCopy of ["Search sources", "filter by source type", "direct external source URLs", "audit downloads"]) {
  await mustContain("sources/index.html", sourcesCopy);
}

for (const aboutCopy of [
  "Mission",
  "Founder Note",
  "Why This Starts Narrow",
  "Open-Source Commitment",
  "Contact and Contributions",
  "submit/",
  "methodology/",
  "impact/",
  "trust/",
  "acknowledgments/",
  "guide/",
  "research-guide/",
  "downloads/"
]) {
  await mustContain("about/index.html", aboutCopy);
}

for (const downloadsCopy of [
  "Latest dataset JSON",
  "Latest dataset CSV",
  "Research events JSON",
  "Research events CSV",
  "Research schools JSON",
  "Research schools CSV",
  "Research sources JSON",
  "Research sources CSV",
  "Live source audit",
  "Schools dataset",
  "Source index",
  "Weekly snapshot downloads",
  "Snapshot manifest",
  "Dataset license",
  "Changelog",
  "Release notes",
  "Data dictionary",
  "Citation guidance",
  "Contribution guide",
  "record count",
  "last updated date",
  "schema version",
  "latest snapshot hash"
]) {
  await mustContain("downloads/index.html", downloadsCopy);
}

for (const releaseCopy of [
  manifest.snapshot_id,
  manifest.hashes.full_snapshot,
  "Dataset Counts",
  "Dataset Hashes",
  "Research Exports",
  "Source Audit",
  "/data/events-research.json",
  "/data/schools-research.json",
  "/data/sources-research.json"
]) {
  await mustContain("RELEASE_NOTES.md", releaseCopy);
}

if (researchEvents.length !== events.length) {
  errors.push(`Research events export has ${researchEvents.length} rows; expected ${events.length}`);
}
const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
for (const researchEvent of researchEvents) {
  const canonicalEvent = events.find((event) => event.id === researchEvent.id);
  if (!canonicalEvent) {
    errors.push(`Research events export includes unknown event ${researchEvent.id}`);
    continue;
  }
  const school = schoolMap.get(canonicalEvent.school_id);
  if (researchEvent.school_name !== school?.name || researchEvent.school_state !== school?.state) {
    errors.push(`Research event ${researchEvent.id} has stale school join fields`);
  }
  const expectedSourceUrls = canonicalEvent.source_ids.map((sourceId) => sourceMap.get(sourceId)?.url).filter(Boolean).sort();
  const actualSourceUrls = [...(researchEvent.source_urls ?? [])].sort();
  if (JSON.stringify(actualSourceUrls) !== JSON.stringify(expectedSourceUrls)) {
    errors.push(`Research event ${researchEvent.id} has stale source_urls`);
  }
}
const researchCsv = await readFile(path.join(siteRoot, "data", "events-research.csv"), "utf8");
for (const column of ["school_name", "school_state", "source_titles", "source_publishers", "source_urls"]) {
  if (!researchCsv.split("\n")[0].split(",").includes(column)) {
    errors.push(`events-research.csv missing ${column} column`);
  }
}

if (researchSchools.length !== schools.length) {
  errors.push(`Research schools export has ${researchSchools.length} rows; expected ${schools.length}`);
}
for (const researchSchool of researchSchools) {
  const schoolEvents = events.filter((event) => event.school_id === researchSchool.id);
  if (researchSchool.total_event_count !== schoolEvents.length) {
    errors.push(`Research school ${researchSchool.id} has stale total_event_count`);
  }
  const latestRecordDate = schoolEvents.map((event) => event.date).sort().at(-1) ?? "";
  const lastUpdatedDate = schoolEvents.map((event) => event.updated_at).sort().at(-1) ?? "";
  if (researchSchool.latest_record_date !== latestRecordDate || researchSchool.last_updated_date !== lastUpdatedDate) {
    errors.push(`Research school ${researchSchool.id} has stale date rollups`);
  }
}
const researchSchoolsCsv = await readFile(path.join(siteRoot, "data", "schools-research.csv"), "utf8");
for (const column of ["total_event_count", "latest_record_date", "last_updated_date", "affected_communities", "event_ids"]) {
  if (!researchSchoolsCsv.split("\n")[0].split(",").includes(column)) {
    errors.push(`schools-research.csv missing ${column} column`);
  }
}

if (researchSources.length !== sources.length) {
  errors.push(`Research sources export has ${researchSources.length} rows; expected ${sources.length}`);
}
for (const researchSource of researchSources) {
  const sourceEvents = events.filter((event) => event.source_ids.includes(researchSource.id));
  const expectedEventIds = sourceEvents.map((event) => event.id).sort();
  const actualEventIds = [...(researchSource.related_event_ids ?? [])].sort();
  if (researchSource.related_event_count !== sourceEvents.length || JSON.stringify(actualEventIds) !== JSON.stringify(expectedEventIds)) {
    errors.push(`Research source ${researchSource.id} has stale event references`);
  }
}
const researchSourcesCsv = await readFile(path.join(siteRoot, "data", "sources-research.csv"), "utf8");
for (const column of ["related_event_ids", "related_event_count", "related_school_ids", "related_school_names"]) {
  if (!researchSourcesCsv.split("\n")[0].split(",").includes(column)) {
    errors.push(`sources-research.csv missing ${column} column`);
  }
}

for (const event of events) {
  const detailPath = `events/${event.id}/index.html`;
  await mustExist(detailPath);
  await mustContain(detailPath, event.record_hash);
  for (const eventCopy of [
    "External source URL",
    "Request a source-backed correction",
    `submit/?record_id=${event.id}`,
    "Response date",
    "Last updated",
    "Verification rationale",
    "Changelog"
  ]) {
    await mustContain(detailPath, eventCopy);
  }
  for (const sourceId of event.source_ids) {
    const source = sources.find((item) => item.id === sourceId);
    if (source) await mustContain(detailPath, source.url);
  }
}

for (const school of schools) {
  const schoolPath = `schools/${school.id}/index.html`;
  await mustExist(schoolPath);
  await mustContain(schoolPath, `events/?school=${school.id}`);
  for (const schoolCopy of ["Timeline", "Institutional Responses", "Public Legal/OCR Items", "Related Sources", "Dataset snapshot"]) {
    await mustContain(schoolPath, schoolCopy);
  }
}

const briefs = await readSiteJson(sitePaths.briefs);
for (const brief of briefs) {
  await mustExist(`briefs/${brief.id}/index.html`);
  if (brief.snapshot_hash !== manifest.hashes.events) {
    errors.push(`Brief ${brief.id} snapshot_hash does not match current event dataset hash`);
  }
  for (const briefCopy of [
    "Newly Added Verified Records",
    "Updated Records",
    "Notable Institutional Responses",
    "Legal/OCR Updates",
    "Source-Type Breakdown",
    "Corrections Issued",
    "Dataset Downloads",
    "data/events.json",
    "data/events.csv",
    "data/snapshot-manifest.json"
  ]) {
    await mustContain(`briefs/${brief.id}/index.html`, briefCopy);
  }
}

const sitemap = await readFile(path.join(siteRoot, "sitemap.xml"), "utf8");
for (const event of events) {
  if (!sitemap.includes(`/events/${event.id}/`)) {
    errors.push(`Sitemap missing event ${event.id}`);
  }
}
for (const school of schools) {
  if (!sitemap.includes(`/schools/${school.id}/`)) {
    errors.push(`Sitemap missing school ${school.id}`);
  }
}
for (const brief of briefs) {
  if (!sitemap.includes(`/briefs/${brief.id}/`)) {
    errors.push(`Sitemap missing brief ${brief.id}`);
  }
}

for (const source of sources) {
  if (!source.url.startsWith("https://")) {
    errors.push(`Source ${source.id} does not use HTTPS`);
  }
  const detailPath = `sources/${source.id}/index.html`;
  await mustExist(detailPath);
  await mustContain(detailPath, source.url);
  if (!sitemap.includes(`/sources/${source.id}/`)) {
    errors.push(`Sitemap missing source ${source.id}`);
  }
}

if (manifest.totals.events !== events.length) {
  errors.push(`Manifest event count ${manifest.totals.events} does not match events ${events.length}`);
}

if (manifest.totals.schools !== schools.length) {
  errors.push(`Manifest school count ${manifest.totals.schools} does not match schools ${schools.length}`);
}

if (manifest.totals.sources !== sources.length) {
  errors.push(`Manifest source count ${manifest.totals.sources} does not match sources ${sources.length}`);
}

if (manifest.totals.corrections !== corrections.length) {
  errors.push(`Manifest correction count ${manifest.totals.corrections} does not match corrections ${corrections.length}`);
}

if (manifest.totals.review_queues !== reviewLog.queues.length) {
  errors.push(`Manifest review queue count ${manifest.totals.review_queues} does not match review queues ${reviewLog.queues.length}`);
}

const sourceAudit = await readSiteJson(path.join(siteRoot, "data", "source-audit.json"));
if (sourceAudit.source_count !== sources.length) {
  errors.push(`Source audit count ${sourceAudit.source_count} does not match sources ${sources.length}`);
}
for (const source of sources) {
  const auditEntry = sourceAudit.entries?.find((entry) => entry.source_id === source.id);
  if (!auditEntry) {
    errors.push(`Source audit missing ${source.id}`);
  } else {
    await mustExist(auditEntry.internal_source_path.replace(/^\//, "") + "index.html");
  }
}

const liveSourceAudit = await readSiteJson(path.join(siteRoot, "data", "source-audit-live.json"));
if (liveSourceAudit.mode !== "live") {
  errors.push("Live source audit must use mode=live");
}
if (liveSourceAudit.source_count !== sources.length) {
  errors.push(`Live source audit count ${liveSourceAudit.source_count} does not match sources ${sources.length}`);
}
if (liveSourceAudit.event_count !== events.length) {
  errors.push(`Live source audit event count ${liveSourceAudit.event_count} does not match events ${events.length}`);
}
for (const source of sources) {
  const liveEntry = liveSourceAudit.entries?.find((entry) => entry.source_id === source.id);
  const sourceEvents = events.filter((event) => event.source_ids.includes(source.id)).map((event) => event.id).sort();
  const liveEventIds = [...(liveEntry?.referenced_event_ids ?? [])].sort();
  if (!liveEntry) {
    errors.push(`Live source audit missing ${source.id}`);
  } else if (liveEntry.launch_check_status !== "live_checked" || liveEntry.live_status !== "ok" || liveEntry.http_status < 200 || liveEntry.http_status > 399) {
    errors.push(`Live source audit did not verify ${source.id}`);
  } else if (liveEntry.external_url !== source.url) {
    errors.push(`Live source audit has stale URL for ${source.id}`);
  } else if (JSON.stringify(liveEventIds) !== JSON.stringify(sourceEvents)) {
    errors.push(`Live source audit has stale event references for ${source.id}`);
  }
}

const changelog = await readSiteJson(path.join(siteRoot, "data", "changelog.json"));
const expectedChangelogEntries = events.reduce((count, event) => count + event.changelog.length, 0);
if (changelog.entry_count !== expectedChangelogEntries) {
  errors.push(`Changelog entry count ${changelog.entry_count} does not match event changelogs ${expectedChangelogEntries}`);
}
for (const event of events) {
  if (!changelog.entries?.some((entry) => entry.event_id === event.id && entry.record_hash === event.record_hash)) {
    errors.push(`Changelog missing current record hash for ${event.id}`);
  }
}

const snapshotIndex = await readSiteJson(path.join(siteRoot, "data", "snapshot-index.json"));
if (snapshotIndex.snapshot_count !== snapshotIndex.snapshots?.length) {
  errors.push(`Snapshot index count ${snapshotIndex.snapshot_count} does not match listed snapshots`);
}
if (!snapshotIndex.snapshots?.some((snapshot) => snapshot.snapshot_id === manifest.snapshot_id)) {
  errors.push(`Snapshot index missing current snapshot ${manifest.snapshot_id}`);
}
for (const snapshot of snapshotIndex.snapshots ?? []) {
  await mustExist(snapshot.path.replace(/^\//, ""));
}

const rss = await readFile(path.join(siteRoot, "rss.xml"), "utf8");
for (const brief of briefs) {
  if (!rss.includes(`/briefs/${brief.id}/`)) {
    errors.push(`RSS feed missing brief ${brief.id}`);
  }
}

if (events.length < 100) {
  errors.push(`Dataset has ${events.length} events; expected at least 100 for MVP credibility threshold`);
}

for (const filePath of await htmlFiles()) {
  const relativeFile = path.relative(siteRoot, filePath);
  const html = await readFile(filePath, "utf8");
  const hrefs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("#") ||
      href.startsWith("data:")
    ) {
      continue;
    }

    const cleanHref = href.split("#")[0].split("?")[0];
    if (!cleanHref) continue;
    if (cleanHref.startsWith("/") && !cleanHref.startsWith("//")) {
      errors.push(`${relativeFile} uses root-relative internal link ${href}; use a relative path for project-page deploys`);
      continue;
    }
    const relativeTarget = cleanHref.startsWith("/") ? cleanHref.slice(1) : path.join(path.dirname(relativeFile), cleanHref);
    const normalized = relativeTarget.endsWith("/") ? path.join(relativeTarget, "index.html") : relativeTarget;
    const exists = await fileExists(normalized);
    if (!exists) {
      errors.push(`${relativeFile} links to missing ${href}`);
    }
  }
}

if (errors.length) {
  console.error(`Site QA failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Site QA passed: ${events.length} events, ${schools.length} schools, ${sources.length} sources.`);
