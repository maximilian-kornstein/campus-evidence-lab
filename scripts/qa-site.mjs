import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { paths, readJson, rootDir } from "./lib.mjs";
import { responseDisplayProfile } from "../assets/record-display.js";

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

async function mustNotContain(relativePath, text) {
  const filePath = path.join(siteRoot, relativePath);
  try {
    const content = await readFile(filePath, "utf8");
    if (content.includes(text)) errors.push(`${relativePath} should not contain ${text}`);
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

function challengeRecordHrefs(html) {
  const hrefs = [];
  const linkPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const text = match[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (text !== "Challenge this record") continue;
    const hrefMatch = match[1].match(/\bhref="([^"]+)"/i);
    hrefs.push(hrefMatch?.[1] ?? "");
  }
  return hrefs;
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
  "import-waves/index.html",
  "import-waves/ed-campus-safety-wave-001/index.html",
  "import-waves/ed-campus-safety-wave-002/index.html",
  "import-waves/ed-campus-safety-wave-003/index.html",
  "import-waves/ed-campus-safety-wave-004/index.html",
  "import-waves/ed-campus-safety-wave-005/index.html",
  "import-waves/ed-campus-safety-wave-006/index.html",
  "methodology/index.html",
  "impact/index.html",
  "updates/index.html",
  "trust/index.html",
  "press/index.html",
  "acknowledgments/index.html",
  "reviewer-brief/index.html",
  "journalist-guide/index.html",
  "guide/index.html",
  "research-guide/index.html",
  "research-workspace/index.html",
  "reviewer-queue/index.html",
  "workflows/index.html",
  "robustness/index.html",
  "review-debt/index.html",
  "external-review/index.html",
  "known-limits/index.html",
  "certification/index.html",
  "certification/batch-001/index.html",
  "ed-provenance/index.html",
  "certification-batches/index.html",
  "evidence/index.html",
  "flagship/index.html",
  "gold-records/index.html",
  "codebook/index.html",
  "coverage/index.html",
  "replicate/index.html",
  "credibility/index.html",
  "challenge/index.html",
  "briefs/brief_2026_06_16_methodology_stress_test/index.html",
  "briefs/brief_2026_06_16_signature_finding_documentation_over_counts/index.html",
  "downloads/index.html",
  "protocol/index.html",
  "submit/index.html",
  "about/index.html",
  "license/index.html",
  "policies/index.html",
  "policies/terms-of-use/index.html",
  "policies/privacy-policy/index.html",
  "policies/data-license-addendum/index.html",
  "policies/submission-terms/index.html",
  "policies/corrections-and-right-of-reply-policy/index.html",
  "policies/responsible-use-policy/index.html",
  "policies/ai-use-disclosure/index.html",
  "policies/takedown-and-redaction-policy/index.html",
  "policies/reviewer-agreement/index.html"
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
  "data/certification-ledger.json",
  "data/ed-dataset-provenance-audit.json",
  "data/certification-batches.json",
  "data/product-updates.json",
  "data/product-milestones.json",
  "data/changelog.json",
  "data/snapshot-index.json",
  "data/corrections.json",
  "data/import-manifests.json",
  "data/import-candidates/ed-campus-safety-wave-001.json",
  "data/import-waves/ed-campus-safety-wave-001.json",
  "data/import-quarantine/ed-campus-safety-wave-001.json",
  "data/import-candidates/ed-campus-safety-wave-002.json",
  "data/import-waves/ed-campus-safety-wave-002.json",
  "data/import-quarantine/ed-campus-safety-wave-002.json",
  "data/import-candidates/ed-campus-safety-wave-003.json",
  "data/import-waves/ed-campus-safety-wave-003.json",
  "data/import-quarantine/ed-campus-safety-wave-003.json",
  "data/import-candidates/ed-campus-safety-wave-004.json",
  "data/import-waves/ed-campus-safety-wave-004.json",
  "data/import-quarantine/ed-campus-safety-wave-004.json",
  "data/import-candidates/ed-campus-safety-wave-005.json",
  "data/import-waves/ed-campus-safety-wave-005.json",
  "data/import-quarantine/ed-campus-safety-wave-005.json",
  "data/import-candidates/ed-campus-safety-wave-006.json",
  "data/import-waves/ed-campus-safety-wave-006.json",
  "data/import-quarantine/ed-campus-safety-wave-006.json",
  "data/review-log.json",
  "data/review-samples.json",
  "data/review-ledger.json",
  "data/methodology-examples.json",
  "data/workflows.json",
  "data/releases.json",
  "data/release-verification.json",
  "data/credibility-status.json",
  "data/robustness-metrics.json",
  "data/evidence-depth-queues.json",
  "data/gold-record-set.json",
  "data/reviewer-challenge-pack.json",
  "data/evidence-capsules.json",
  "data/source-provenance-queues.json",
  "data/challenge-standards.json",
  "data/challenge-queues.json",
  "data/challenge-ledger.json",
  "data/flagship-report.json",
  "data/gold-record-v1.json",
  "data/record-quality-audit.json",
  "data/record-quality-reviewer-packet.json",
  "data/gold-v1-certification-status.json",
  "data/review-debt-ledger.json",
  "data/external-review-packet.json",
  "data/snapshot-manifest.json",
  `data/snapshots/${manifest.snapshot_id}.json`,
  "schema/import-manifest.schema.json",
  "schema/import-wave.schema.json",
  "schema/import-quarantine.schema.json",
  "schema/correction.schema.json",
  "schema/review-log.schema.json",
  "schema/review-ledger.schema.json",
  "schema/methodology-example.schema.json",
  "schema/workflow.schema.json",
  "schema/release.schema.json",
  "schema/release-verification.schema.json",
  "schema/credibility-status.schema.json",
  "schema/robustness-metrics.schema.json",
  "schema/evidence-depth-queues.schema.json",
  "schema/gold-record-set.schema.json",
  "schema/reviewer-challenge-pack.schema.json",
  "schema/evidence-capsules.schema.json",
  "schema/source-provenance-queues.schema.json",
  "schema/challenge-standards.schema.json",
  "schema/challenge-queues.schema.json",
  "schema/challenge-ledger.schema.json",
  "schema/flagship-report.schema.json",
  "schema/gold-record-v1.schema.json",
  "schema/record-quality-audit.schema.json",
  "schema/record-quality-reviewer-packet.schema.json",
  "schema/gold-v1-certification-status.schema.json",
  "schema/review-debt-ledger.schema.json",
  "schema/external-review-packet.schema.json",
  "docs/codebook.md",
  "docs/content-safety.md",
  "docs/contributing.md",
  "docs/citation.md",
  "docs/review-workflow.md",
  "docs/reviewer-brief.md",
  "docs/record-quality-audit.md",
  "docs/record-quality-reviewer-packet.md",
  "docs/gold-v1-certification-status.md",
  "docs/review-debt-ledger.md",
  "docs/review-debt-zero-roadmap.md",
  "docs/external-review-packet.md",
  "docs/source-to-record-replication-guide.md",
  "docs/reviewer-challenge-templates.md",
  "docs/known-limits-unresolved-records.md",
  "docs/source-audit.md",
  "docs/institutional-accountability-standard.md",
  "docs/import-wave-qa-standard.md",
  "docs/source-family-bulk-targets.md",
  "docs/institution-dossier-standard.md",
  "docs/import-wave-runbook.md",
  "docs/publication-incident-response.md",
  "docs/policies/terms-of-use.md",
  "docs/policies/privacy-policy.md",
  "docs/policies/data-license-addendum.md",
  "docs/policies/submission-terms.md",
  "docs/policies/corrections-and-right-of-reply-policy.md",
  "docs/policies/responsible-use-policy.md",
  "docs/policies/ai-use-disclosure.md",
  "docs/policies/takedown-and-redaction-policy.md",
  "docs/policies/reviewer-agreement.md",
  "docs/methodology-stress-test.md",
  "docs/replication.md",
  "docs/signature-finding-documentation-over-counts.md",
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

for (const homepageCopy of [
  "Public-source civil-rights evidence infrastructure",
  "Search Records",
  "events/?focus=search",
  "Build Reporting Packet",
  "research-workspace/?focus=records",
  "Download Data",
  "Review Methodology",
  "protocol/"
]) {
  await mustContain("index.html", homepageCopy);
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
  "Event Record Unit",
  "Source Reliability Protocol",
  "Event Category Definitions",
  "Affected Community Definitions",
  "known taxonomy limitation",
  "Submit Public Sources",
  "Update Cadence",
  "No Ranking System",
  "Limitations",
  "Versioning and Audit Policy"
]) {
  await mustContain("methodology/index.html", methodologyCopy);
}

for (const codebookCopy of ["Public Codebook", "not a ranking system", "Affected-Community Taxonomy Note", "methodology examples JSON"]) {
  await mustContain("codebook/index.html", codebookCopy);
}

for (const coverageCopy of ["Coverage Limits", "does not measure underlying incident prevalence", "student-newsroom capacity", "Responsible Use"]) {
  await mustContain("coverage/index.html", coverageCopy);
}

for (const stressTestCopy of ["Where Campus Evidence Lab Can Be Wrong", "wrong, incomplete, skewed, or misused"]) {
  await mustContain("briefs/brief_2026_06_16_methodology_stress_test/index.html", stressTestCopy);
}

for (const workflowCopy of ["Workflows", "Start with a task", "workflows-root"]) {
  await mustContain("workflows/index.html", workflowCopy);
}

for (const robustnessCopy of ["Evidence Robustness", "source concentration", "response depth", "robustness-root"]) {
  await mustContain("robustness/index.html", robustnessCopy);
}

for (const evidenceCopy of ["Evidence Provenance", "source-to-field capsule", "evidence-root"]) {
  await mustContain("evidence/index.html", evidenceCopy);
}

for (const replicateCopy of ["Replication", "npm run check", "Release verification"]) {
  await mustContain("replicate/index.html", replicateCopy);
}

for (const credibilityCopy of ["Credibility Boundaries", "display permission is clear", "credibility status JSON"]) {
  await mustContain("credibility/index.html", credibilityCopy);
}

for (const challengeCopy of [
  "Adversarial Review",
  "Challenge Standards",
  "Adversarial Queues",
  "Challenge standards JSON",
  "not a ranking",
  "external audit"
]) {
  await mustContain("challenge/index.html", challengeCopy);
}

for (const signatureCopy of ["Documentation Over Counts", "not a record count", "classification rationale"]) {
  await mustContain("briefs/brief_2026_06_16_signature_finding_documentation_over_counts/index.html", signatureCopy);
}

for (const impactCopy of [
  "Proof of infrastructure",
  "How To Inspect This Work",
  "Documentation, Not Prevalence",
  "Claims Not Made",
  "rankings, safety scores, or prevalence claims"
]) {
  await mustContain("impact/index.html", impactCopy);
}

for (const updatesCopy of [
  "Public product updates",
  "What This Page Tracks",
  "Product consistency",
  "Recent Product Work",
  "data/changelog.json",
  "release notes",
  "Impact page"
]) {
  await mustContain("updates/index.html", updatesCopy);
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
  "docs/partner-acknowledgment-policy.md",
  "Impact page",
  "impact summary"
]) {
  await mustContain("trust/index.html", trustCopy);
}

