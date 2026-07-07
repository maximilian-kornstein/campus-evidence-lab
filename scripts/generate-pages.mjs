import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAuditProfile } from "../assets/audit-profile.js";
import { hasSubstantiveInstitutionalResponse, responseDepthDisplayProfile, responseDisplayProfile } from "../assets/record-display.js";
import { paths, readJson, rootDir } from "./lib.mjs";
import { ED_CERTIFICATION_REVIEW_SPECS } from "./ed-certification-review-registry.mjs";
import { sourceFamilyForRecord } from "./import-manifest-lib.mjs";
import { reviewTierLabel, reviewTierLimit } from "./review-tier-model-lib.mjs";

const [
  events,
  schools,
  sources,
  briefs,
  manifest,
  challengeQueues,
  reviewDebtLedger,
  externalReviewPacket,
  certificationLedger,
  sourceFamilyCertificationReview001,
  edDatasetProvenanceAudit,
  certificationBatches,
  institutionImportWaveSummary,
  accountabilitySignals,
  ...edCertificationReviews
] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs),
  readJson(paths.manifest),
  readJson(paths.challengeQueues),
  readJson(paths.reviewDebtLedger),
  readJson(paths.externalReviewPacket),
  readJson(paths.certificationLedger),
  readJson(paths.sourceFamilyCertificationReview001),
  readJson(paths.edDatasetProvenanceAudit),
  readJson(paths.certificationBatches),
  readJson(paths.institutionImportWaveSummary),
  readJson(paths.accountabilitySignals),
  ...ED_CERTIFICATION_REVIEW_SPECS.map((spec) => readJson(paths[spec.dataPathKey]))
]);

const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
const accountabilitySignalsBySchool = new Map((accountabilitySignals.institutions ?? []).map((row) => [row.school_id, row]));
const challengePacketEventIds = new Set((challengeQueues.packets ?? []).map((packet) => packet.event_id));
const eventsDir = path.join(rootDir, "events");
const schoolsDir = path.join(rootDir, "schools");
const briefsDir = path.join(rootDir, "briefs");
const sourcesDir = path.join(rootDir, "sources");
const reviewDebtDir = path.join(rootDir, "review-debt");
const externalReviewDir = path.join(rootDir, "external-review");
const knownLimitsDir = path.join(rootDir, "known-limits");
const certificationDir = path.join(rootDir, "certification");
const sourceFamilyReview001Dir = path.join(rootDir, "source-family-certification-review-001");
const edProvenanceDir = path.join(rootDir, "ed-provenance");
const certificationBatchesDir = path.join(rootDir, "certification-batches");
const importWavePagesDir = path.join(rootDir, "import-waves");
const accountabilityRoomDir = path.join(rootDir, "accountability-room");
const proofDir = path.join(rootDir, "proof");
const policiesDir = path.join(rootDir, "policies");
const protocolDir = path.join(rootDir, "protocol");
const detailDepth = 2;

const POLICY_DOCUMENTS = [
  {
    slug: "terms-of-use",
    title: "Terms Of Use",
    sourcePath: "docs/policies/terms-of-use.md",
    summary: "Access, permitted use, prohibited misuse, submissions, warranties, and liability boundaries."
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    sourcePath: "docs/policies/privacy-policy.md",
    summary: "How public site visits, GitHub activity, submissions, contact, AI assistance, retention, and removal limits are handled."
  },
  {
    slug: "data-license-addendum",
    title: "Data License Addendum",
    sourcePath: "docs/policies/data-license-addendum.md",
    summary: "Dataset reuse, attribution, source-level limits, metadata preservation, corrections, and warranty boundaries."
  },
  {
    slug: "submission-terms",
    title: "Submission Terms",
    sourcePath: "docs/policies/submission-terms.md",
    summary: "Public-source-only submission rules for sources, corrections, duplicates, school metadata, and reviewer notes."
  },
  {
    slug: "corrections-and-right-of-reply-policy",
    title: "Corrections And Right-Of-Reply Policy",
    sourcePath: "docs/policies/corrections-and-right-of-reply-policy.md",
    summary: "How corrections, institutional replies, redactions, takedowns, and public rationales are handled."
  },
  {
    slug: "responsible-use-policy",
    title: "Responsible Use Policy",
    sourcePath: "docs/policies/responsible-use-policy.md",
    summary: "Appropriate and inappropriate uses, source review, review-tier interpretation, citation, and claim phrasing."
  },
  {
    slug: "ai-use-disclosure",
    title: "AI Use Disclosure",
    sourcePath: "docs/policies/ai-use-disclosure.md",
    summary: "Where AI may assist, where it may not, and how human review, auditability, and correction handling apply."
  },
  {
    slug: "takedown-and-redaction-policy",
    title: "Takedown And Redaction Policy",
    sourcePath: "docs/policies/takedown-and-redaction-policy.md",
    summary: "Redaction, takedown, safety, privacy, source-removal, copyright, and public-history limits."
  },
  {
    slug: "reviewer-agreement",
    title: "Reviewer Agreement",
    sourcePath: "docs/policies/reviewer-agreement.md",
    summary: "Reviewer scope, neutrality, conflicts, source checks, review tiers, AI assistance, and documentation expectations."
  }
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  const tokens = [];
  const escaped = escapeHtml(value).replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@CODE${tokens.length}@@`;
    tokens.push(`<code>${code}</code>`);
    return token;
  });
  const emphasized = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return tokens.reduce((html, tokenValue, index) => html.replaceAll(`@@CODE${index}@@`, tokenValue), emphasized);
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const html = [];
  const paragraph = [];
  let listType = null;
  let listItems = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph.length = 0;
  }

  function flushList() {
    if (!listType) return;
    html.push(`<${listType}>${listItems.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</${listType}>`);
    listType = null;
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = Math.min(heading[1].length, 3);
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(unordered[1]);
      continue;
    }

    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(ordered[1]);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return html.join("\n");
}

function sitePath(target, depth = 0) {
  if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(target)) return target;

  const prefix = "../".repeat(depth);
  const cleanTarget = String(target).replace(/^\/+/, "");
  return cleanTarget ? `${prefix}${cleanTarget}` : prefix || "./";
}

function nav(depth = 0) {
  return `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="${sitePath("/", depth)}">
          <span class="brand__name">Campus Evidence Lab</span>
          <span class="brand__tag">Public evidence infrastructure</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a href="${sitePath("/", depth)}">Dashboard</a>
          <a href="${sitePath("/accountability-room/", depth)}">Accountability</a>
          <a href="${sitePath("/proof/", depth)}">Proof</a>
          <a href="${sitePath("/events/", depth)}">Events</a>
          <a href="${sitePath("/schools/", depth)}">Schools</a>
          <a href="${sitePath("/briefs/", depth)}">Briefs</a>
          <a href="${sitePath("/sources/", depth)}">Sources</a>
          <a href="${sitePath("/quality/", depth)}">Quality</a>
          <a href="${sitePath("/review-debt/", depth)}">Review Debt</a>
          <a href="${sitePath("/certification/", depth)}">Certification</a>
          <a href="${sitePath("/certification-batches/", depth)}">Batches</a>
          <a href="${sitePath("/ed-certification-batch-001/", depth)}">ED Review</a>
          <a href="${sitePath("/external-review/", depth)}">External Review</a>
          <a href="${sitePath("/methodology/", depth)}">Methodology</a>
          <a href="${sitePath("/impact/", depth)}">Impact</a>
          <a href="${sitePath("/guide/", depth)}">Guide</a>
          <a href="${sitePath("/downloads/", depth)}">Data</a>
          <a href="${sitePath("/policies/", depth)}">Policies</a>
          <a href="${sitePath("/protocol/", depth)}">Protocol</a>
          <a href="${sitePath("/submit/", depth)}">Submit</a>
          <a href="${sitePath("/about/", depth)}">About</a>
          <a href="${sitePath("/license/", depth)}">License</a>
        </nav>
      </div>
    </header>
  `;
}

function policyLibraryLinks(currentSlug = "", depth = 1) {
  return `
    <nav class="policy-sidebar" aria-label="Policy Library">
      <h2>Policy Library</h2>
      <a${currentSlug ? "" : ' aria-current="page"'} href="${sitePath("/policies/", depth)}">Policy Library</a>
      ${POLICY_DOCUMENTS.map(
        (policy) =>
          `<a${policy.slug === currentSlug ? ' aria-current="page"' : ""} href="${sitePath(`/policies/${policy.slug}/`, depth)}">${escapeHtml(policy.title)}</a>`
      ).join("\n      ")}
    </nav>
  `;
}

function page(title, body, depth = 0, stripTrailingWhitespace = true) {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} / Campus Evidence Lab</title>
    <link rel="stylesheet" href="${sitePath("/assets/styles.css", depth)}">
  </head>
  <body>
    ${nav(depth)}
    <main class="main">
      ${body}
    </main>
    <footer class="site-footer">Campus Evidence Lab / Public-source records / Import-wave QA / Corrections and right-of-reply</footer>
  </body>
</html>
`;
  return stripTrailingWhitespace ? html.replace(/[ \t]+$/gm, "") : html;
}

function dataLine(label, value, className = "") {
  return `
    <div class="data-line">
      <dt>${escapeHtml(label)}</dt>
      <dd${className ? ` class="${className}"` : ""}>${value}</dd>
    </div>
  `;
}

function edReviewLabel(spec) {
  return spec.pageKicker.replace(/^Applied /, "").replace(/ review$/, " review");
}

function edReviewDataLines(depth) {
  return ED_CERTIFICATION_REVIEW_SPECS.map((spec) =>
    dataLine(edReviewLabel(spec), `<a href="${sitePath(spec.route, depth)}">Open applied review</a>`)
  ).join("");
}

function sourceFamilyReviewDataLines(depth) {
  return dataLine("Source-family review 001", `<a href="${sitePath("/source-family-certification-review-001/", depth)}">Open pilot review</a>`);
}

function edReviewPageIntro(spec) {
  const match = spec.pageKicker.match(/Batch (\d+)/);
  const ordinal =
    match?.[1] === "001"
      ? "first"
      : match?.[1] === "002"
        ? "second"
        : match?.[1] === "003"
          ? "third"
          : match?.[1] === "004"
            ? "fourth"
            : "named";
  return `This page shows the ${ordinal} bounded internal review wave for ED Campus Safety dataset records. It freezes its own reviewed set, keeps unresolved gates visible, and does not imply that all database records are manually certified.`;
}

function auditFieldSupportRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.field)}</td>
          <td>${escapeHtml(row.sourceTitles.length ? row.sourceTitles.join(", ") : row.sourceIds.join(", "))}</td>
          <td>${escapeHtml(row.rationale)}</td>
        </tr>
      `
    )
    .join("");
}

function auditSourceLocatorRows(rows) {
  return rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.locatorType)}</td>
          <td>${escapeHtml(row.sourceTitle || row.sourceId)}</td>
          <td>${escapeHtml(row.locator)}</td>
        </tr>
      `
    )
    .join("");
}