for (const pressCopy of [
  "Press / Research Brief",
  "What Campus Evidence Lab Is",
  "What It Is Not",
  "Current Public Scale",
  "Why Public-Source Evidence Infrastructure Matters",
  "Press and research contact",
  "maxkornstein04@gmail.com"
]) {
  await mustContain("press/index.html", pressCopy);
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

for (const reviewerBriefCopy of [
  "Reviewer Brief",
  "A small ask for outside critique",
  "Three Review Questions",
  "Suggested 10-Record Sample",
  "Acknowledgment Boundary",
  "docs/reviewer-brief.md"
]) {
  await mustContain("reviewer-brief/index.html", reviewerBriefCopy);
}

for (const journalistGuideCopy of [
  "Journalist Use Guide",
  "Who This Is For",
  "How To Use The Archive",
  "Before Publication Checklist",
  "Common Mistakes To Avoid",
  "docs/citation.md",
  "maxkornstein04@gmail.com"
]) {
  await mustContain("journalist-guide/index.html", journalistGuideCopy);
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

for (const workspaceCopy of [
  "Research Workspace",
  "Build a reporting packet from selected public records",
  "methodology note",
  "Nothing is submitted or stored"
]) {
  await mustContain("research-workspace/index.html", workspaceCopy);
}

for (const reviewerQueueCopy of [
  "Reviewer Queue",
  "Find the records most worth reviewing next",
  "low-confidence records",
  "source-audit follow-ups",
  "not danger or school quality"
]) {
  await mustContain("reviewer-queue/index.html", reviewerQueueCopy);
}

for (const eventsCopy of ["source type", "date range", "verification", "sort", "Apply Search"]) {
  await mustContain("events/index.html", eventsCopy);
}
for (const eventsDownload of ["data/events.json", "data/events.csv", "data/events-research.json", "data/events-research.csv", "Filter URLs are shareable"]) {
  await mustContain("events/index.html", eventsDownload);
}

for (const schoolsCopy of ["Search schools", "filter by state", "most recent update"]) {
  await mustContain("schools/index.html", schoolsCopy);
}

for (const schoolDossierCopy of [
  "University of Kentucky Dossier",
  "Build Citation Packet",
  "Dossier Review Needs",
  "Use limit",
  "does not rank the institution"
]) {
  await mustContain("schools/university_of_kentucky/index.html", schoolDossierCopy);
}

for (const schoolDossierFilterCopy of [
  "Filter this dossier",
  "Open Jewish records in Events",
  "Open antisemitism search in Events"
]) {
  await mustContain("schools/american_university/index.html", schoolDossierFilterCopy);
}

for (const sourcesCopy of ["Search sources", "filter by source type", "direct external source URLs", "audit downloads"]) {
  await mustContain("sources/index.html", sourcesCopy);
}

for (const importWaveCopy of [
  "Import Waves",
  "ed-campus-safety-wave-002",
  "ed-campus-safety-wave-003",
  "ed-campus-safety-wave-004",
  "ed-campus-safety-wave-005",
  "ed-campus-safety-wave-006",
  "Accepted",
  "not individual human certification"
]) {
  await mustContain("import-waves/index.html", importWaveCopy);
}

for (const importWaveDetailCopy of ["ED Campus Safety", "QA Gate Counts", "Quarantine Artifact", "Candidate Artifact", "Public Claim Limit"]) {
  for (const waveId of [
    "ed-campus-safety-wave-002",
    "ed-campus-safety-wave-003",
    "ed-campus-safety-wave-004",
    "ed-campus-safety-wave-005",
    "ed-campus-safety-wave-006"
  ]) {
    await mustContain(`import-waves/${waveId}/index.html`, importWaveDetailCopy);
  }
}

await mustContain(
  "sources/src_ed_campus_safety_2025_hate_crime_data_files/index.html",
  "https://ope.ed.gov/campussafety/api/dataFiles/file?fileName=Crime2025EXCEL.zip"
);
await mustNotContain("sources/src_ed_campus_safety_2025_hate_crime_data_files/index.html", "https://ope.ed.gov/campussafety/#/datafile/list");

for (const aboutCopy of [
  "Mission",
  "Founder Note",
  "Why This Starts Narrow",
  "Open-Source Commitment",
  "Contact and Contributions",
  "submit/",
  "methodology/",
  "impact/",
  "updates/",
  "trust/",
  "acknowledgments/",
  "guide/",
  "research-guide/",
  "downloads/"
]) {
  await mustContain("about/index.html", aboutCopy);
}

await mustContain("trust/index.html", "../updates/");
await mustContain("impact/index.html", "../updates/");
await mustContain("downloads/index.html", "../data/product-updates.json");
await mustContain("downloads/index.html", "../data/import-manifests.json");
await mustContain("downloads/index.html", "../updates/");

for (const policyHubCopy of [
  "Policies",
  "Terms Of Use",
  "Privacy Policy",
  "Data License Addendum",
  "Submission Terms",
  "Corrections And Right-Of-Reply Policy",
  "Responsible Use Policy",
  "AI Use Disclosure",
  "Takedown And Redaction Policy",
  "Reviewer Agreement"
]) {
  await mustContain("policies/index.html", policyHubCopy);
}

for (const [policyPath, policyCopy] of [
  ["policies/terms-of-use/index.html", "Acceptance of Terms"],
  ["policies/privacy-policy/index.html", "About Campus Evidence Lab"],
  ["policies/data-license-addendum/index.html", "Purpose and Relationship to DATA_LICENSE.md"],
  ["policies/submission-terms/index.html", "Public-Source-Only Submissions"],
  ["policies/corrections-and-right-of-reply-policy/index.html", "Purpose"],
  ["policies/responsible-use-policy/index.html", "Purpose and Scope"],
  ["policies/ai-use-disclosure/index.html", "Permitted AI Assistance"],
  ["policies/takedown-and-redaction-policy/index.html", "Purpose"],
  ["policies/reviewer-agreement/index.html", "Purpose and Scope"]
]) {
  await mustContain(policyPath, policyCopy);
  await mustContain(policyPath, "Policy Library");
  await mustNotContain(policyPath, "Draft policy");
  await mustNotContain(policyPath, "Draft Policy");
  await mustNotContain(policyPath, "This draft");
  await mustNotContain(policyPath, "this draft");
}

for (const eventResponseCopy of [
  "Public institutional response",
  "Brown said it agreed to continue nondiscrimination training",
  "Response date"
]) {
  await mustContain("events/evt_2024_0001/index.html", eventResponseCopy);
}

await mustNotContain("events/evt_2026_0712/index.html", "Public institutional response");
await mustNotContain("events/evt_2026_0712/index.html", "<dt>Institutional response</dt>");
await mustNotContain("schools/brown_university/index.html", "does not independently evaluate investigative, disciplinary, or institutional response outcomes.");

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
  "Product updates JSON",
  "Schools dataset",
  "Source index",
  "Weekly snapshot downloads",
  "Snapshot manifest",
  "CLE Protocol page",
  "Snapshot registry contract",
  "Dataset license",
  "Changelog",
  "Public product updates page",
  "Release notes",
  "Robustness metrics",
  "Evidence-depth queues",
  "Gold record candidates",
  "Reviewer challenge pack",
  "Challenge standards",
  "Challenge queues and packets",
  "Challenge ledger",
  "Adversarial review challenge arena",
  "Evidence robustness dashboard",
  "Evidence capsules",
  "Source provenance queues",
  "Evidence provenance page",
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
  "Evidence Depth & Robustness",
  "/data/robustness-metrics.json",
  "/data/evidence-depth-queues.json",
  "/data/evidence-capsules.json",
  "/data/source-provenance-queues.json",
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
for (const column of ["school_name", "school_state", "source_titles", "source_publishers", "source_urls", "response_depth"]) {
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

const eventPagesWithChallengeLinks = new Set();
for (const event of events) {
  const detailPath = `events/${event.id}/index.html`;
  await mustExist(detailPath);
  const detailHtml = await readFile(path.join(siteRoot, detailPath), "utf8");
  const challengeHrefs = challengeRecordHrefs(detailHtml);
  if (challengeHrefs.length) {
    eventPagesWithChallengeLinks.add(event.id);
  }
  for (const href of challengeHrefs) {
    const expectedHref = `../../challenge/?packet=${event.id}`;
    if (href !== expectedHref) {
      errors.push(`${detailPath} Challenge this record href is ${href || "missing"}; expected ${expectedHref}`);
    }
  }
  await mustContain(detailPath, event.record_hash);
  for (const eventCopy of [
    "External source URL",
    "Request a source-backed correction",
    `submit/?record_id=${event.id}`,
    "Last updated",
    "Verification rationale",
    "Changelog"
  ]) {
    await mustContain(detailPath, eventCopy);
  }
  const responseProfile = responseDisplayProfile(event);
  if (responseProfile.shouldShow) {
    await mustContain(detailPath, responseProfile.heading);
    if (event.response_date) await mustContain(detailPath, "Response date");
  } else {
    await mustNotContain(detailPath, "Public institutional response");
    await mustNotContain(detailPath, "Public response note");
  }
  for (const sourceId of event.source_ids) {
    const source = sources.find((item) => item.id === sourceId);
    if (source) await mustContain(detailPath, source.url);
  }
}

const challengeQueues = await readSiteJson(path.join(siteRoot, "data", "challenge-queues.json"));
const packetEventIds = new Set((challengeQueues.packets ?? []).map((packet) => packet.event_id));
for (const queue of challengeQueues.queues ?? []) {
  for (const record of queue.records ?? []) {
    const expectedPacketUrl = `/challenge/?packet=${record.event_id}`;
    if (record.packet_url && !packetEventIds.has(record.event_id)) {
      errors.push(`Challenge queue ${queue.id} links missing packet for ${record.event_id}`);
    }
    if (record.packet_url && record.packet_url !== expectedPacketUrl) {
      errors.push(`Challenge queue ${queue.id} packet_url for ${record.event_id} is ${record.packet_url}; expected ${expectedPacketUrl}`);
    }
  }
}
const missingChallengeLinks = [...packetEventIds].filter((eventId) => !eventPagesWithChallengeLinks.has(eventId)).sort();
const extraChallengeLinks = [...eventPagesWithChallengeLinks].filter((eventId) => !packetEventIds.has(eventId)).sort();
if (missingChallengeLinks.length || extraChallengeLinks.length) {
  errors.push(
    `Challenge packet event links mismatch: missing links for ${missingChallengeLinks.join(", ") || "none"}; unexpected links for ${extraChallengeLinks.join(", ") || "none"}`
  );
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
for (const policyUrl of [
  "/policies/",
  "/policies/terms-of-use/",
  "/policies/privacy-policy/",
  "/policies/data-license-addendum/",
  "/policies/submission-terms/",
  "/policies/corrections-and-right-of-reply-policy/",
  "/policies/responsible-use-policy/",
  "/policies/ai-use-disclosure/",
  "/policies/takedown-and-redaction-policy/",
  "/policies/reviewer-agreement/",
  "/protocol/"
]) {
  if (!sitemap.includes(policyUrl)) {
    errors.push(`Sitemap missing ${policyUrl}`);
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