function recordAuditCard(event, sources) {
  const profile = buildAuditProfile(event, sources);
  return `
    <section class="section section--tight record-audit-card">
      <div class="section-header">
        <h2 class="section-title">Record Audit</h2>
        <p class="section-note">Source basis and classification review</p>
      </div>
      <dl>
        ${dataLine("Source basis", escapeHtml(profile.sourceBasis))}
        ${dataLine("Classification rationale", escapeHtml(profile.classificationRationale))}
        ${dataLine("Community rationale", escapeHtml(profile.communityRationale))}
        ${dataLine("Confidence rationale", escapeHtml(profile.confidenceRationale))}
      </dl>
      <div class="table-wrap table-wrap--compact">
        <table>
          <thead>
            <tr>
              <th>Field</th>
              <th>Source support</th>
              <th>Review note</th>
            </tr>
          </thead>
          <tbody>${auditFieldSupportRows(profile.fieldSupport)}</tbody>
        </table>
      </div>
      ${
        profile.sourceLocators.length
          ? `
            <h3 class="section-title section-title--spaced">Source Locators</h3>
            <div class="table-wrap table-wrap--compact">
              <table>
                <thead>
                  <tr>
                    <th>Locator type</th>
                    <th>Source</th>
                    <th>Locator</th>
                  </tr>
                </thead>
                <tbody>${auditSourceLocatorRows(profile.sourceLocators)}</tbody>
              </table>
            </div>
          `
          : ""
      }
      <h3 class="section-title section-title--spaced">Use Limits</h3>
      <ul class="evidence-list">
        ${profile.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function countBy(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function countTable(rows, firstLabel, secondLabel = "Records") {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>${escapeHtml(firstLabel)}</th>
            <th>${escapeHtml(secondLabel)}</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([label, count]) => `
                <tr>
                  <td>${escapeHtml(label)}</td>
                  <td>${count}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function hasDisplayInstitutionalResponse(event) {
  return hasSubstantiveInstitutionalResponse(event);
}

function institutionalResponseSection(event) {
  const profile = responseDisplayProfile(event);
  if (!profile.shouldShow) return "";
  const responseDepth = responseDepthDisplayProfile(event);
  const details = [
    dataLine("Response depth", escapeHtml(responseDepth.label)),
    event.response_date ? dataLine("Response date", escapeHtml(event.response_date), "mono") : "",
    event.legal_status ? dataLine("Legal status", escapeHtml(event.legal_status)) : ""
  ]
    .filter(Boolean)
    .join("");
  return `
    <h2 class="section-title section-title--spaced">${escapeHtml(profile.heading)}</h2>
    <p>${escapeHtml(profile.response)}</p>
    ${details ? `<dl>${details}</dl>` : ""}
  `;
}

function reviewNeedLabels(event) {
  const labels = [];
  if (event.confidence === "Low") labels.push("Low-confidence source support");
  if ((event.source_ids?.length ?? 0) <= 1) labels.push("Single-source record");
  if (!hasDisplayInstitutionalResponse(event)) labels.push("No public institutional response recorded");
  if (event.affected_communities.some((community) => ["Race", "Religion", "National origin", "Ethnicity", "Gender"].includes(community))) {
    labels.push("Broad affected-community label");
  }
  if (/ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(`${event.category} ${event.legal_status}`)) {
    labels.push("Legal/OCR status review");
  }
  return labels;
}

function workspaceUrlForEvents(records, depth = 0) {
  const ids = records.slice(0, 100).map((event) => event.id).join(",");
  return sitePath(ids ? `/research-workspace/?record_ids=${encodeURIComponent(ids)}` : "/research-workspace/", depth);
}

function workspaceUrlForEventsWithQuestion(records, title, question, depth = 0) {
  if (!records.length) return "";
  const params = new URLSearchParams();
  params.set("record_ids", records.slice(0, 100).map((event) => event.id).join(","));
  params.set("title", title);
  params.set("question", question);
  return sitePath(`/research-workspace/?${params.toString()}`, depth);
}

function briefRecordTable(records, emptyText) {
  if (!records.length) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>School</th>
            <th>Category</th>
            <th>Record</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map((event) => {
              const school = schoolMap.get(event.school_id);
              return `
                <tr>
                  <td class="mono">${escapeHtml(event.date)}</td>
                  <td>${escapeHtml(school?.name ?? event.school_id)}</td>
                  <td>${escapeHtml(event.category)}</td>
                  <td><a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(event.summary)}</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function briefResponseList(records) {
  const responseRecords = records.filter(hasDisplayInstitutionalResponse);
  if (!responseRecords.length) return `<p class="empty">No institutional responses recorded in this brief.</p>`;
  return `
    <ul class="source-list">
      ${responseRecords
        .map((event) => {
          const school = schoolMap.get(event.school_id);
          const response = String(event.institutional_response ?? "").trim();
          return `
            <li>
              <a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(school?.name ?? event.school_id)}</a>
              <br><span>${escapeHtml(response)}</span>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

function briefLegalUpdates(records) {
  const legalRecords = records.filter((event) => /ocr|legal|lawsuit|resolution|title vi|title ix/i.test(`${event.category} ${event.legal_status}`));
  return briefRecordTable(legalRecords, "No legal or OCR updates recorded in this brief.");
}

function briefListSection(title, items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <h2 class="section-title section-title--spaced">${escapeHtml(title)}</h2>
    <ul class="evidence-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function objectCountRows(counts) {
  return Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString("en-US");
}

async function readJsonFilesFromDir(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => readJson(path.join(dir, entry.name)))
    );
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function sourceFamilyLabel(sourceFamily) {
  if (sourceFamily === "ed_campus_safety_dataset") return "ED Campus Safety";
  if (sourceFamily === "ocr_open_investigation") return "OCR Open Investigation";
  return String(sourceFamily ?? "Unknown source family")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function recordLaneLabel(recordLane) {
  if (recordLane === "aggregate_safety_stat") return "Aggregate safety stat";
  if (recordLane === "civil_rights_case") return "Civil rights case";
  return String(recordLane ?? "Unknown lane")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function aggregateSubtypeLabel(subtype) {
  if (subtype === "reported_crime_stat") return "Reported crime stats";
  if (subtype === "vawa_stat") return "VAWA stats";
  if (subtype === "arrest_stat") return "Arrest stats";
  if (subtype === "disciplinary_referral_stat") return "Disciplinary referral stats";
  if (subtype === "not_applicable") return "Not applicable";
  return String(subtype ?? "Unknown subtype")
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function labeledCountRows(counts, labeler) {
  return objectCountRows(counts).map(([label, count]) => [labeler(label), count]);
}

function importSummaryForSchool(schoolId) {
  return (
    institutionImportWaveSummary.schools?.[schoolId] ?? {
      school_id: schoolId,
      accepted_candidate_count: 0,
      source_family_counts: {},
      record_lane_counts: {},
      aggregate_stat_subtype_counts: {},
      import_wave_ids: [],
      latest_record_year: ""
    }
  );
}

function renderAccountabilitySignalsPanel(signalRow, depth = 1) {
  if (!signalRow) return "";

  const signalItems = signalRow.signals?.length
    ? signalRow.signals
        .map(
          (signal) => `
            <li>
              <strong>${escapeHtml(signal.label)}</strong>
              <br><span class="section-note">${escapeHtml(signal.detail)}</span>
              ${Number.isFinite(signal.count) ? `<br><span class="mono">${escapeHtml(formatNumber(signal.count))}</span>` : ""}
            </li>
          `
        )
        .join("")
    : `<li>No generated signal rows are available for this institution in the current snapshot.</li>`;
  const sourceFamilyRows = labeledCountRows(signalRow.source_family_counts ?? {}, sourceFamilyLabel);
  const laneRows = labeledCountRows(signalRow.record_lane_counts ?? {}, recordLaneLabel);
  const apiPath = signalRow.routes?.api ?? `/api/v1/institutions/${encodeURIComponent(signalRow.school_id)}.json`;
  const citationPath = signalRow.routes?.citation_packet ?? `/api/v1/citation-packets/${encodeURIComponent(signalRow.school_id)}.json`;
  const correctionPath = signalRow.routes?.correction ?? "/submit/";

  return `
    <section class="section section--tight briefing-shell" aria-label="Accountability Signals">
      <div class="section-header">
        <h2 class="section-title">Accountability Signals</h2>
        <p class="section-note">Machine-readable institution posture for the current public snapshot</p>
      </div>
      <p>Accountability Signals describe source basis, response evidence, correction posture, and unresolved limits. They are not rankings, safety scores, severity scores, prevalence estimates, or legal findings.</p>
      <div class="briefing-columns">
        <div>
          <ul class="evidence-list">
            ${signalItems}
          </ul>
          <div class="utility-bar">
            <a class="button-link" href="${sitePath(apiPath, depth)}">Open Institution API</a>
            <a class="button-link" href="${sitePath(citationPath, depth)}">Open Citation Packet</a>
            <a class="button-link" href="${sitePath(correctionPath, depth)}">Correction / Right of Reply</a>
          </div>
        </div>
        <aside class="briefing-callout">
          <h3 class="section-title">Signal Basis</h3>
          ${sourceFamilyRows.length ? countTable(sourceFamilyRows, "Source Family", "Rows") : `<p class="empty">No accepted source-family rows are linked in the signal artifact.</p>`}
          ${laneRows.length ? countTable(laneRows, "Record Lane", "Rows") : ""}
          <h3 class="section-title section-title--spaced">Public Use Limits</h3>
          <ul class="evidence-list">
            ${(signalRow.public_use_limits ?? []).map((limit) => `<li>${escapeHtml(limit)}</li>`).join("")}
          </ul>
        </aside>
      </div>
    </section>
  `;
}

function importWaveRows(importWaves, depth = 1) {
  if (!importWaves.length) return `<p class="empty">No import waves have been generated.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Wave</th>
            <th>Source family</th>
            <th>Status</th>
            <th>Attempted</th>
            <th>Accepted</th>
            <th>Quarantined</th>
          </tr>
        </thead>
        <tbody>
          ${importWaves
            .map(
              (wave) => `
                <tr>
                  <td><a href="${sitePath(`/import-waves/${encodeURIComponent(wave.id)}/`, depth)}">${escapeHtml(wave.id)}</a></td>
                  <td>${escapeHtml(sourceFamilyLabel(wave.source_family))}</td>
                  <td>${escapeHtml(wave.status)}</td>
                  <td>${escapeHtml(wave.attempted_count)}</td>
                  <td>${escapeHtml(wave.accepted_count)}</td>
                  <td>${escapeHtml(wave.quarantined_count)}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function importWaveSampleRows(wave) {
  if (!wave.sample_record_ids?.length) return `<p class="empty">No sample candidate IDs recorded for this wave.</p>`;
  return `
    <div class="table-wrap table-wrap--compact">
      <table>
        <thead>
          <tr>
            <th>Sample candidate ID</th>
          </tr>
        </thead>
        <tbody>
          ${wave.sample_record_ids.map((candidateId) => `<tr><td class="mono">${escapeHtml(candidateId)}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function ledgerRecordTable(records, depth = 1) {
  if (!records.length) return `<p class="empty">No records in this queue.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>School</th>
            <th>Family</th>
            <th>Debt status</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td><a href="${sitePath(record.event_url, depth)}">${escapeHtml(record.event_id)}</a></td>
                  <td>${escapeHtml(record.school_id)}</td>
                  <td>${escapeHtml(record.source_family)}</td>
                  <td>${escapeHtml(record.debt_status)}</td>
                  <td>${escapeHtml((record.issue_ids ?? []).join(", ") || "No deterministic issue")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function externalReviewRecordTable(records, depth = 1) {
  if (!records.length) return `<p class="empty">No records in this packet.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>School</th>
            <th>Source family</th>
            <th>Gold status</th>
            <th>Review links</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td><a href="${sitePath(record.event_url, depth)}">${escapeHtml(record.event_id)}</a></td>
                  <td>${escapeHtml(record.school_id)}</td>
                  <td>${escapeHtml(record.source_family)}</td>
                  <td>${escapeHtml(record.gold_v1_certification_status)}</td>
                  <td><a href="${sitePath(record.workspace_url, depth)}">Workspace</a> / <a href="${sitePath(record.challenge_url, depth)}">Challenge</a></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function certificationRecordTable(records, depth = 1) {
  if (!records.length) return `<p class="empty">No records in this set.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>School</th>
            <th>Family</th>
            <th>Status</th>
            <th>Open gates</th>
            <th>Next action</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td><a href="${sitePath(record.event_url, depth)}">${escapeHtml(record.event_id)}</a></td>
                  <td>${escapeHtml(record.school_id)}</td>
                  <td>${escapeHtml(record.source_family ?? "ed_campus_safety_dataset")}</td>
                  <td>${escapeHtml(record.certification_status)}</td>
                  <td>${escapeHtml((record.open_gates ?? []).join(", ") || "None")}</td>
                  <td>${escapeHtml(record.next_action ?? "Review listed gates.")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function edBatchReviewRecordTable(records, depth = 1) {
  if (!records.length) return `<p class="empty">No records in this set.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>School</th>
            <th>Status</th>
            <th>Locator</th>
            <th>Open gates</th>
            <th>Reason / next action</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td><a href="${sitePath(record.event_url, depth)}">${escapeHtml(record.event_id)}</a></td>
                  <td>${escapeHtml(record.school_id)}</td>
                  <td>${escapeHtml(record.certification_status)}</td>
                  <td>${escapeHtml(record.source_locator?.cell ?? record.provenance_status ?? "unresolved")}</td>
                  <td>${escapeHtml((record.open_gates ?? []).join(", ") || "None")}</td>
                  <td>${escapeHtml(record.blocked_reason ?? record.not_certified_reason ?? record.next_action ?? "Review listed gates.")}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function verificationRationale(event, sourceCount) {
  return `${event.verification_status}; ${sourceCount} public source${sourceCount === 1 ? "" : "s"} linked (${event.source_types.join(", ")}). Confidence reflects source support, not severity.`;
}

await mkdir(policiesDir, { recursive: true });
for (const entry of await readdir(policiesDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    await rm(path.join(policiesDir, entry.name), { recursive: true, force: true });
  }
}

await writeFile(
  path.join(policiesDir, "index.html"),
  page(
    "Policies",
    `
      <p class="page-kicker">Policies</p>
      <h1 class="page-title page-title--small">Rules for using, correcting, reviewing, and reusing the archive.</h1>
      <p class="page-intro">These documents define the boundaries around Campus Evidence Lab's public-source records, review tiers, submissions, corrections, AI assistance, takedown process, and dataset reuse.</p>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Policy Library</h2>
          <p class="section-note">Public operating terms for Campus Evidence Lab</p>
        </div>
        <div class="policy-grid">
          ${POLICY_DOCUMENTS.map(
            (policy) => `
              <a class="policy-card" href="${sitePath(`/policies/${policy.slug}/`, 1)}">
                <span>${escapeHtml(policy.title)}</span>
                <span>${escapeHtml(policy.summary)}</span>
              </a>
            `
          ).join("")}
        </div>
      </section>
    `,
    1
  )
);

for (const policy of POLICY_DOCUMENTS) {
  const policyMarkdown = await readFile(path.join(rootDir, policy.sourcePath), "utf8");
  const policyBody = policyMarkdown.replace(/^# .+\n+/, "");
  const policyDir = path.join(policiesDir, policy.slug);
  await mkdir(policyDir, { recursive: true });
  await writeFile(
    path.join(policyDir, "index.html"),
    page(
      policy.title,
      `
        <p class="page-kicker">Policy Library</p>
        <h1 class="page-title page-title--small">${escapeHtml(policy.title)}</h1>
        <p class="page-intro">${escapeHtml(policy.summary)}</p>
        <section class="detail-panel policy-layout">
          <div class="prose policy-prose">
            ${renderMarkdown(policyBody)}
          </div>
          <aside>
            ${policyLibraryLinks(policy.slug, detailDepth)}
          </aside>
        </section>
      `,
      detailDepth
    )
  );
}

const importWaveReports = (await readJsonFilesFromDir(paths.importWavesDir)).sort((a, b) => b.generated_at.localeCompare(a.generated_at) || b.id.localeCompare(a.id));
const importQuarantineByWaveId = new Map((await readJsonFilesFromDir(paths.importQuarantineDir)).map((artifact) => [artifact.wave_id ?? artifact.id, artifact]));

const accountabilityInstitutionRows = schools
  .map((school) => {
    const schoolEvents = events.filter((event) => event.school_id === school.id);
    const summary = importSummaryForSchool(school.id);
    return {
      school,
      eventCount: schoolEvents.length,
      acceptedCandidateCount: summary.accepted_candidate_count,
      sourceFamilies: Object.keys(summary.source_family_counts).map(sourceFamilyLabel)
    };
  })
  .sort((a, b) => b.eventCount - a.eventCount || b.acceptedCandidateCount - a.acceptedCandidateCount || a.school.name.localeCompare(b.school.name))
  .slice(0, 40);

await mkdir(accountabilityRoomDir, { recursive: true });
await writeFile(
  path.join(accountabilityRoomDir, "index.html"),
  page(
    "Accountability Room",
    `
      <p class="page-kicker">Institution accountability briefings</p>
      <h1 class="page-title page-title--small">Accountability Room</h1>
      <p class="page-intro">Open an institution briefing across ${formatNumber(schools.length)} generated institution pages that separates 4,000 public event records from ${formatNumber(institutionImportWaveSummary.accepted_candidate_count)} accepted import-wave QA candidates. The room shows source basis, limits, response evidence, and correction paths without turning records into institutional scores.</p>
      <p class="limit-line">No rankings. No safety scores. No legal findings.</p>
      <div class="hero-actions accountability-actions" aria-label="Accountability Room actions">
        <a class="button-link button-link--primary" href="${sitePath("/schools/", 1)}">Open an Institution</a>
        <a class="button-link" href="${sitePath("/import-waves/", 1)}">Inspect Import Waves</a>
        <a class="button-link" href="${sitePath("/methodology/", 1)}">Review Methodology</a>
        <a class="button-link" href="${sitePath("/submit/", 1)}">Correction / Right of Reply</a>
      </div>
      <section class="section section--tight briefing-shell" aria-label="Current accountability scope">
        <div class="briefing-grid">
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(events.length)}</span>
            <span class="metric__label">public event records</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(institutionImportWaveSummary.accepted_candidate_count)}</span>
            <span class="metric__label">accepted import-wave QA candidates</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(schools.length)}</span>
            <span class="metric__label">generated institution pages</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(institutionImportWaveSummary.source_family_counts.ed_campus_safety_dataset ?? 0)}</span>
            <span class="metric__label">ED Campus Safety rows</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(institutionImportWaveSummary.source_family_counts.ocr_open_investigation ?? 0)}</span>
            <span class="metric__label">OCR Open Investigation rows</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(institutionImportWaveSummary.institution_count)}</span>
            <span class="metric__label">institutions with accepted QA rows</span>
          </div>
        </div>
      </section>
      <section class="section section--tight briefing-columns">
        <div>
          <div class="section-header">
            <h2 class="section-title">Open an Institution</h2>
            <p class="section-note">Sorted by public event records, then accepted QA rows; this is not a ranking.</p>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Public event records</th>
                  <th>Accepted QA candidates</th>
                  <th>Source families</th>
                </tr>
              </thead>
              <tbody>
                ${accountabilityInstitutionRows
                  .map(
                    ({ school, eventCount, acceptedCandidateCount, sourceFamilies }) => `
                      <tr>
                        <td><a href="${sitePath(`/schools/${encodeURIComponent(school.id)}/`, 1)}">${escapeHtml(school.name)}</a><br><span class="section-note">${escapeHtml([school.city, school.state].filter(Boolean).join(", "))}</span></td>
                        <td>${formatNumber(eventCount)}</td>
                        <td>${formatNumber(acceptedCandidateCount)}</td>
                        <td>${escapeHtml(sourceFamilies.join(", ") || "No accepted import-wave rows")}</td>
                      </tr>
                    `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
        <aside class="briefing-callout">
          <h2 class="section-title">How To Read This Room</h2>
          <ul class="evidence-list">
            <li>Public event records are source-backed event pages with review-tier metadata.</li>
            <li>Accepted import-wave QA candidates are official-source rows that passed deterministic gates; acceptance is not individual human certification.</li>
            <li>Counts describe public documentation in the current snapshot, not campus safety, prevalence, severity, or legal responsibility.</li>
            <li>Correction and right-of-reply paths are part of the accountability surface.</li>
          </ul>
          <h2 class="section-title section-title--spaced">Source-Family Mix</h2>
          ${countTable(labeledCountRows(institutionImportWaveSummary.source_family_counts, sourceFamilyLabel), "Source Family", "Accepted QA Candidates")}
        </aside>
      </section>
    `,
    1
  )
);

const proofInstitution =
  accountabilitySignalsBySchool.get("brown_university") ??
  accountabilitySignals.institutions?.find((row) => row.public_event_count > 0 && row.accepted_candidate_count > 0) ??
  accountabilitySignals.institutions?.[0];

await rm(proofDir, { recursive: true, force: true });
await mkdir(proofDir, { recursive: true });
await writeFile(
  path.join(proofDir, "index.html"),
  page(
    "Proof Path",
    `
      <p class="page-kicker">Proof Path</p>
      <h1 class="page-title page-title--small">Public accountability infrastructure, not a ranking.</h1>
      <p class="page-intro">This path gives a reader the shortest route from public institution briefings to machine-readable evidence artifacts, import-wave QA reports, and local verification commands. Current public artifacts include ${formatNumber(accountabilitySignals.totals?.accepted_import_wave_qa_candidates ?? institutionImportWaveSummary.accepted_candidate_count)} accepted import-wave QA candidates and ${formatNumber(accountabilitySignals.totals?.public_event_records ?? events.length)} public event records.</p>
      <section class="section section--tight briefing-shell" aria-label="Current proof surface">
        <div class="briefing-grid">
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(accountabilitySignals.totals?.accepted_import_wave_qa_candidates ?? institutionImportWaveSummary.accepted_candidate_count)}</span>
            <span class="metric__label">accepted import-wave QA candidates</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(accountabilitySignals.totals?.public_event_records ?? events.length)}</span>
            <span class="metric__label">public event records</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(accountabilitySignals.totals?.institutions ?? schools.length)}</span>
            <span class="metric__label">institution briefing pages</span>
          </div>
          <div class="briefing-metric">
            <span class="metric__value">${formatNumber(importWaveReports.length)}</span>
            <span class="metric__label">frozen import-wave reports</span>
          </div>
        </div>
      </section>
      <section class="section section--tight briefing-columns">
        <div>
          <div class="section-header">
            <h2 class="section-title">Open These First</h2>
            <p class="section-note">A compact path through the public evidence system</p>
          </div>
          <ol class="evidence-list">
            <li><a href="${sitePath("/accountability-room/", 1)}">Accountability Room</a>: browse institution briefings with source basis, limits, and response paths.</li>
            <li><a href="${sitePath(proofInstitution?.routes?.school ?? "/schools/", 1)}">${escapeHtml(proofInstitution?.name ?? "Institution briefing")}</a>: inspect one institution-level briefing with Accountability Signals.</li>
            <li><a href="${sitePath("/import-waves/", 1)}">Import Waves</a>: inspect accepted, duplicate, excluded, and quarantined counts from official-source imports.</li>
            <li><a href="${sitePath("/api/v1/index.json", 1)}">api/v1/index.json</a>: open the public API index and discover institution endpoints, citation packets, source families, and snapshot metadata.</li>
            <li><a href="${sitePath("/submit/", 1)}">Correction / right of reply</a>: submit source-backed corrections, stronger locators, duplicate reports, or institution response evidence.</li>
          </ol>
        </div>
        <aside class="briefing-callout">
          <h2 class="section-title">Terminal Research Path</h2>
          <p>Researchers can run local checks against the same public artifacts without using a hosted model or private service.</p>
          <dl>
            ${dataLine("Institution command", `<code>npm run researcher:institution -- brown_university</code>`)}
            ${dataLine("Citation packet", `<code>npm run researcher:citation -- brown_university</code>`)}
            ${dataLine("API integrity check", `<code>npm run researcher:api-check</code>`)}
          </dl>
          <h2 class="section-title section-title--spaced">Reading Rule</h2>
          <p>This page proves the infrastructure path: source targeting, deterministic QA, public limits, correction intake, and machine-readable reuse.</p>
        </aside>
      </section>
    `,
    1
  )
);

await rm(importWavePagesDir, { recursive: true, force: true });
await mkdir(importWavePagesDir, { recursive: true });
await writeFile(
  path.join(importWavePagesDir, "index.html"),
  page(
    "Import Waves",
    `
      <p class="page-kicker">Import Waves</p>
      <h1 class="page-title page-title--small">Bulk publication is gated before it becomes public data.</h1>
      <p class="page-intro">Import waves are frozen QA reports for official public-source candidate records. Accepted means the deterministic gates passed for the source family and candidate fields; it is not individual human certification, institutional ranking, prevalence measurement, safety scoring, severity scoring, or a legal finding.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Wave Reports</h2>
            ${importWaveRows(importWaveReports, 1)}
          </div>
          <aside>
            <dl>
              ${dataLine("Waves", escapeHtml(importWaveReports.length))}
              ${dataLine("Accepted", escapeHtml(importWaveReports.reduce((sum, wave) => sum + wave.accepted_count, 0)))}
              ${dataLine("Quarantined", escapeHtml(importWaveReports.reduce((sum, wave) => sum + wave.quarantined_count, 0)))}
              ${dataLine("QA standard", `<a href="${sitePath("/docs/import-wave-qa-standard.md", 1)}">Open standard</a>`)}
              ${dataLine("Runbook", `<a href="${sitePath("/docs/import-wave-runbook.md", 1)}">Open runbook</a>`)}
              ${dataLine("Incident response", `<a href="${sitePath("/docs/publication-incident-response.md", 1)}">Open policy</a>`)}
            </dl>
          </aside>
        </div>
      </section>
    `,
    1
  )
);

for (const wave of importWaveReports) {
  const waveDir = path.join(importWavePagesDir, wave.id);
  const quarantine = importQuarantineByWaveId.get(wave.id);
  await mkdir(waveDir, { recursive: true });
  await writeFile(
    path.join(waveDir, "index.html"),
    page(
      `${wave.id} Import Wave`,
      `
        <p class="page-kicker">${escapeHtml(sourceFamilyLabel(wave.source_family))} Import Wave</p>
        <h1 class="page-title page-title--small">${escapeHtml(wave.id)}</h1>
        <p class="page-intro">${escapeHtml(sourceFamilyLabel(wave.source_family))} candidates passed through deterministic import-wave QA. Accepted rows cleared source-family eligibility, source locator, institution identity, duplicate, prohibited-field, and public-claim gates; acceptance is not individual human certification.</p>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              <h2 class="section-title">Wave Status</h2>
              <dl>
                ${dataLine("Status", escapeHtml(wave.status))}
                ${dataLine("Source family", escapeHtml(sourceFamilyLabel(wave.source_family)))}
                ${dataLine("Manifest", escapeHtml(wave.manifest_id), "mono")}
                ${dataLine("Generated", escapeHtml(wave.generated_at), "mono")}
                ${dataLine("Command", escapeHtml(wave.command), "mono")}
                ${dataLine("Dataset hash before", escapeHtml(wave.dataset_hash_before), "mono")}
                ${dataLine("Dataset hash after", escapeHtml(wave.dataset_hash_after), "mono")}
              </dl>
              <h2 class="section-title section-title--spaced">QA Gate Counts</h2>
              ${countTable(objectCountRows(wave.qa_gate_counts), "Gate", "Count")}
              <h2 class="section-title section-title--spaced">Sample Candidate IDs</h2>
              ${importWaveSampleRows(wave)}
            </div>
            <aside>
              <dl>
                ${dataLine("Attempted", escapeHtml(wave.attempted_count))}
                ${dataLine("Accepted", escapeHtml(wave.accepted_count))}
                ${dataLine("Duplicates", escapeHtml(wave.duplicate_count))}
                ${dataLine("Excluded", escapeHtml(wave.excluded_count))}
                ${dataLine("Quarantined", escapeHtml(wave.quarantined_count))}
                ${dataLine("Candidate Artifact", `<a href="${sitePath(`/data/import-candidates/${wave.id}.json`, detailDepth)}">Open JSON</a>`)}
                ${dataLine("Wave Artifact", `<a href="${sitePath(`/data/import-waves/${wave.id}.json`, detailDepth)}">Open JSON</a>`)}
                ${dataLine("Quarantine Artifact", `<a href="${sitePath(`/${wave.quarantine_artifact}`, detailDepth)}">Open JSON</a>`)}
              </dl>
            </aside>
          </div>
        </section>
        <section class="section section--tight">
          <div class="section-header">
            <h2 class="section-title">Quarantine Artifact</h2>
            <p class="section-note">Rows blocked from publication remain preserved for remediation</p>
          </div>
          ${
            quarantine?.rows?.length
              ? countTable(objectCountRows(quarantine.reason_counts), "Reason", "Rows")
              : `<p class="empty">No candidates were quarantined in this wave.</p>`
          }
        </section>
        <section class="section section--tight">
          <div class="section-header">
            <h2 class="section-title">Public Claim Limit</h2>
            <p class="section-note">How to read this wave</p>
          </div>
          <p>${escapeHtml(wave.public_claim_limit)}</p>
        </section>
      `,
      detailDepth
    )
  );
}

await mkdir(protocolDir, { recursive: true });
await writeFile(
  path.join(protocolDir, "index.html"),
  page(
    "CLE Protocol",
    `
      <p class="page-kicker">Protocol</p>
      <h1 class="page-title page-title--small">Local verification before public claims.</h1>
      <p class="page-intro">The CLE Protocol page explains how canonical data files, hashes, signed manifests, archived snapshots, local verification, and optional proof adapters fit together. It is a verification layer for the public archive, not a blockchain deployment claim.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Protocol Components</h2>
            <ul class="evidence-list">
              <li>Canonical JSON and CSV artifacts in <code>data/</code>.</li>
              <li>Record hashes and dataset hashes regenerated from the current source files.</li>
              <li>Snapshot manifests archived in <code>data/snapshots/</code>.</li>
              <li>Release verification artifacts that record the commands and limits for each public package.</li>
              <li>Optional smart-contract or external proof adapters can attest to a snapshot hash without changing the archive's source-of-truth files.</li>
            </ul>
            <h2 class="section-title section-title--spaced">Verification Commands</h2>
            <ul class="evidence-list">
              <li><code>npm run hash:data</code> regenerates record and snapshot hashes.</li>
              <li><code>node scripts/hash-dataset.mjs --check</code> checks committed hashes against current data.</li>
              <li><code>npm run validate:data</code> validates canonical data and schema consistency.</li>
              <li><code>npm run check</code> runs the broader local release gate.</li>
            </ul>
          </div>
          <aside>
            <dl>
              ${dataLine("Current snapshot", escapeHtml(manifest.snapshot_id), "mono")}
              ${dataLine("Full snapshot hash", escapeHtml(manifest.hashes.full_snapshot), "mono")}
              ${dataLine("Snapshot manifest", `<a href="${sitePath("/data/snapshot-manifest.json", 1)}">Open JSON</a>`)}
              ${dataLine("Release verification", `<a href="${sitePath("/data/release-verification.json", 1)}">Open JSON</a>`)}
              ${dataLine("Snapshot registry contract", `<a href="${sitePath("/contracts/SnapshotRegistry.sol", 1)}">Open contract</a>`)}
              ${dataLine("Replication guide", `<a href="${sitePath("/replicate/", 1)}">Open replication page</a>`)}
            </dl>
          </aside>
        </div>
      </section>
    `,
    1
  )
);

await mkdir(eventsDir, { recursive: true });
for (const entry of await readdir(eventsDir, { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name.startsWith("evt_")) {
    await rm(path.join(eventsDir, entry.name), { recursive: true, force: true });
  }
}

for (const event of events) {
  const school = schoolMap.get(event.school_id);
  const eventSources = event.source_ids.map((id) => sourceMap.get(id)).filter(Boolean);
  const eventDir = path.join(eventsDir, event.id);
  await mkdir(eventDir, { recursive: true });

  const sourceItems = eventSources
    .map(
      (source) => `
        <li>
          <a href="${sitePath(`/sources/${encodeURIComponent(source.id)}/`, detailDepth)}">${escapeHtml(source.title)}</a>
          <br><span class="section-note">${escapeHtml(source.publisher)} / ${escapeHtml(source.source_type)} / ${escapeHtml(source.published_date)}</span>
          <br><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">External source URL</a>
        </li>
      `
    )
    .join("");

  const changelog = event.changelog
    .map(
      (entry) => `
        <li>
          <span class="mono">${escapeHtml(entry.date)}</span>
          <br>${escapeHtml(entry.note)}
        </li>
      `
    )
    .join("");

  await writeFile(
    path.join(eventDir, "index.html"),
    page(
      event.id,
      `
        <p class="page-kicker">${escapeHtml(event.id)}</p>
        <h1 class="page-title page-title--small">${escapeHtml(event.summary)}</h1>
        <p class="page-intro">${escapeHtml(event.description)}</p>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              ${institutionalResponseSection(event)}
              <dl>
                ${dataLine("School", `<a href="${sitePath(`/schools/${encodeURIComponent(event.school_id)}/`, detailDepth)}">${escapeHtml(school?.name ?? event.school_id)}</a>`)}
                ${dataLine("Date", escapeHtml(event.date), "mono")}
                ${dataLine("Location", escapeHtml(event.location))}
                ${dataLine("Category", escapeHtml(event.category))}
                ${dataLine("Communities", escapeHtml(event.affected_communities.join(", ")))}
                ${!responseDisplayProfile(event).shouldShow ? dataLine("Response depth", escapeHtml(responseDepthDisplayProfile(event).label)) : ""}
                ${!responseDisplayProfile(event).shouldShow ? dataLine("Legal status", escapeHtml(event.legal_status)) : ""}
                ${dataLine("Verification", escapeHtml(event.verification_status))}
                ${dataLine("Confidence", escapeHtml(event.confidence))}
                ${dataLine("Review tier", escapeHtml(reviewTierLabel(event.review_tier)))}
                ${dataLine("Review tier limit", escapeHtml(reviewTierLimit(event.review_tier)))}
                ${dataLine("Verification rationale", escapeHtml(verificationRationale(event, eventSources.length)))}
                ${dataLine("Last updated", escapeHtml(event.updated_at), "mono")}
                ${dataLine("Record hash", escapeHtml(event.record_hash), "mono")}
              </dl>
              ${recordAuditCard(event, eventSources)}
            </div>
            <aside>
              <h2 class="section-title">Sources</h2>
              <ul class="source-list">${sourceItems}</ul>
              <h2 class="section-title section-title--spaced">Correction</h2>
              <p><a href="${sitePath(`/submit/?record_id=${encodeURIComponent(event.id)}`, detailDepth)}">Request a source-backed correction</a></p>${challengePacketEventIds.has(event.id) ? `
              <p><a href="${sitePath(`/challenge/?packet=${encodeURIComponent(event.id)}`, detailDepth)}">Challenge this record</a></p>` : ""}
              <h2 class="section-title section-title--spaced">Changelog</h2>
              <ul class="source-list">${changelog}</ul>
            </aside>
          </div>
        </section>
      `,
      detailDepth
    )
  );
}

await mkdir(sourcesDir, { recursive: true });
for (const entry of await readdir(sourcesDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    await rm(path.join(sourcesDir, entry.name), { recursive: true, force: true });
  }
}

for (const source of sources) {
  const sourceEvents = events
    .filter((event) => event.source_ids.includes(source.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  const sourceDir = path.join(sourcesDir, source.id);
  await mkdir(sourceDir, { recursive: true });

  await writeFile(
    path.join(sourceDir, "index.html"),
    page(
      source.title,
      `
        <p class="page-kicker">${escapeHtml(source.source_type)}</p>
        <h1 class="page-title page-title--small">${escapeHtml(source.title)}</h1>
        <p class="page-intro">${sourceEvents.length} record${sourceEvents.length === 1 ? "" : "s"} in the current dataset reference this public source.</p>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              <dl>
                ${dataLine("Publisher", escapeHtml(source.publisher))}
                ${dataLine("Published", escapeHtml(source.published_date), "mono")}
                ${dataLine("Accessed", escapeHtml(source.accessed_date), "mono")}
                ${dataLine("Source URL", `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a>`)}
              </dl>
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>School</th>
                      <th>Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${sourceEvents
                      .map((event) => {
                        const school = schoolMap.get(event.school_id);
                        return `
                          <tr>
                            <td class="mono">${escapeHtml(event.date)}</td>
                            <td>${escapeHtml(school?.name ?? event.school_id)}</td>
                            <td><a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(event.summary)}</a></td>
                          </tr>
                        `;
                      })
                      .join("")}
                  </tbody>
                </table>
              </div>
            </div>
            <aside>
              <dl>
                ${dataLine("Source ID", escapeHtml(source.id), "mono")}
                ${dataLine("Records", escapeHtml(sourceEvents.length))}
              </dl>
            </aside>
          </div>
        </section>
      `,
      detailDepth
    )
  );
}

await mkdir(schoolsDir, { recursive: true });
for (const entry of await readdir(schoolsDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    await rm(path.join(schoolsDir, entry.name), { recursive: true, force: true });
  }
}

for (const school of schools) {
  const schoolEvents = events
    .filter((event) => event.school_id === school.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const categories = [...new Set(schoolEvents.map((event) => event.category))].sort();
  const communities = [...new Set(schoolEvents.flatMap((event) => event.affected_communities))].sort();
  const latestUpdate = schoolEvents.map((event) => event.updated_at).sort().at(-1) ?? "";
  const sourceIds = [...new Set(schoolEvents.flatMap((event) => event.source_ids))];
  const schoolSources = sourceIds.map((id) => sourceMap.get(id)).filter(Boolean);
  const responseEvents = schoolEvents.filter(hasDisplayInstitutionalResponse);
  const legalEvents = schoolEvents.filter((event) =>
    /ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(`${event.category} ${event.legal_status}`)
  );
  const reviewNeedEvents = schoolEvents.filter((event) => reviewNeedLabels(event).length > 0);
  const reviewTierRows = countBy(schoolEvents.map((event) => reviewTierLabel(event.review_tier)));
  const sourceFamilyRows = countBy(schoolEvents.map((event) => sourceFamilyForRecord(event, sources)));
  const responseDepthRows = countBy(schoolEvents.map((event) => responseDepthDisplayProfile(event).label));
  const dossierPackets = [
    [
      "Dossier packet",
      workspaceUrlForEventsWithQuestion(
        schoolEvents,
        `Campus Evidence Lab ${school.name} Dossier Packet`,
        "What public-source records exist for this school in the current snapshot?",
        detailDepth
      )
    ],
    [
      "Legal/OCR packet",
      workspaceUrlForEventsWithQuestion(
        legalEvents,
        `Campus Evidence Lab ${school.name} Legal/OCR Packet`,
        "Which public legal or OCR records are documented for this school?",
        detailDepth
      )
    ],
    [
      "Response packet",
      workspaceUrlForEventsWithQuestion(
        responseEvents,
        `Campus Evidence Lab ${school.name} Institutional Response Packet`,
        "Which public institutional responses are documented for this school?",
        detailDepth
      )
    ],
    [
      "Review-needs packet",
      workspaceUrlForEventsWithQuestion(
        reviewNeedEvents,
        `Campus Evidence Lab ${school.name} Review Needs Packet`,
        "Which records in this school dossier most need source, classification, or use-limit review?",
        detailDepth
      )
    ]
  ].filter(([, href]) => href);
  const reviewNeeds = countBy(schoolEvents.flatMap(reviewNeedLabels));
  const schoolFilterLinks = communities
    .map(
      (community) =>
        `<a class="button-link" href="${sitePath(`/events/?school=${encodeURIComponent(school.id)}&community=${encodeURIComponent(community)}`, detailDepth)}">Open ${escapeHtml(community)} records in Events</a>`
    )
    .join("");
  const antisemitismLink = `<a class="button-link" href="${sitePath(`/events/?school=${encodeURIComponent(school.id)}&q=antisemitism`, detailDepth)}">Open antisemitism search in Events</a>`;
  const importSummary = importSummaryForSchool(school.id);
  const acceptedQaCount = importSummary.accepted_candidate_count;
  const acceptedQaText = `${formatNumber(acceptedQaCount)} accepted official-source QA candidate${acceptedQaCount === 1 ? "" : "s"}`;
  const importSourceFamilyRows = labeledCountRows(importSummary.source_family_counts, sourceFamilyLabel);
  const importRecordLaneRows = labeledCountRows(importSummary.record_lane_counts, recordLaneLabel);
  const importAggregateSubtypeRows = labeledCountRows(importSummary.aggregate_stat_subtype_counts, aggregateSubtypeLabel);
  const combinedSourceFamilies = [
    ...new Set([
      ...sourceFamilyRows.map(([label]) => sourceFamilyLabel(label)),
      ...importSourceFamilyRows.map(([label]) => label)
    ])
  ].sort();
  const publicRecordBrief = `${schoolEvents.length} public event record${schoolEvents.length === 1 ? "" : "s"} and ${acceptedQaText} are linked to this institution in the current snapshot. This room describes public-source documentation, not campus safety, incident prevalence, severity, or legal responsibility.`;
  const schoolDir = path.join(schoolsDir, school.id);
  await mkdir(schoolDir, { recursive: true });

  await writeFile(
    path.join(schoolDir, "index.html"),
    page(
      school.name,
      `
        <p class="page-kicker">${escapeHtml(school.state)} / ${escapeHtml(school.city)} / Accountability Room</p>
        <h1 class="page-title page-title--small">${escapeHtml(school.name)} Accountability Room</h1>
        <p class="page-intro">${escapeHtml(publicRecordBrief)}</p>
        <p class="limit-line">No rankings. No safety scores. No legal findings.</p>
        <div class="hero-actions accountability-actions" aria-label="Institution accountability actions">
          <a class="button-link button-link--primary" href="${sitePath(`/events/?school=${encodeURIComponent(school.id)}`, detailDepth)}">Open Records</a>
          <a class="button-link" href="${workspaceUrlForEvents(schoolEvents, detailDepth)}">Build Source Packet</a>
          <a class="button-link" href="${sitePath(`/submit/?record_id=${encodeURIComponent(schoolEvents[0]?.id ?? "")}`, detailDepth)}">Correction / Right of Reply</a>
          <a class="button-link" href="#source-packet">Inspect Source Basis</a>
        </div>
        <section class="section section--tight briefing-shell" aria-label="Institution accountability summary">
          <div class="briefing-grid">
            <div class="briefing-metric">
              <span class="metric__value">${formatNumber(schoolEvents.length)}</span>
              <span class="metric__label">public event records</span>
            </div>
            <div class="briefing-metric">
              <span class="metric__value">${formatNumber(acceptedQaCount)}</span>
              <span class="metric__label">accepted official-source QA candidates</span>
            </div>
            <div class="briefing-metric">
              <span class="metric__value">${formatNumber(combinedSourceFamilies.length)}</span>
              <span class="metric__label">source families represented</span>
            </div>
            <div class="briefing-metric">
              <span class="metric__value">${formatNumber(responseEvents.length)}</span>
              <span class="metric__label">records with public response evidence</span>
            </div>
            <div class="briefing-metric">
              <span class="metric__value">${escapeHtml(importSummary.latest_record_year || "None")}</span>
              <span class="metric__label">latest accepted QA record year</span>
            </div>
            <div class="briefing-metric">
              <span class="metric__value">${escapeHtml(manifest.hashes.full_snapshot.slice(0, 18))}...</span>
              <span class="metric__label">snapshot hash prefix</span>
            </div>
          </div>
        </section>
        ${renderAccountabilitySignalsPanel(accountabilitySignalsBySchool.get(school.id), detailDepth)}
        <section class="section section--tight briefing-columns">
          <div>
            <div class="section-header">
              <h2 class="section-title">What the public record says</h2>
              <p class="section-note">Current snapshot only; counts are documentation, not institutional quality</p>
            </div>
            <dl>
              ${dataLine("Public event records", escapeHtml(formatNumber(schoolEvents.length)))}
              ${dataLine("Accepted official-source QA candidates", escapeHtml(formatNumber(acceptedQaCount)))}
              ${dataLine("Communities", escapeHtml(communities.join(", ") || "None recorded"))}
              ${dataLine("Categories", escapeHtml(categories.join(", ") || "None recorded"))}
              ${dataLine("Source families", escapeHtml(combinedSourceFamilies.join(", ") || "No source family rows recorded"))}
              ${dataLine("Latest update", escapeHtml(latestUpdate || "None"), "mono")}
              ${
                school.website
                  ? dataLine("Institution website", `<a href="${escapeHtml(school.website)}" target="_blank" rel="noreferrer">${escapeHtml(school.website)}</a>`)
                  : ""
              }
            </dl>
            <h3 class="section-title section-title--spaced">Timeline</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Record</th>
                    <th>Sources</th>
                  </tr>
                </thead>
                <tbody>
                  ${schoolEvents.length
                    ? schoolEvents
                        .map(
                          (event) => `
                            <tr>
                              <td class="mono">${escapeHtml(event.date)}</td>
                              <td>${escapeHtml(event.category)}</td>
                              <td><a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(event.summary)}</a></td>
                              <td>${event.source_ids.length}</td>
                            </tr>
                          `
                        )
                        .join("")
                    : `<tr><td colspan="4">No public event records are recorded for this institution in the current dataset.</td></tr>`}
                </tbody>
              </table>
            </div>
            <h3 class="section-title section-title--spaced">Official Aggregate / Case Rows</h3>
            ${acceptedQaCount ? countTable(importRecordLaneRows, "Accepted QA Lane", "Rows") : `<p class="empty">No accepted import-wave QA candidates are linked to this institution in the current summary artifact.</p>`}
            ${importAggregateSubtypeRows.length ? countTable(importAggregateSubtypeRows, "Aggregate Subtype", "Rows") : ""}
          </div>
          <aside class="briefing-callout">
            <h2 class="section-title">Reading Rule</h2>
            <ul class="evidence-list">
              <li>This room describes public documentation in the current snapshot.</li>
              <li>Accepted import-wave QA candidates passed deterministic source and field gates; they are not individually human-certified unless a linked review artifact says so.</li>
              <li>Do not use this page as a ranking, safety score, prevalence estimate, severity score, legal conclusion, or complete incident history.</li>
            </ul>
            <h2 class="section-title section-title--spaced">Open Focused Views</h2>
            <div class="utility-bar">
              ${schoolFilterLinks}
              ${antisemitismLink}
            </div>
          </aside>
        </section>
        <section class="section section--tight briefing-columns">
          <div>
            <div class="section-header">
              <h2 class="section-title">Institution response</h2>
              <p class="section-note">Public response evidence in the current dataset</p>
            </div>
            ${
              responseEvents.length
                ? `<div class="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Record</th>
                          <th>Public response</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${responseEvents
                          .map(
                            (event) => `
                              <tr>
                                <td class="mono">${escapeHtml(event.date)}</td>
                                <td><a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(event.summary)}</a></td>
                                <td>${escapeHtml(String(event.institutional_response ?? "").trim())}</td>
                              </tr>
                            `
                          )
                          .join("")}
                      </tbody>
                    </table>
                  </div>`
                : `<p class="empty">No public institutional response is recorded in the current dataset for this institution.</p>`
            }
            <h3 class="section-title section-title--spaced">Response Depth Mix</h3>
            ${countTable(responseDepthRows.length ? responseDepthRows : [["No records", 0]], "Response Depth")}
          </div>
          <aside class="briefing-callout">
            <h2 class="section-title">Right-of-Reply Path</h2>
            <p><a href="${sitePath(`/submit/?record_id=${encodeURIComponent(schoolEvents[0]?.id ?? "")}`, detailDepth)}">Correction / right-of-reply intake</a> accepts source-backed corrections, missing public responses, stronger source locators, duplicate reports, and institution response submissions.</p>
          </aside>
        </section>
        <section class="section section--tight briefing-columns">
          <div>
            <div class="section-header">
              <h2 class="section-title">Unresolved limits</h2>
              <p class="section-note">What this room should not be used to claim</p>
            </div>
            <ul class="evidence-list">
              <li>Counts are public documentation counts, not incident frequency or campus safety measures.</li>
              <li>Missing rows can reflect source availability, import scope, institution identity matching, or current project coverage.</li>
              <li>Quarantined or unresolved import rows remain outside public assertions until their gates are repaired.</li>
              <li>Use the codebook and coverage limits before comparing institutions or making broader claims.</li>
            </ul>
            <h3 class="section-title section-title--spaced">Dossier Review Needs</h3>
            ${countTable(reviewNeeds.length ? reviewNeeds : [["No priority review flags", 0]], "Review Need")}
          </div>
          <aside class="briefing-callout">
            <h2 class="section-title">Public Legal/OCR Items</h2>
            ${
              legalEvents.length
                ? `<ul class="source-list">
                    ${legalEvents
                      .map(
                        (event) => `
                          <li>
                            <a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(event.summary)}</a>
                            <br><span class="section-note">${escapeHtml(event.legal_status || "Status not recorded")}</span>
                          </li>
                        `
                      )
                      .join("")}
                  </ul>`
                : `<p class="empty">No public legal or OCR item is recorded in the current dataset for this institution.</p>`
            }
          </aside>
        </section>
        <section class="section section--tight briefing-columns" id="source-packet">
          <div>
            <div class="section-header">
              <h2 class="section-title">Source packet</h2>
              <p class="section-note">Sources, review tiers, import-wave lanes, and snapshot hash</p>
            </div>
            <h3 class="section-title section-title--spaced">Dossier Packets</h3>
            <div class="utility-bar">
              ${dossierPackets.map(([label, href]) => `<a class="button-link" href="${href}">${escapeHtml(label)}</a>`).join("")}
            </div>
            <h3 class="section-title section-title--spaced">Review Tier Mix</h3>
            ${countTable(reviewTierRows.length ? reviewTierRows : [["No public event records", 0]], "Review Tier")}
            <h3 class="section-title section-title--spaced">Source Family Mix</h3>
            ${countTable(importSourceFamilyRows.length ? importSourceFamilyRows : sourceFamilyRows.length ? sourceFamilyRows : [["No source family rows", 0]], "Source Family", "Rows")}
            <dl>
              ${dataLine("Dataset snapshot", escapeHtml(manifest.hashes.full_snapshot), "mono")}
              ${dataLine("Import waves represented", escapeHtml(importSummary.import_wave_ids.length ? formatNumber(importSummary.import_wave_ids.length) : "None"))}
            </dl>
          </div>
          <aside>
            <h2 class="section-title">Related Sources</h2>
            <ul class="source-list">
              ${schoolSources.length
                ? schoolSources
                    .map(
                      (source) => `
                        <li>
                          <a href="${sitePath(`/sources/${encodeURIComponent(source.id)}/`, detailDepth)}">${escapeHtml(source.title)}</a>
                          <br><span class="section-note">${escapeHtml(source.publisher)} / ${escapeHtml(source.source_type)}</span>
                        </li>
                      `
                    )
                    .join("")
                : `<li>No public event source pages are linked to this institution in the current dataset.</li>`}
            </ul>
          </aside>
        </section>
        <section class="section section--tight">
          <div class="section-header">
            <h2 class="section-title">Correction / right of reply</h2>
            <p class="section-note">Public-source corrections and institution replies remain part of the record</p>
          </div>
          <p><a href="${sitePath(`/submit/?record_id=${encodeURIComponent(schoolEvents[0]?.id ?? "")}`, detailDepth)}">Submit a correction, source locator, duplicate report, or right-of-reply item</a>. Include public source URLs and avoid private testimony, private screenshots, direct messages, or sensitive personal information.</p>
        </section>
      `,
      detailDepth,
      true
    )
  );
}

await mkdir(briefsDir, { recursive: true });
for (const entry of await readdir(briefsDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    await rm(path.join(briefsDir, entry.name), { recursive: true, force: true });
  }
}

for (const brief of briefs) {
  const newEvents = brief.new_event_ids.map((id) => events.find((event) => event.id === id)).filter(Boolean);
  const updatedEvents = brief.updated_event_ids.map((id) => events.find((event) => event.id === id)).filter(Boolean);
  const allBriefEvents = [...newEvents, ...updatedEvents];
  const sourceTypeRows = countBy(allBriefEvents.flatMap((event) => event.source_types));
  const briefDir = path.join(briefsDir, brief.id);
  await mkdir(briefDir, { recursive: true });

  await writeFile(
    path.join(briefDir, "index.html"),
    page(
      brief.title,
      `
        <p class="page-kicker">${escapeHtml(brief.week_start)} / ${escapeHtml(brief.week_end)}</p>
        <h1 class="page-title page-title--small">${escapeHtml(brief.title)}</h1>
        <p class="page-intro">${escapeHtml(brief.summary)}</p>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              ${briefListSection("Analysis Notes", brief.analysis_points)}
              ${briefListSection("Responsible Uses", brief.responsible_uses)}
              ${
                brief.methods_note
                  ? `<h2 class="section-title section-title--spaced">Method Note</h2>
                     <p>${escapeHtml(brief.methods_note)}</p>`
                  : ""
              }
              <h2 class="section-title">Newly Added Verified Records</h2>
              ${briefRecordTable(newEvents, "No newly added records in this brief.")}
              <h2 class="section-title section-title--spaced">Updated Records</h2>
              ${briefRecordTable(updatedEvents, "No updated records in this brief.")}
              <h2 class="section-title section-title--spaced">Notable Institutional Responses</h2>
              ${briefResponseList(allBriefEvents)}
              <h2 class="section-title section-title--spaced">Legal/OCR Updates</h2>
              ${briefLegalUpdates(allBriefEvents)}
            </div>
            <aside>
              <dl>
                ${dataLine("Brief type", escapeHtml(brief.brief_type || "Dataset update"))}
                ${dataLine("Published", escapeHtml(brief.published_date), "mono")}
                ${dataLine("Dataset version", escapeHtml(manifest.snapshot_id), "mono")}
                ${dataLine("Dataset hash", escapeHtml(brief.snapshot_hash || "See current manifest"), "mono")}
                ${dataLine("New records", escapeHtml(brief.new_event_ids.length))}
                ${dataLine("Updated records", escapeHtml(brief.updated_event_ids.length))}
                ${dataLine("Corrections", escapeHtml(brief.correction_ids.length))}
              </dl>
              ${briefListSection("Research Questions", brief.research_questions)}
              <h2 class="section-title section-title--spaced">Source-Type Breakdown</h2>
              ${countTable(sourceTypeRows, "Source Type")}
              <h2 class="section-title section-title--spaced">Corrections Issued</h2>
              <p class="empty">${brief.correction_ids.length ? escapeHtml(brief.correction_ids.join(", ")) : "No corrections issued in this brief."}</p>
              <h2 class="section-title section-title--spaced">Dataset Downloads</h2>
              <ul class="source-list">
                <li><a href="${sitePath("/data/events.json", detailDepth)}">Events JSON</a></li>
                <li><a href="${sitePath("/data/events.csv", detailDepth)}">Events CSV</a></li>
                <li><a href="${sitePath("/data/snapshot-manifest.json", detailDepth)}">Snapshot manifest</a></li>
                <li><a href="${sitePath("/downloads/", detailDepth)}">All downloads</a></li>
              </ul>
            </aside>
          </div>
        </section>
      `,
      detailDepth
    )
  );
}

await mkdir(reviewDebtDir, { recursive: true });
const topDebtRecords = (reviewDebtLedger.records ?? []).slice().sort((a, b) => b.repair_priority - a.repair_priority || a.event_id.localeCompare(b.event_id));
const queueEntries = Object.values(reviewDebtLedger.queues ?? {});
await writeFile(
  path.join(reviewDebtDir, "index.html"),
  page(
    "Review Debt",
    `
      <p class="page-kicker">Whole-database review debt</p>
      <h1 class="page-title page-title--small">Every record has an inspectable review-debt status.</h1>
      <p class="page-intro">This ledger exposes what is strong, weak, blocked, or awaiting source review in the current snapshot. It is deterministic internal triage, not manual certification, outside validation, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Debt Status Counts</h2>
            ${countTable(objectCountRows(reviewDebtLedger.debt_status_counts), "Debt Status")}
            <h2 class="section-title section-title--spaced">Source Family Counts</h2>
            ${countTable(objectCountRows(reviewDebtLedger.source_family_counts), "Source Family")}
            <h2 class="section-title section-title--spaced">Top Review Issues</h2>
            ${countTable(objectCountRows(reviewDebtLedger.issue_counts).slice(0, 20), "Issue")}
            <h2 class="section-title section-title--spaced">Highest-Priority Rows</h2>
            ${ledgerRecordTable(topDebtRecords.slice(0, 50))}
          </div>
          <aside>
            <dl>
              ${dataLine("Snapshot", escapeHtml(reviewDebtLedger.snapshot_id), "mono")}
              ${dataLine("Records", escapeHtml(reviewDebtLedger.totals.records))}
              ${dataLine("Source families", escapeHtml(reviewDebtLedger.totals.source_families))}
              ${dataLine("Blocked", escapeHtml(reviewDebtLedger.totals.blocked))}
              ${dataLine("High review debt", escapeHtml(reviewDebtLedger.totals.high_review_debt))}
              ${dataLine("Medium review debt", escapeHtml(reviewDebtLedger.totals.medium_review_debt))}
              ${dataLine("Ledger JSON", `<a href="${sitePath("/data/review-debt-ledger.json", 1)}">Download artifact</a>`)}
              ${dataLine("Use limit", escapeHtml(reviewDebtLedger.public_claim_limit))}
            </dl>
            <h2 class="section-title section-title--spaced">Status Definitions</h2>
            <ul class="source-list">
              ${(reviewDebtLedger.status_definitions ?? [])
                .map((definition) => `<li><strong>${escapeHtml(definition.status)}</strong><br><span>${escapeHtml(definition.meaning)}</span></li>`)
                .join("")}
            </ul>
          </aside>
        </div>
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Deterministic Review Queues</h2>
          <p class="section-note">Top rows in each queue; full rows are in the JSON artifact</p>
        </div>
        ${queueEntries
          .map(
            (queue) => `
              <h3 class="section-title section-title--spaced">${escapeHtml(queue.label)}</h3>
              <p class="section-note">${escapeHtml(queue.description)}</p>
              ${ledgerRecordTable((queue.records ?? []).slice(0, 10))}
            `
          )
          .join("")}
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Safe Repair Policy</h2>
          <p class="section-note">This wave exposes debt; it does not mass-certify records</p>
        </div>
        <p>${escapeHtml(reviewDebtLedger.safe_repair_policy?.rule ?? "")}</p>
        <ul class="evidence-list">
          ${(reviewDebtLedger.safe_repair_policy?.deferred_batch_repairs ?? []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>
    `,
    1
  )
);

await mkdir(externalReviewDir, { recursive: true });
await writeFile(
  path.join(externalReviewDir, "index.html"),
  page(
    "External Review Packet",
    `
      <p class="page-kicker">External review packet</p>
      <h1 class="page-title page-title--small">A source-to-record dossier reviewers can challenge.</h1>
      <p class="page-intro">This packet packages ${externalReviewPacket.records.length} internally certified Gold v1 records with source-to-record checklists, replication steps, and challenge templates. It is not outside validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Formal Evidence Dossier</h2>
            ${externalReviewRecordTable(externalReviewPacket.records ?? [])}
            <h2 class="section-title section-title--spaced">Challenge Templates</h2>
            <ul class="source-list">
              ${(externalReviewPacket.challenge_templates ?? [])
                .map((template) => `<li><strong>${escapeHtml(template.label)}</strong><br><span>${escapeHtml(template.prompt)}</span></li>`)
                .join("")}
            </ul>
          </div>
          <aside>
            <dl>
              ${dataLine("Snapshot", escapeHtml(externalReviewPacket.snapshot_id), "mono")}
              ${dataLine("Packet records", escapeHtml(externalReviewPacket.records.length))}
              ${dataLine("Certified Gold v1 available", escapeHtml(externalReviewPacket.totals.certified_gold_v1_available))}
              ${dataLine("Gold v1 not certified", escapeHtml(externalReviewPacket.totals.excluded_not_certified_gold_v1))}
              ${dataLine("Gold v1 blocked", escapeHtml(externalReviewPacket.totals.excluded_blocked_gold_v1))}
              ${dataLine("Packet JSON", `<a href="${sitePath("/data/external-review-packet.json", 1)}">Download artifact</a>`)}
              ${dataLine("Replication guide", `<a href="${sitePath("/docs/source-to-record-replication-guide.md", 1)}">Markdown guide</a>`)}
              ${dataLine("Known limits", `<a href="${sitePath("/known-limits/", 1)}">Open page</a>`)}
              ${dataLine("Use limit", escapeHtml(externalReviewPacket.public_claim_limit))}
            </dl>
          </aside>
        </div>
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">How To Review A Packet Record</h2>
          <p class="section-note">Use the same checks on every record before accepting or challenging it</p>
        </div>
        <ol class="evidence-list">
          <li>Open the record page, workspace packet, and source link.</li>
          <li>Confirm the source locator points to the exact item, page, table, workbook cell, or document section.</li>
          <li>Compare source wording against school, date precision, category, affected-community labels, response-depth label, legal/procedural status, and rationale fields.</li>
          <li>File a challenge with source URL, disputed field, current wording, and proposed source-bounded wording when any field is unsupported.</li>
          <li>Do not convert review results into school rankings, prevalence estimates, safety ratings, severity ratings, endorsement, or legal conclusions.</li>
        </ol>
      </section>
    `,
    1
  )
);

await mkdir(knownLimitsDir, { recursive: true });
await writeFile(
  path.join(knownLimitsDir, "index.html"),
  page(
    "Known Limits",
    `
      <p class="page-kicker">Known limits and unresolved records</p>
      <h1 class="page-title page-title--small">The unresolved work is public, countable, and batchable.</h1>
      <p class="page-intro">This page summarizes unresolved review debt from the current snapshot. Counts are review queues and source-to-record work items; they are not findings that records are false, severe, representative, complete, or externally reviewed.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Unresolved Review Debt</h2>
            ${countTable(objectCountRows(externalReviewPacket.known_limits?.unresolved_records ?? {}), "Unresolved Status")}
            <h2 class="section-title section-title--spaced">Source Families</h2>
            ${countTable(objectCountRows(externalReviewPacket.known_limits?.source_family_counts ?? {}), "Source Family")}
            <h2 class="section-title section-title--spaced">Top Issue Counts</h2>
            ${countTable(objectCountRows(externalReviewPacket.known_limits?.top_issue_counts ?? {}), "Issue")}
            <h2 class="section-title section-title--spaced">Blocked And Highest-Priority Rows</h2>
            ${ledgerRecordTable(topDebtRecords.slice(0, 50))}
          </div>
          <aside>
            <dl>
              ${dataLine("Review debt records", escapeHtml(reviewDebtLedger.totals.records))}
              ${dataLine("Blocked", escapeHtml(reviewDebtLedger.totals.blocked))}
              ${dataLine("High review debt", escapeHtml(reviewDebtLedger.totals.high_review_debt))}
              ${dataLine("Medium review debt", escapeHtml(reviewDebtLedger.totals.medium_review_debt))}
              ${dataLine("Gold v1 not certified", escapeHtml(externalReviewPacket.known_limits.unresolved_records.not_certified_gold_v1))}
              ${dataLine("Gold v1 blocked", escapeHtml(externalReviewPacket.known_limits.unresolved_records.blocked_gold_v1))}
              ${dataLine("Ledger JSON", `<a href="${sitePath("/data/review-debt-ledger.json", 1)}">Download ledger</a>`)}
              ${dataLine("External packet", `<a href="${sitePath("/external-review/", 1)}">Open packet</a>`)}
            </dl>
          </aside>
        </div>
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Batch Rule For Scaling Review</h2>
          <p class="section-note">The project should scale strict review by source-family batches, not by broad claims</p>
        </div>
        <ul class="evidence-list">
          <li>Start with blocked records and source-locator debt.</li>
          <li>Review dataset-backed records in workbook/sheet/row/column batches.</li>
          <li>Review ASR records in page/table/statistic-label batches.</li>
          <li>Review OCR aggregate records by exact item date and item label.</li>
          <li>Do not call any batch certified until every record clears source locator, date precision, category fit, affected-label boundary, response-depth, and rationale-specificity gates.</li>
        </ul>
      </section>
    `,
    1
  )
);

const topCertificationRecords = (certificationLedger.records ?? [])
  .slice()
  .sort((a, b) => b.open_gates.length - a.open_gates.length || a.event_id.localeCompare(b.event_id));
const certificationRecordsById = new Map((certificationLedger.records ?? []).map((record) => [record.event_id, record]));
const sourceFamilyReview001Rows = (sourceFamilyCertificationReview001.records ?? []).map((record) => ({
  ...certificationRecordsById.get(record.event_id),
  ...record,
  event_url: `/events/${encodeURIComponent(record.event_id)}/`,
  workspace_url: `/research-workspace/?record_ids=${encodeURIComponent(record.event_id)}`,
  challenge_url: `/challenge/?record=${encodeURIComponent(record.event_id)}`
}));
await mkdir(path.join(certificationDir, "batch-001"), { recursive: true });
await mkdir(sourceFamilyReview001Dir, { recursive: true });
await writeFile(
  path.join(certificationDir, "index.html"),
  page(
    "Certification Ledger",
    `
      <p class="page-kicker">Full-database certification system</p>
      <h1 class="page-title page-title--small">Every record has a certification status and exact open gates.</h1>
      <p class="page-intro">This ledger distinguishes internally certified records from records that are not certified, blocked, or awaiting review. It does not claim all records are manually reviewed, externally validated, ranked, scored, representative, or legally adjudicated.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Certification Status Counts</h2>
            ${countTable(objectCountRows(certificationLedger.certification_status_counts), "Certification Status")}
            <h2 class="section-title section-title--spaced">Open Gate Counts</h2>
            ${countTable(objectCountRows(certificationLedger.open_gate_counts), "Open Gate")}
            <h2 class="section-title section-title--spaced">Highest Open-Gate Rows</h2>
            ${certificationRecordTable(topCertificationRecords.slice(0, 50))}
          </div>
          <aside>
            <dl>
              ${dataLine("Snapshot", escapeHtml(certificationLedger.snapshot_id), "mono")}
              ${dataLine("Records", escapeHtml(certificationLedger.totals.records))}
              ${dataLine("Certified", escapeHtml(certificationLedger.totals.certified))}
              ${dataLine("Not certified", escapeHtml(certificationLedger.totals.not_certified))}
              ${dataLine("Blocked", escapeHtml(certificationLedger.totals.blocked))}
              ${dataLine("Awaiting review", escapeHtml(certificationLedger.totals.awaiting_review))}
              ${dataLine("Ledger JSON", `<a href="${sitePath("/data/certification-ledger.json", 1)}">Download artifact</a>`)}
              ${dataLine("Rulebook", `<a href="${sitePath("/docs/full-database-certification-rulebook.md", 1)}">Certification rulebook</a>`)}
              ${dataLine("Playbooks", `<a href="${sitePath("/docs/source-family-review-playbooks.md", 1)}">Source-family playbooks</a>`)}
              ${dataLine("Batch 001", `<a href="${sitePath("/certification/batch-001/", 1)}">Open pilot</a>`)}
              ${sourceFamilyReviewDataLines(1)}
              ${edReviewDataLines(1)}
              ${dataLine("Use limit", escapeHtml(certificationLedger.public_claim_limit))}
            </dl>
            <h2 class="section-title section-title--spaced">Status Definitions</h2>
            <ul class="source-list">
              ${(certificationLedger.status_definitions ?? [])
                .map((definition) => `<li><strong>${escapeHtml(definition.status)}</strong><br><span>${escapeHtml(definition.meaning)}</span></li>`)
                .join("")}
            </ul>
          </aside>
        </div>
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Source-Family Certification</h2>
          <p class="section-note">Counts show review state by source family, not institutional quality or campus safety</p>
        </div>
        ${Object.entries(certificationLedger.source_family_certification ?? {})
          .map(
            ([family, stats]) => `
              <h3 class="section-title section-title--spaced">${escapeHtml(family)}</h3>
              ${countTable(objectCountRows(stats.status_counts), "Status")}
            `
          )
          .join("")}
      </section>
    `,
    1
  )
);

await writeFile(
  path.join(certificationDir, "batch-001", "index.html"),
  page(
    "Batch 001 Certification Pilot",
    `
      <p class="page-kicker">Certification Batch 001</p>
      <h1 class="page-title page-title--small">ED dataset provenance pilot.</h1>
      <p class="page-intro">This bounded pilot tests whether ED Campus Safety dataset records have enough workbook, sheet, row, column, and cell provenance for source-to-record certification. It should produce unresolved gates when provenance is missing; that is a credibility feature, not a defect.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Batch Status Counts</h2>
            ${countTable(objectCountRows(certificationLedger.batch_001.status_counts), "Certification Status")}
            <h2 class="section-title section-title--spaced">Batch Open Gates</h2>
            ${countTable(objectCountRows(certificationLedger.batch_001.open_gate_counts), "Open Gate")}
            <h2 class="section-title section-title--spaced">Batch Records</h2>
            ${certificationRecordTable(
              (certificationLedger.batch_001.records ?? []).map((record) => ({
                ...record,
                source_family: certificationLedger.batch_001.source_family
              })),
              2
            )}
          </div>
          <aside>
            <dl>
              ${dataLine("Batch", escapeHtml(certificationLedger.batch_001.id), "mono")}
              ${dataLine("Source family", escapeHtml(certificationLedger.batch_001.source_family))}
              ${dataLine("Records", escapeHtml(certificationLedger.batch_001.records.length))}
              ${dataLine("Limit", escapeHtml(certificationLedger.batch_001.limit))}
              ${dataLine("Ledger JSON", `<a href="${sitePath("/data/certification-ledger.json", 2)}">Download artifact</a>`)}
              ${dataLine("Applied review", `<a href="${sitePath(ED_CERTIFICATION_REVIEW_SPECS[0].route, 2)}">Open Batch 001 review</a>`)}
              ${ED_CERTIFICATION_REVIEW_SPECS[1] ? dataLine("Next ED review", `<a href="${sitePath(ED_CERTIFICATION_REVIEW_SPECS[1].route, 2)}">Open Batch 002 review</a>`) : ""}
              ${dataLine("Use limit", escapeHtml(certificationLedger.batch_001.public_claim_limit))}
            </dl>
          </aside>
        </div>
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Batch Completion Rule</h2>
          <p class="section-note">No record is certified unless every gate passes</p>
        </div>
        <ul class="evidence-list">
          <li>Records missing workbook, sheet, row, column, or cell provenance remain awaiting review.</li>
          <li>Year-level dates remain visible unless a narrower source-supported date is verified.</li>
          <li>Response-depth labels remain limited unless a direct or agency-described response is sourced.</li>
          <li>Rationales must be source-specific before certification.</li>
        </ul>
      </section>
    `,
    2
  )
);

await writeFile(
  path.join(sourceFamilyReview001Dir, "index.html"),
  page(
    "Source-Family Certification Review 001",
    `
      <p class="page-kicker">Non-ED source-family pilot</p>
      <h1 class="page-title page-title--small">A bounded university-statement certification review.</h1>
      <p class="page-intro">This pilot applies the certification gates to two non-ED university-statement records. One record is certified; one remains not certified because the verified source text did not support every stored affected-community label at the same specificity.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Pilot Status Counts</h2>
            ${countTable(objectCountRows(sourceFamilyCertificationReview001.status_counts), "Certification Status")}
            <h2 class="section-title section-title--spaced">Reviewed Records</h2>
            ${certificationRecordTable(sourceFamilyReview001Rows, 1)}
          </div>
          <aside>
            <dl>
              ${dataLine("Artifact", escapeHtml(sourceFamilyCertificationReview001.id), "mono")}
              ${dataLine("Standard", escapeHtml(sourceFamilyCertificationReview001.standard_version), "mono")}
              ${dataLine("Records", escapeHtml(sourceFamilyCertificationReview001.records.length))}
              ${dataLine("Certified", escapeHtml(sourceFamilyCertificationReview001.status_counts.certified ?? 0))}
              ${dataLine("Not certified", escapeHtml(sourceFamilyCertificationReview001.status_counts.not_certified ?? 0))}
              ${dataLine("Review JSON", `<a href="${sitePath("/data/source-family-certification-review-001.json", 1)}">Download artifact</a>`)}
              ${dataLine("Reviewer doc", `<a href="${sitePath("/docs/source-family-certification-review-001.md", 1)}">Read notes</a>`)}
              ${dataLine("Certification ledger", `<a href="${sitePath("/certification/", 1)}">Open ledger</a>`)}
              ${dataLine("Use limit", escapeHtml(sourceFamilyCertificationReview001.public_claim_limit))}
            </dl>
          </aside>
        </div>
      </section>
      <section class="section section--tight">
        <div class="section-header">
          <h2 class="section-title">Review Boundary</h2>
          <p class="section-note">Strict source-to-record status, not broad validation</p>
        </div>
        <ul class="evidence-list">
          <li>The pilot covers only the records listed on this page.</li>
          <li>Certification requires every gate to pass under <code>certification_rules_v1</code>.</li>
          <li>A record can be reviewed and still remain not certified when a gate does not pass.</li>
          <li>This pilot is not external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.</li>
        </ul>
      </section>
    `,
    1
  )
);

for (const [index, spec] of ED_CERTIFICATION_REVIEW_SPECS.entries()) {
  const review = edCertificationReviews[index];
  const reviewDir = path.join(rootDir, spec.outputDir);
  const previousSpec = spec.previousRoute ? ED_CERTIFICATION_REVIEW_SPECS.find((candidate) => candidate.route === spec.previousRoute) : null;
  const nextSpec = spec.nextRoute ? ED_CERTIFICATION_REVIEW_SPECS.find((candidate) => candidate.route === spec.nextRoute) : null;

  await mkdir(reviewDir, { recursive: true });
  await writeFile(
    path.join(reviewDir, "index.html"),
    page(
      spec.pageTitle,
      `
        <p class="page-kicker">${escapeHtml(spec.pageKicker)}</p>
        <h1 class="page-title page-title--small">A frozen ED review wave applies source-to-record gates.</h1>
        <p class="page-intro">${escapeHtml(edReviewPageIntro(spec))}</p>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              <h2 class="section-title">Batch Review Status Counts</h2>
              ${countTable(objectCountRows(review.status_counts), "Certification Status")}
              <h2 class="section-title section-title--spaced">Open Gate Counts</h2>
              ${countTable(objectCountRows(review.open_gate_counts), "Open Gate")}
              <h2 class="section-title section-title--spaced">Provenance Status Counts</h2>
              ${countTable(objectCountRows(review.provenance_status_counts), "Provenance Status")}
              <h2 class="section-title section-title--spaced">Reviewed Records</h2>
              ${edBatchReviewRecordTable(review.records ?? [], 1)}
            </div>
            <aside>
              <dl>
                ${dataLine("Snapshot", escapeHtml(review.snapshot_id), "mono")}
                ${dataLine("Standard", escapeHtml(review.certification_standard_version), "mono")}
                ${dataLine("Review batch", escapeHtml(review.review_batch_id), "mono")}
                ${dataLine("Source batch", escapeHtml(review.source_batch_id), "mono")}
                ${dataLine("Records", escapeHtml(review.totals.records))}
                ${dataLine("Certified", escapeHtml(review.totals.certified))}
                ${dataLine("Not certified", escapeHtml(review.totals.not_certified))}
                ${dataLine("Blocked", escapeHtml(review.totals.blocked))}
                ${dataLine("Review JSON", `<a href="${sitePath(`/data/${spec.artifactName}`, 1)}">Download artifact</a>`)}
                ${dataLine("ED provenance", `<a href="${sitePath("/ed-provenance/", 1)}">Open source-cell audit</a>`)}
                ${dataLine("Ledger", `<a href="${sitePath("/certification/", 1)}">Open full ledger</a>`)}
                ${previousSpec ? dataLine("Previous ED review", `<a href="${sitePath(previousSpec.route, 1)}">Open previous ED review</a>`) : ""}
                ${nextSpec ? dataLine("Next ED review", `<a href="${sitePath(nextSpec.route, 1)}">Open next ED review</a>`) : ""}
                ${dataLine("Use limit", escapeHtml(review.public_claim_limit))}
              </dl>
            </aside>
          </div>
        </section>
        <section class="section section--tight">
          <div class="section-header">
            <h2 class="section-title">Strict Reading Rule</h2>
            <p class="section-note">This page improves reviewability; it is not a broader claim about campuses or prevalence</p>
          </div>
          <ul class="evidence-list">
            <li>Certified means every current source-to-record gate passed for this named batch-review version.</li>
            <li>Not certified means at least one reviewed gate did not pass; the exact gate remains visible.</li>
            <li>Blocked means the record cannot be certified until a source-cell or identity blocker is repaired.</li>
            <li>The page must not be used as external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.</li>
          </ul>
        </section>
      `,
      1
    )
  );
}

await mkdir(edProvenanceDir, { recursive: true });
const unmatchedEdRows = (edDatasetProvenanceAudit.records ?? []).filter((record) => record.provenance_status === "unmatched");
await writeFile(
  path.join(edProvenanceDir, "index.html"),
  page(
    "ED Dataset Provenance",
    `
      <p class="page-kicker">ED dataset provenance</p>
      <h1 class="page-title page-title--small">Source-cell reconstruction before manual certification.</h1>
      <p class="page-intro">This audit maps ED Campus Safety dataset records to official workbook, sheet, row, column, and cell candidates where current record metadata supports a deterministic match. It does not certify records, change event facts, or claim outside validation.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Provenance Status Counts</h2>
            ${countTable(objectCountRows(edDatasetProvenanceAudit.provenance_status_counts), "Status")}
            <h2 class="section-title section-title--spaced">Workbook Counts</h2>
            ${countTable(objectCountRows(edDatasetProvenanceAudit.workbook_counts), "Workbook")}
            <h2 class="section-title section-title--spaced">Scope Counts</h2>
            ${countTable(objectCountRows(edDatasetProvenanceAudit.scope_counts), "Scope")}
            <h2 class="section-title section-title--spaced">Unmatched Rows</h2>
            ${certificationRecordTable(
              unmatchedEdRows.slice(0, 50).map((record) => ({
                ...record,
                source_family: "ed_campus_safety_dataset",
                certification_status: record.provenance_status,
                open_gates: [record.unresolved_reason],
                next_action: "Do not apply a source locator until a reviewer can resolve the ambiguity.",
                challenge_url: `/challenge/?record=${encodeURIComponent(record.event_id)}`
              }))
            )}
          </div>
          <aside>
            <dl>
              ${dataLine("Snapshot", escapeHtml(edDatasetProvenanceAudit.snapshot_id), "mono")}
              ${dataLine("ED records", escapeHtml(edDatasetProvenanceAudit.totals.records))}
              ${dataLine("Matched", escapeHtml(edDatasetProvenanceAudit.totals.matched))}
              ${dataLine("Unmatched", escapeHtml(edDatasetProvenanceAudit.totals.unmatched))}
              ${dataLine("Workbooks", escapeHtml(edDatasetProvenanceAudit.totals.workbooks))}
              ${dataLine("Audit JSON", `<a href="${sitePath("/data/ed-dataset-provenance-audit.json", 1)}">Download artifact</a>`)}
              ${dataLine("Notes", `<a href="${sitePath("/docs/ed-dataset-provenance-audit.md", 1)}">Read notes</a>`)}
              ${dataLine("Use limit", escapeHtml(edDatasetProvenanceAudit.public_claim_limit))}
            </dl>
          </aside>
        </div>
      </section>
    `,
    1
  )
);

await mkdir(certificationBatchesDir, { recursive: true });
await writeFile(
  path.join(certificationBatchesDir, "index.html"),
  page(
    "Certification Batches",
    `
      <p class="page-kicker">Certification batch manifest</p>
      <h1 class="page-title page-title--small">The 4,000-record review is divided by source-family lane.</h1>
      <p class="page-intro">Batches organize strict review. They do not certify records by themselves. A batch is complete only when every record has a final visible status and exact open gates.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Review Lanes</h2>
            ${Object.values(certificationBatches.lanes ?? {})
              .map(
                (lane) => `
                  <h3 class="section-title section-title--spaced">${escapeHtml(lane.label)}</h3>
                  <p class="section-note">${escapeHtml(lane.completion_rule)}</p>
                  ${countTable(objectCountRows(lane.status_counts), "Status")}
                `
              )
              .join("")}
            <h2 class="section-title section-title--spaced">First Batches</h2>
            <ul class="source-list">
              ${(certificationBatches.batches ?? [])
                .slice(0, 25)
                .map(
                  (batch) =>
                    `<li><strong>${escapeHtml(batch.id)}</strong><br><span>${escapeHtml(batch.label)} / ${escapeHtml(batch.records.length)} records / ${escapeHtml(batch.completion_rule)}</span></li>`
                )
                .join("")}
            </ul>
          </div>
          <aside>
            <dl>
              ${dataLine("Snapshot", escapeHtml(certificationBatches.snapshot_id), "mono")}
              ${dataLine("Standard", escapeHtml(certificationBatches.certification_standard_version), "mono")}
              ${dataLine("Records", escapeHtml(certificationBatches.totals.records))}
              ${dataLine("Lanes", escapeHtml(certificationBatches.totals.lanes))}
              ${dataLine("Batches", escapeHtml(certificationBatches.totals.batches))}
              ${dataLine("Batch size", escapeHtml(certificationBatches.batch_size))}
              ${dataLine("Manifest JSON", `<a href="${sitePath("/data/certification-batches.json", 1)}">Download artifact</a>`)}
              ${dataLine("Rules", `<a href="${sitePath("/docs/certification-batch-completion-rules.md", 1)}">Completion rules</a>`)}
              ${sourceFamilyReviewDataLines(1)}
              ${edReviewDataLines(1)}
              ${dataLine("Use limit", escapeHtml(certificationBatches.public_claim_limit))}
            </dl>
          </aside>
        </div>
      </section>
    `,
    1
  )
);

console.log(
  `Generated ${events.length} event pages, ${schools.length} school pages, ${briefs.length} brief pages, ${sources.length} source pages, the review debt dashboard, certification pages, and external review pages.`
);
