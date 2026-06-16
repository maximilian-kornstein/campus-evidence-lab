import { auditProfileForExport, buildAuditProfile } from "./audit-profile.js";
import { hasSubstantiveInstitutionalResponse, responseDepthDisplayProfile, responseDisplayProfile } from "./record-display.js";

const SITE_BASE = new URL("../", import.meta.url);

function sitePath(target) {
  const cleanTarget = String(target).replace(/^\/+/, "");
  if (SITE_BASE.protocol === "file:") return `/${cleanTarget}`;
  const url = new URL(cleanTarget, SITE_BASE);
  return `${url.pathname}${url.search}${url.hash}`;
}

const DATA_PATHS = {
  events: sitePath("/data/events.json"),
  schools: sitePath("/data/schools.json"),
  sources: sitePath("/data/sources.json"),
  briefs: sitePath("/data/briefs.json"),
  corrections: sitePath("/data/corrections.json"),
  reviewLog: sitePath("/data/review-log.json"),
  reviewSamples: sitePath("/data/review-samples.json"),
  reviewLedger: sitePath("/data/review-ledger.json"),
  methodologyExamples: sitePath("/data/methodology-examples.json"),
  workflows: sitePath("/data/workflows.json"),
  releases: sitePath("/data/releases.json"),
  releaseVerification: sitePath("/data/release-verification.json"),
  credibilityStatus: sitePath("/data/credibility-status.json"),
  robustnessMetrics: sitePath("/data/robustness-metrics.json"),
  evidenceDepthQueues: sitePath("/data/evidence-depth-queues.json"),
  goldRecordSet: sitePath("/data/gold-record-set.json"),
  reviewerChallengePack: sitePath("/data/reviewer-challenge-pack.json"),
  evidenceCapsules: sitePath("/data/evidence-capsules.json"),
  sourceProvenanceQueues: sitePath("/data/source-provenance-queues.json"),
  manifest: sitePath("/data/snapshot-manifest.json"),
  snapshotIndex: sitePath("/data/snapshot-index.json"),
  sourceAudit: sitePath("/data/source-audit.json"),
  sourceAuditLive: sitePath("/data/source-audit-live.json"),
  productUpdates: sitePath("/data/product-updates.json"),
  productMilestones: sitePath("/data/product-milestones.json")
};

const MAX_WORKSPACE_HANDOFF = 100;

const state = {
  records: [],
  schoolsList: [],
  briefs: [],
  corrections: [],
  reviewLog: null,
  reviewSamples: null,
  reviewLedger: null,
  methodologyExamples: [],
  workflows: { workflows: [] },
  releases: { releases: [] },
  releaseVerification: null,
  credibilityStatus: { entries: [] },
  robustnessMetrics: null,
  evidenceDepthQueues: { queues: [] },
  goldRecordSet: { records: [] },
  reviewerChallengePack: { records: [] },
  evidenceCapsules: { records: [], totals: {}, import_family_counts: {}, locator_quality_counts: {}, review_need_counts: {} },
  sourceProvenanceQueues: { queues: [] },
  snapshotIndex: null,
  sourceAudit: null,
  sourceAuditLive: null,
  productUpdates: null,
  productMilestones: null,
  schools: new Map(),
  sources: new Map(),
  manifest: null,
  filters: {
    q: "",
    school: "",
    state: "",
    community: "",
    category: "",
    confidence: "",
    sourceType: "",
    verification: "",
    dateFrom: "",
    dateTo: "",
    sort: "date_desc"
  },
  schoolFilters: {
    q: "",
    state: "",
    community: "",
    recordQ: "",
    recordCategory: "",
    sort: "records_desc"
  },
  sourceFilters: {
    q: "",
    sourceType: "",
    publisher: "",
    sort: "records_desc"
  },
  eventFiltersInitialized: false,
  schoolFiltersInitialized: false,
  sourceFiltersInitialized: false,
  selectedId: null
};

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

function byDateDesc(a, b) {
  return b.date.localeCompare(a.date);
}

const confidenceRank = {
  High: 3,
  Medium: 2,
  Low: 1
};

function formatDate(value, precision = "day") {
  if (!value) return "Unknown";
  if (precision === "month") return value.slice(0, 7);
  if (precision === "year") return value.slice(0, 4);
  return value;
}

function shortHash(hash) {
  return hash ? `${hash.slice(0, 18)}...${hash.slice(-8)}` : "Not generated";
}

function join(value) {
  return Array.isArray(value) ? value.join(", ") : value;
}

function unique(values) {
  return [...new Set(values.flat().filter(Boolean))].sort();
}

function countBy(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function monthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) return value;
  const [year, month] = value.split("-");
  return `${year}-${month}`;
}

function barChart(title, note, rows) {
  const max = Math.max(...rows.map(([, count]) => count), 1);
  return `
    <div class="trend-panel" role="img" aria-label="${escapeHtml(`${title}. ${note}`)}">
      <div class="trend-panel__header">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(note)}</p>
      </div>
      <div class="trend-rows">
        ${rows
          .map(([label, count]) => {
            const width = Math.max(4, Math.round((count / max) * 100));
            return `
              <div class="trend-row">
                <span class="trend-label">${escapeHtml(label)}</span>
                <span class="trend-track" aria-hidden="true"><span class="trend-bar" style="width: ${width}%"></span></span>
                <span class="trend-count">${count}</span>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function metric(value, label) {
  return `
    <div class="metric">
      <span class="metric__value">${escapeHtml(value)}</span>
      <span class="metric__label">${escapeHtml(label)}</span>
    </div>
  `;
}

function countRows(rows, firstLabel, secondLabel = "Records") {
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTerms(query) {
  return normalizeSearchText(query)
    .split(" ")
    .map((term) => term.trim())
    .filter(Boolean);
}

const searchAliases = new Map([
  ["antisemitism", ["antisemitism", "antisemitic", "anti semitic", "jewish"]],
  ["antisemitic", ["antisemitic", "antisemitism", "anti semitic", "jewish"]],
  ["jewish", ["jewish", "antisemitism", "antisemitic"]],
  ["asian", ["asian", "aapi", "api"]],
  ["black", ["black", "african american"]],
  ["native", ["native", "indigenous", "american indian"]],
  ["indigenous", ["indigenous", "native", "american indian"]],
  ["latino", ["latino", "latina", "latinx", "hispanic"]],
  ["hispanic", ["hispanic", "latino", "latina", "latinx"]],
  ["lgbtq", ["lgbtq", "lgbtq+", "sexual orientation", "gender identity"]],
  ["muslim", ["muslim", "islam", "islamophobia"]],
  ["arab", ["arab", "middle eastern", "shared ancestry"]],
  ["disability", ["disability", "disabled", "students with disabilities"]]
]);

function aliasesForTerm(term) {
  return searchAliases.get(term) ?? [term];
}

function weightedSearch(record, query, weightedFields) {
  const terms = searchTerms(query);
  if (!terms.length) return { matches: true, score: 0 };

  const fields = weightedFields.map(([value, weight]) => ({
    text: normalizeSearchText(Array.isArray(value) ? value.join(" ") : value),
    weight
  }));
  let score = normalizeSearchText(query) && fields.some((field) => field.text.includes(normalizeSearchText(query))) ? 20 : 0;

  for (const term of terms) {
    const aliases = aliasesForTerm(term).map(normalizeSearchText);
    const matchingFields = fields.filter((field) => aliases.some((alias) => alias && field.text.includes(alias)));
    if (!matchingFields.length) return { matches: false, score: 0 };
    score += Math.max(...matchingFields.map((field) => field.weight));
  }

  return { matches: true, score };
}

function recordWeightedFields(record) {
  const school = record.school ?? {};
  const sourceText = record.sources
    .map((source) => [source.title, source.publisher, source.source_type, source.published_date, source.url].join(" "))
    .join(" ");
  return [
    [record.id, 28],
    [school.name, 24],
    [[school.city, school.state].filter(Boolean).join(" "), 12],
    [record.summary, 22],
    [record.category, 20],
    [record.affected_communities, 20],
    [record.source_types, 16],
    [record.tags, 14],
    [sourceText, 14],
    [record.description, 10],
    [record.institutional_response, 8],
    [record.legal_status, 8],
    [record.verification_status, 6],
    [record.confidence, 4]
  ];
}

function hasDisplayInstitutionalResponse(record) {
  return hasSubstantiveInstitutionalResponse(record);
}

function institutionalResponseSection(record, headingLevel = "h3") {
  const profile = responseDisplayProfile(record);
  if (!profile.shouldShow) return "";
  const responseDepth = responseDepthDisplayProfile(record);
  const details = [
    `<div class="data-line">
      <dt>Response depth</dt>
      <dd>${escapeHtml(responseDepth.label)}</dd>
    </div>`,
    record.response_date
      ? `<div class="data-line">
          <dt>Response date</dt>
          <dd class="mono">${escapeHtml(record.response_date)}</dd>
        </div>`
      : "",
    record.legal_status
      ? `<div class="data-line">
          <dt>Legal status</dt>
          <dd>${escapeHtml(record.legal_status)}</dd>
        </div>`
      : ""
  ]
    .filter(Boolean)
    .join("");
  return `
    <${headingLevel} class="section-title section-title--spaced">${escapeHtml(profile.heading)}</${headingLevel}>
    <p>${escapeHtml(profile.response)}</p>
    ${details ? `<dl>${details}</dl>` : ""}
  `;
}

function sourceWeightedFields(source, events, schoolNames) {
  return [
    [source.id, 26],
    [source.title, 24],
    [source.publisher, 22],
    [source.source_type, 18],
    [source.url, 14],
    [schoolNames, 12],
    [events.map((record) => record.summary), 10],
    [events.map((record) => record.affected_communities).flat(), 10],
    [events.map((record) => record.category), 8]
  ];
}

function selectedEventExport(record) {
  const school = record.school ?? {};
  return {
    id: record.id,
    date: record.date,
    date_precision: record.date_precision,
    school_id: record.school_id,
    school_name: school.name ?? "",
    school_city: school.city ?? "",
    school_state: school.state ?? "",
    category: record.category,
    affected_communities: record.affected_communities,
    confidence: record.confidence,
    verification_status: record.verification_status,
    source_types: record.source_types,
    source_titles: record.sources.map((source) => source.title),
    source_publishers: record.sources.map((source) => source.publisher),
    source_urls: record.sources.map((source) => source.url),
    summary: record.summary,
    description: record.description,
    institutional_response: record.institutional_response,
    legal_status: record.legal_status,
    updated_at: record.updated_at,
    audit_profile: auditProfileForExport(record, record.sources),
    record_hash: record.record_hash
  };
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function recordsToCsv(records) {
  const rows = records.map(selectedEventExport);
  const columns = [
    "id",
    "date",
    "school_name",
    "school_state",
    "category",
    "affected_communities",
    "confidence",
    "verification_status",
    "source_types",
    "source_titles",
    "source_urls",
    "summary",
    "institutional_response",
    "legal_status",
    "updated_at",
    "record_hash"
  ];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
}

function downloadTextFile(filename, mimeType, content) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isTextEntryControl(element) {
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea";
}

function preservedTextInputState() {
  const active = document.activeElement;
  if (!isTextEntryControl(active)) return null;
  const identifier =
    active.id ||
    (active.name ? `${active.tagName.toLowerCase()}[name="${active.name}"]` : null) ||
    active.getAttribute("data-focus-key");
  if (!identifier) return null;
  return {
    selector: active.id ? `#${active.id}` : identifier,
    selectionStart: typeof active.selectionStart === "number" ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === "number" ? active.selectionEnd : null
  };
}

function restoreTextInputState(snapshot) {
  if (!snapshot) return;
  const restore = () => {
    const next = document.querySelector(snapshot.selector);
    if (!isTextEntryControl(next)) return;
    next.focus({ preventScroll: true });
    if (snapshot.selectionStart !== null && snapshot.selectionEnd !== null && typeof next.setSelectionRange === "function") {
      next.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    }
  };
  if (window.requestAnimationFrame) {
    window.requestAnimationFrame(restore);
    return;
  }
  window.setTimeout(restore, 0);
}

function withPreservedTextInputState(render) {
  const snapshot = preservedTextInputState();
  render();
  restoreTextInputState(snapshot);
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function currentAbsoluteUrl() {
  return window.location.href;
}

function workspaceUrlForRecords(records) {
  const ids = records.slice(0, MAX_WORKSPACE_HANDOFF).map((record) => record.id).join(",");
  return sitePath(ids ? `/research-workspace/?record_ids=${encodeURIComponent(ids)}` : "/research-workspace/");
}

function eventCitation(record) {
  const school = record.school ?? {};
  return `${record.id}. ${school.name ?? record.school_id}. "${record.summary}." Campus Evidence Lab, ${state.manifest.snapshot_id}, ${record.record_hash}.`;
}

function sourceCitation(source) {
  return `${source.title}. ${source.publisher}, ${source.published_date}. ${source.url}`;
}

function researchPacket(records, title = "Campus Evidence Lab Research Packet", question = "") {
  const selected = records.map(selectedEventExport);
  const lines = [
    `# ${title}`,
    "",
    question ? `Research question: ${question}` : "Research question: not specified",
    "",
    `Snapshot: ${state.manifest.snapshot_id}`,
    `Snapshot hash: ${state.manifest.hashes.full_snapshot}`,
    `Records selected: ${records.length}`,
    "",
    "Use limits:",
    "- This packet cites public-source documentation, not incident prevalence.",
    "- Record counts are not school rankings, safety scores, or severity scores.",
    "- Absence from the dataset does not mean absence of incidents or institutional response.",
    "",
    "Selected records:",
    ...records.flatMap((record, index) => {
      const auditProfile = buildAuditProfile(record, record.sources);
      return [
        "",
        `${index + 1}. ${eventCitation(record)}`,
        `   Date: ${formatDate(record.date, record.date_precision)}`,
        `   Communities: ${join(record.affected_communities)}`,
        `   Category: ${record.category}`,
        `   Verification: ${record.verification_status}`,
        `   Source basis: ${auditProfile.sourceBasis}`,
        `   Classification rationale: ${auditProfile.classificationRationale}`,
        `   Confidence rationale: ${auditProfile.confidenceRationale}`,
        `   Sources:`,
        ...record.sources.map((source) => `   - ${sourceCitation(source)}`)
      ];
    }),
    "",
    "Machine-readable selection:",
    "```json",
    JSON.stringify(selected, null, 2),
    "```"
  ];
  return lines.join("\n");
}

async function loadDataset() {
  const [
    events,
    schools,
    sources,
    briefs,
    corrections,
    reviewLog,
    reviewSamples,
    reviewLedger,
    methodologyExamples,
    workflows,
    releases,
    releaseVerification,
    credibilityStatus,
    robustnessMetrics,
    evidenceDepthQueues,
    goldRecordSet,
    reviewerChallengePack,
    evidenceCapsules,
    sourceProvenanceQueues,
    manifest,
    snapshotIndex,
    sourceAudit,
    sourceAuditLive,
    productUpdates,
    productMilestones
  ] = await Promise.all([
    fetchJson(DATA_PATHS.events),
    fetchJson(DATA_PATHS.schools),
    fetchJson(DATA_PATHS.sources),
    fetchJson(DATA_PATHS.briefs),
    fetchJson(DATA_PATHS.corrections),
    fetchJson(DATA_PATHS.reviewLog),
    fetchJson(DATA_PATHS.reviewSamples),
    fetchJson(DATA_PATHS.reviewLedger),
    fetchJson(DATA_PATHS.methodologyExamples),
    fetchJson(DATA_PATHS.workflows),
    fetchJson(DATA_PATHS.releases),
    fetchJson(DATA_PATHS.releaseVerification),
    fetchJson(DATA_PATHS.credibilityStatus),
    fetchJson(DATA_PATHS.robustnessMetrics),
    fetchJson(DATA_PATHS.evidenceDepthQueues),
    fetchJson(DATA_PATHS.goldRecordSet),
    fetchJson(DATA_PATHS.reviewerChallengePack),
    fetchJson(DATA_PATHS.evidenceCapsules),
    fetchJson(DATA_PATHS.sourceProvenanceQueues),
    fetchJson(DATA_PATHS.manifest),
    fetchJson(DATA_PATHS.snapshotIndex),
    fetchJson(DATA_PATHS.sourceAudit),
    fetchJson(DATA_PATHS.sourceAuditLive),
    fetchJson(DATA_PATHS.productUpdates),
    fetchJson(DATA_PATHS.productMilestones)
  ]);

  state.schools = new Map(schools.map((school) => [school.id, school]));
  state.schoolsList = schools;
  state.sources = new Map(sources.map((source) => [source.id, source]));
  state.manifest = manifest;
  state.briefs = briefs;
  state.corrections = corrections;
  state.reviewLog = reviewLog;
  state.reviewSamples = reviewSamples;
  state.reviewLedger = reviewLedger;
  state.methodologyExamples = methodologyExamples;
  state.workflows = workflows;
  state.releases = releases;
  state.releaseVerification = releaseVerification;
  state.credibilityStatus = credibilityStatus;
  state.robustnessMetrics = robustnessMetrics;
  state.evidenceDepthQueues = evidenceDepthQueues;
  state.goldRecordSet = goldRecordSet;
  state.reviewerChallengePack = reviewerChallengePack;
  state.evidenceCapsules = evidenceCapsules;
  state.sourceProvenanceQueues = sourceProvenanceQueues;
  state.snapshotIndex = snapshotIndex;
  state.sourceAudit = sourceAudit;
  state.sourceAuditLive = sourceAuditLive;
  state.productUpdates = productUpdates;
  state.productMilestones = productMilestones;
  state.records = events
    .map((event) => ({
      ...event,
      school: state.schools.get(event.school_id),
      sources: event.source_ids.map((id) => state.sources.get(id)).filter(Boolean)
    }))
    .sort(byDateDesc);
}

function schoolStats(schoolId) {
  const records = state.records.filter((record) => record.school_id === schoolId);
  const latestUpdate = records.map((record) => record.updated_at).sort().at(-1) ?? "";
  return {
    records,
    count: records.length,
    latest: records[0]?.date ?? "",
    latestUpdate,
    communities: unique(records.map((record) => record.affected_communities)),
    categories: unique(records.map((record) => [record.category]))
  };
}

function documentationSignals(records) {
  const sourceIds = unique(records.map((record) => record.source_ids));
  const sources = sourceIds.map((id) => state.sources.get(id)).filter(Boolean);
  const sourceTypes = unique(records.map((record) => record.source_types));
  const communities = unique(records.map((record) => record.affected_communities));
  const officialRecords = records.filter((record) =>
    record.sources.some((source) => /government|court|public legal|annual security|public safety/i.test(source.source_type))
  ).length;
  const responseRecords = records.filter(hasDisplayInstitutionalResponse).length;
  const latestRecordDate = records.map((record) => record.date).sort().at(-1) ?? "";
  const latestUpdate = records.map((record) => record.updated_at).sort().at(-1) ?? "";

  return {
    recordCount: records.length,
    sourceCount: sources.length,
    sourceTypeCount: sourceTypes.length,
    communityCount: communities.length,
    officialRecords,
    responseRecords,
    latestRecordDate,
    latestUpdate
  };
}

function documentationSignalRows(signals) {
  return `
    <dl>
      <div class="data-line">
        <dt>Public-source density</dt>
        <dd>${signals.recordCount} record${signals.recordCount === 1 ? "" : "s"}</dd>
      </div>
      <div class="data-line">
        <dt>Source collections</dt>
        <dd>${signals.sourceCount}</dd>
      </div>
      <div class="data-line">
        <dt>Source-type diversity</dt>
        <dd>${signals.sourceTypeCount}</dd>
      </div>
      <div class="data-line">
        <dt>Official-source records</dt>
        <dd>${signals.officialRecords}</dd>
      </div>
      <div class="data-line">
        <dt>Records with public response text</dt>
        <dd>${signals.responseRecords}</dd>
      </div>
      <div class="data-line">
        <dt>Latest public record date</dt>
        <dd class="mono">${escapeHtml(signals.latestRecordDate ? formatDate(signals.latestRecordDate) : "None")}</dd>
      </div>
    </dl>
  `;
}

function reviewNeedLabels(record) {
  const labels = [];
  if (record.confidence === "Low") labels.push("Low-confidence source support");
  if ((record.sources?.length ?? record.source_ids?.length ?? 0) <= 1) labels.push("Single-source record");
  if (!hasDisplayInstitutionalResponse(record)) labels.push("No public institutional response recorded");
  if (record.affected_communities.some((community) => ["Race", "Religion", "National origin", "Ethnicity", "Gender"].includes(community))) {
    labels.push("Broad affected-community label");
  }
  if (/ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(`${record.category} ${record.legal_status}`)) {
    labels.push("Legal/OCR status review");
  }
  return labels;
}

function schoolReviewNeeds(records) {
  const rows = countBy(records.flatMap(reviewNeedLabels), (label) => label);
  return rows.length ? rows : [["No priority review flags", 0]];
}

function setCurrentNav() {
  const page = document.body.dataset.page;
  for (const link of document.querySelectorAll(".nav a")) {
    if (link.dataset.nav === page) {
      link.setAttribute("aria-current", "page");
    }
  }
}

function renderDashboard() {
  const root = document.querySelector("#dashboard-root");
  if (!root) return;

  const communities = unique(state.records.map((record) => record.affected_communities));
  const schoolsTracked = new Set(state.records.map((record) => record.school_id)).size;
  const statesRepresented = unique(state.records.map((record) => [record.school?.state]));
  const latestUpdate = state.records.map((record) => record.updated_at).sort().at(-1);
  const latestBrief = [...state.briefs].sort((a, b) => b.published_date.localeCompare(a.published_date))[0];
  const signals = documentationSignals(state.records);
  const recentRows = state.records.slice(0, 5).map(dashboardEventRow).join("");
  const recordsByMonth = countBy(state.records, (record) => record.date.slice(0, 7))
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)
    .map(([label, count]) => [monthLabel(label), count]);
  const recordsByCommunity = countBy(
    state.records.flatMap((record) => record.affected_communities),
    (community) => community
  ).slice(0, 8);
  const recordsBySourceType = countBy(
    state.records.flatMap((record) => record.source_types),
    (sourceType) => sourceType
  ).slice(0, 8);

  root.innerHTML = `
    <section class="section section--tight" aria-label="Dataset metrics">
      <div class="metric-grid metric-grid--dashboard">
        <div class="metric">
          <span class="metric__value">${state.records.length}</span>
          <span class="metric__label">Public-source records</span>
        </div>
        <div class="metric">
          <span class="metric__value">${schoolsTracked}</span>
          <span class="metric__label">Schools tracked</span>
        </div>
        <div class="metric">
          <span class="metric__value">${communities.length}</span>
          <span class="metric__label">Communities represented</span>
        </div>
        <div class="metric">
          <span class="metric__value">${statesRepresented.length}</span>
          <span class="metric__label">States and jurisdictions represented</span>
        </div>
        <div class="metric">
          <span class="metric__value">${latestUpdate ? formatDate(latestUpdate) : "None"}</span>
          <span class="metric__label">Latest dataset update</span>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Dataset Status</h2>
        <p class="section-note">Schema ${escapeHtml(state.manifest.schema_version)}</p>
      </div>
      <dl>
        <div class="data-line">
          <dt>Snapshot</dt>
          <dd class="mono">${escapeHtml(state.manifest.snapshot_id)}</dd>
        </div>
        <div class="data-line">
          <dt>Snapshot hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.full_snapshot)}</dd>
        </div>
        <div class="data-line">
          <dt>Current scope</dt>
          <dd>Campus civil-rights records across shared ancestry, race, national origin, sex, pregnancy, disability, and athletic-equity categories.</dd>
        </div>
      </dl>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Documentation Signals</h2>
        <p class="section-note">Public documentation density and auditability; not safety scores, school rankings, or incident prevalence.</p>
      </div>
      ${documentationSignalRows(signals)}
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Audience Entry Points</h2>
        <p class="section-note">Start with the narrowest useful path</p>
      </div>
      <div class="action-grid">
        <a class="action-link" href="${sitePath("/journalist-guide/")}">
          <span>Journalist Path</span>
          <span>Start with one school, one record, or one reporting packet before moving into the full dataset.</span>
        </a>
        <a class="action-link" href="${sitePath("/research-guide/")}">
          <span>Research Path</span>
          <span>Use documentation signals, citation rules, and comparison limits before exporting broader files.</span>
        </a>
        <a class="action-link" href="${sitePath("/trust/")}">
          <span>Reviewer Path</span>
          <span>Inspect methodology, sample records, and audit artifacts without treating review as endorsement.</span>
        </a>
        <a class="action-link" href="${sitePath("/downloads/")}">
          <span>Data Path</span>
          <span>Choose the smallest useful artifact: packet, CSV, research JSON, manifest, or archived snapshot.</span>
        </a>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Research Entry Points</h2>
        <p class="section-note">Search, brief, methodology, data</p>
      </div>
      <div class="action-grid">
        <a class="action-link" href="${sitePath("/events/")}">
          <span>Search Event Database</span>
          <span>Filter by school, state, community, category, source type, date, confidence, and verification.</span>
        </a>
        <a class="action-link" href="${sitePath(latestBrief ? `/briefs/${encodeURIComponent(latestBrief.id)}/` : "/briefs/")}">
          <span>Latest Weekly Brief</span>
          <span>${latestBrief ? escapeHtml(`${latestBrief.title} / ${latestBrief.published_date}`) : "Open published research briefs."}</span>
        </a>
        <a class="action-link" href="${sitePath("/methodology/")}">
          <span>Read Methodology</span>
          <span>Review inclusion rules, source standards, confidence scoring, privacy limits, and corrections.</span>
        </a>
        <a class="action-link" href="${sitePath("/impact/")}">
          <span>Impact Page</span>
          <span>Inspect current reach, research infrastructure, accountability signals, and partnership status.</span>
        </a>
        <a class="action-link" href="${sitePath("/updates/")}">
          <span>Product Updates</span>
          <span>Inspect visible archive, workflow, and interface improvements through a separate weekly consistency log.</span>
        </a>
        <a class="action-link" href="${sitePath("/trust/")}">
          <span>Trust & Review Packet</span>
          <span>Give outside reviewers a compact path to audit methodology, sources, classifications, and responsible-use limits.</span>
        </a>
        <a class="action-link" href="${sitePath("/reviewer-brief/")}">
          <span>Reviewer Brief</span>
          <span>Use the short external-review packet with 10 sample records, three questions, and acknowledgment boundaries.</span>
        </a>
        <a class="action-link" href="${sitePath("/guide/")}">
          <span>Contributor Guide</span>
          <span>Submit public sources, corrections, duplicate reports, and reviewer feedback without private evidence.</span>
        </a>
        <a class="action-link" href="${sitePath("/research-guide/")}">
          <span>Research Guide</span>
          <span>Use the archive responsibly without turning public documentation into school rankings or safety claims.</span>
        </a>
        <a class="action-link" href="${sitePath("/research-workspace/")}">
          <span>Research Workspace</span>
          <span>Select records and generate a citation packet with source URLs, snapshot hash, and use limits.</span>
        </a>
        <a class="action-link" href="${sitePath("/reviewer-queue/")}">
          <span>Reviewer Queue</span>
          <span>Find records and source families that most need methodology, classification, or source-audit review.</span>
        </a>
        <a class="action-link" href="${sitePath("/downloads/")}">
          <span>Download Data</span>
          <span>Use JSON, CSV, snapshots, changelog, source audit, citation guidance, and schemas.</span>
        </a>
      </div>
    </section>

    <section class="section" aria-labelledby="trend-charts-title">
      <div class="section-header">
        <h2 class="section-title" id="trend-charts-title">Trend Charts</h2>
        <p class="section-note">Small charts summarize current public records, not incident prevalence.</p>
      </div>
      <div class="trend-grid">
        ${barChart("Records by Event Month", "Counts by dated public records in the current dataset.", recordsByMonth)}
        ${barChart("Records by Affected Community", "Records may represent more than one affected community.", recordsByCommunity)}
        ${barChart("Records by Source Type", "Source types represented across published records.", recordsBySourceType)}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Recent Records</h2>
        <p class="section-note"><a href="${sitePath("/events/")}">Open database</a></p>
      </div>
      <div class="table-wrap">
        <table class="record-table record-table--dashboard">
          <thead>
            <tr>
              <th>Date</th>
              <th>School</th>
              <th>Category</th>
              <th>Summary</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function dashboardEventRow(record) {
  const school = record.school ?? { name: "Unknown", state: "" };
  return `
    <tr>
      <td class="mono" data-label="Date">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
      <td data-label="School">${escapeHtml(school.name)}<br><span class="section-note">${escapeHtml(school.state)}</span></td>
      <td data-label="Category">${escapeHtml(record.category)}</td>
      <td class="summary-cell" data-label="Summary"><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
      <td data-label="Confidence"><span class="status">${escapeHtml(record.confidence)}</span></td>
    </tr>
  `;
}

function eventRow(record, selectedId = null) {
  const school = record.school ?? { name: "Unknown", state: "" };
  const selected = selectedId === record.id ? " class=\"is-selected\"" : "";
  return `
    <tr${selected}>
      <td class="mono" data-label="Date">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
      <td data-label="School">${escapeHtml(school.name)}</td>
      <td data-label="State">${escapeHtml(school.state)}</td>
      <td data-label="Category">${escapeHtml(record.category)}</td>
      <td data-label="Community">${escapeHtml(join(record.affected_communities))}</td>
      <td class="summary-cell" data-label="Summary"><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
      <td data-label="Verification">${escapeHtml(record.verification_status)}</td>
      <td data-label="Confidence"><span class="status">${escapeHtml(record.confidence)}</span></td>
      <td data-label="Sources">${record.sources.length}</td>
      <td class="mono" data-label="Updated">${escapeHtml(record.updated_at)}</td>
    </tr>
  `;
}

function sourceDetailHref(source) {
  return sitePath(`/sources/${encodeURIComponent(source.id)}/`);
}

function renderSelectOptions(values, selected, label) {
  return `<option value="">${label}</option>${values
    .map((value) => `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`)
    .join("")}`;
}

function renderOptionPairs(options, selected, label) {
  return `<option value="">${label}</option>${options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}"${option.value === selected ? " selected" : ""}>${escapeHtml(option.label)}</option>`
    )
    .join("")}`;
}

function initializeEventFiltersFromUrl() {
  if (state.eventFiltersInitialized) return;
  const params = new URLSearchParams(window.location.search);
  state.filters = {
    ...state.filters,
    q: params.get("q") || "",
    school: params.get("school") || "",
    state: params.get("state") || "",
    community: params.get("community") || "",
    category: params.get("category") || "",
    confidence: params.get("confidence") || "",
    sourceType: params.get("source_type") || "",
    verification: params.get("verification") || "",
    dateFrom: params.get("date_from") || "",
    dateTo: params.get("date_to") || "",
    sort: params.get("sort") || state.filters.sort
  };
  state.eventFiltersInitialized = true;
}

function filteredRecords() {
  const query = state.filters.q.trim();
  return state.records
    .map((record) => ({ record, search: weightedSearch(record, query, recordWeightedFields(record)) }))
    .filter(({ record, search }) => {
    const school = record.school ?? {};

    if (query && !search.matches) return false;
    if (state.filters.school && record.school_id !== state.filters.school) return false;
    if (state.filters.state && school.state !== state.filters.state) return false;
    if (state.filters.community && !record.affected_communities.includes(state.filters.community)) return false;
    if (state.filters.category && record.category !== state.filters.category) return false;
    if (state.filters.confidence && record.confidence !== state.filters.confidence) return false;
    if (state.filters.sourceType && !record.source_types.includes(state.filters.sourceType)) return false;
    if (state.filters.verification && record.verification_status !== state.filters.verification) return false;
    if (state.filters.dateFrom && record.date < state.filters.dateFrom) return false;
    if (state.filters.dateTo && record.date > state.filters.dateTo) return false;
    return true;
  })
    .map(({ record, search }) => ({ ...record, search_score: search.score }));
}

function sortedRecords(records) {
  return [...records].sort((a, b) => {
    switch (state.filters.sort) {
      case "relevance":
        return (b.search_score ?? 0) - (a.search_score ?? 0) || byDateDesc(a, b);
      case "date_asc":
        return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
      case "school_asc":
        return (a.school?.name ?? "").localeCompare(b.school?.name ?? "") || byDateDesc(a, b);
      case "updated_desc":
        return b.updated_at.localeCompare(a.updated_at) || byDateDesc(a, b);
      case "confidence_desc":
        return (confidenceRank[b.confidence] ?? 0) - (confidenceRank[a.confidence] ?? 0) || byDateDesc(a, b);
      case "date_desc":
      default:
        return byDateDesc(a, b) || a.id.localeCompare(b.id);
    }
  });
}

function renderEvents() {
  const root = document.querySelector("#events-root");
  if (!root) return;

  initializeEventFiltersFromUrl();
  const params = new URLSearchParams(window.location.search);
  state.selectedId = params.get("id") || state.selectedId || state.records[0]?.id;

  const schools = state.schoolsList
    .map((school) => ({ value: school.id, label: school.name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const states = unique(state.records.map((record) => [record.school?.state]));
  const communities = unique(state.records.map((record) => record.affected_communities));
  const categories = unique(state.records.map((record) => [record.category]));
  const confidences = unique(state.records.map((record) => [record.confidence]));
  const sourceTypes = unique(state.records.map((record) => record.source_types));
  const verificationStatuses = unique(state.records.map((record) => [record.verification_status]));
  const sortOptions = [
    { value: "relevance", label: "Search relevance" },
    { value: "date_desc", label: "Newest date" },
    { value: "date_asc", label: "Oldest date" },
    { value: "school_asc", label: "School A-Z" },
    { value: "updated_desc", label: "Recently updated" },
    { value: "confidence_desc", label: "Confidence high-low" }
  ];
  const results = sortedRecords(filteredRecords());
  if (!results.some((record) => record.id === state.selectedId)) {
    state.selectedId = results[0]?.id ?? null;
  }

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Search</h2>
        <p class="section-note">${results.length} of ${state.records.length} records</p>
      </div>
      <form class="toolbar" id="event-filter-form">
        <input id="q" name="q" type="search" value="${escapeHtml(state.filters.q)}" placeholder="Search records" aria-label="Search records">
        <select id="school" name="school" aria-label="Filter by school">${renderOptionPairs(schools, state.filters.school, "School")}</select>
        <select id="state" name="state" aria-label="Filter by state">${renderSelectOptions(states, state.filters.state, "State")}</select>
        <select id="community" name="community" aria-label="Filter by community">${renderSelectOptions(communities, state.filters.community, "Community")}</select>
        <select id="category" name="category" aria-label="Filter by category">${renderSelectOptions(categories, state.filters.category, "Category")}</select>
        <select id="confidence" name="confidence" aria-label="Filter by confidence">${renderSelectOptions(confidences, state.filters.confidence, "Confidence")}</select>
        <select id="source_type" name="source_type" aria-label="Filter by source type">${renderSelectOptions(sourceTypes, state.filters.sourceType, "Source type")}</select>
        <select id="verification" name="verification" aria-label="Filter by verification status">${renderSelectOptions(verificationStatuses, state.filters.verification, "Verification")}</select>
        <input id="date_from" name="date_from" type="date" value="${escapeHtml(state.filters.dateFrom)}" aria-label="Filter from date">
        <input id="date_to" name="date_to" type="date" value="${escapeHtml(state.filters.dateTo)}" aria-label="Filter to date">
        <select id="sort" name="sort" aria-label="Sort records">${renderOptionPairs(sortOptions, state.filters.sort, "Sort")}</select>
      </form>
      <div class="utility-bar" aria-label="Filtered dataset actions">
        <button type="button" id="copy-event-search-link">Copy Share Link</button>
        <button type="button" id="download-filtered-json">Download Filtered JSON</button>
        <button type="button" id="download-filtered-csv">Download Filtered CSV</button>
        <a class="button-link" href="${workspaceUrlForRecords(results)}">Open Research Workspace</a>
        <span id="event-filter-status" class="section-note" role="status">${results.length > MAX_WORKSPACE_HANDOFF ? `Workspace opens first ${MAX_WORKSPACE_HANDOFF} records` : "Shareable filters are in the URL"}</span>
      </div>
      <p class="section-note download-inline">Download full dataset: <a href="${sitePath("/data/events.json")}" download>Events JSON</a> / <a href="${sitePath("/data/events.csv")}" download>Events CSV</a> / <a href="${sitePath("/data/events-research.json")}" download>Research JSON</a> / <a href="${sitePath("/data/events-research.csv")}" download>Research CSV</a></p>
    </section>

    <section class="section section--tight">
      <div class="table-wrap">
        <table class="record-table record-table--events">
          <thead>
            <tr>
              <th>Date</th>
              <th>School</th>
              <th>State</th>
              <th>Category</th>
              <th>Community</th>
              <th>Summary</th>
              <th>Verification</th>
              <th>Confidence</th>
              <th>Sources</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${results.length ? results.map((record) => eventRow(record, state.selectedId)).join("") : `<tr><td colspan="10" class="empty">No records match the current filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="detail-panel" id="event-detail" aria-live="polite"></section>
  `;

  const form = document.querySelector("#event-filter-form");
  form.addEventListener("input", updateFilters);
  form.addEventListener("change", updateFilters);
  document.querySelector("#copy-event-search-link").addEventListener("click", copyEventSearchLink);
  document.querySelector("#download-filtered-json").addEventListener("click", () => downloadFilteredEvents("json"));
  document.querySelector("#download-filtered-csv").addEventListener("click", () => downloadFilteredEvents("csv"));
  renderEventDetail();
}

function updateEventsUrl() {
  const params = new URLSearchParams();
  for (const [key, value] of [
    ["q", state.filters.q],
    ["school", state.filters.school],
    ["state", state.filters.state],
    ["community", state.filters.community],
    ["category", state.filters.category],
    ["confidence", state.filters.confidence],
    ["source_type", state.filters.sourceType],
    ["verification", state.filters.verification],
    ["date_from", state.filters.dateFrom],
    ["date_to", state.filters.dateTo],
    ["sort", state.filters.sort === "date_desc" ? "" : state.filters.sort]
  ]) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  window.history.replaceState(null, "", sitePath(query ? `/events/?${query}` : "/events/"));
}

function updateFilters(event) {
  const form = event.currentTarget;
  const formData = new FormData(form);
  state.filters = {
    q: String(formData.get("q") || ""),
    school: String(formData.get("school") || ""),
    state: String(formData.get("state") || ""),
    community: String(formData.get("community") || ""),
    category: String(formData.get("category") || ""),
    confidence: String(formData.get("confidence") || ""),
    sourceType: String(formData.get("source_type") || ""),
    verification: String(formData.get("verification") || ""),
    dateFrom: String(formData.get("date_from") || ""),
    dateTo: String(formData.get("date_to") || ""),
    sort: String(formData.get("sort") || "date_desc")
  };
  updateEventsUrl();
  withPreservedTextInputState(renderEvents);
}

async function copyEventSearchLink() {
  const status = document.querySelector("#event-filter-status");
  try {
    await copyText(currentAbsoluteUrl());
    if (status) status.textContent = "Search link copied";
  } catch {
    if (status) status.textContent = "Copy failed; use the browser address bar";
  }
}

function downloadFilteredEvents(format) {
  const records = sortedRecords(filteredRecords());
  const stamp = state.manifest.snapshot_id.replace(/^snapshot_/, "");
  if (format === "csv") {
    downloadTextFile(`campus-evidence-lab-filtered-${stamp}.csv`, "text/csv;charset=utf-8", recordsToCsv(records));
    return;
  }
  const payload = {
    generated_at: new Date().toISOString(),
    snapshot_id: state.manifest.snapshot_id,
    snapshot_hash: state.manifest.hashes.full_snapshot,
    filters: state.filters,
    record_count: records.length,
    records: records.map(selectedEventExport)
  };
  downloadTextFile(`campus-evidence-lab-filtered-${stamp}.json`, "application/json;charset=utf-8", JSON.stringify(payload, null, 2));
}

function renderEventDetail() {
  const panel = document.querySelector("#event-detail");
  if (!panel) return;

  const record = state.records.find((item) => item.id === state.selectedId) ?? filteredRecords()[0];
  if (!record) {
    panel.innerHTML = "";
    return;
  }

  const school = record.school ?? { name: "Unknown", state: "" };
  panel.innerHTML = `
    <div class="detail-grid">
      <div>
        <p class="page-kicker">${escapeHtml(record.id)}</p>
        <h2>${escapeHtml(record.summary)}</h2>
        <p>${escapeHtml(record.description)}</p>
        ${institutionalResponseSection(record)}
        <dl>
          ${
            !responseDisplayProfile(record).shouldShow
              ? `<div class="data-line">
                  <dt>Response depth</dt>
                  <dd>${escapeHtml(responseDepthDisplayProfile(record).label)}</dd>
                </div>
                <div class="data-line">
                  <dt>Legal status</dt>
                  <dd>${escapeHtml(record.legal_status)}</dd>
                </div>`
              : ""
          }
          <div class="data-line">
            <dt>Last updated</dt>
            <dd class="mono">${escapeHtml(record.updated_at)}</dd>
          </div>
          <div class="data-line">
            <dt>Verification rationale</dt>
            <dd>${escapeHtml(verificationRationale(record))}</dd>
          </div>
          <div class="data-line">
            <dt>Record hash</dt>
            <dd class="mono">${escapeHtml(record.record_hash)}</dd>
          </div>
        </dl>
        ${recordAuditCard(record)}
      </div>
      <aside>
        <dl>
          <div class="data-line">
            <dt>School</dt>
            <dd>${escapeHtml(school.name)}</dd>
          </div>
          <div class="data-line">
            <dt>Date</dt>
            <dd class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</dd>
          </div>
          <div class="data-line">
            <dt>Community</dt>
            <dd>${escapeHtml(join(record.affected_communities))}</dd>
          </div>
          <div class="data-line">
            <dt>Status</dt>
            <dd>${escapeHtml(record.verification_status)}</dd>
          </div>
          <div class="data-line">
            <dt>Confidence</dt>
            <dd>${escapeHtml(record.confidence)}</dd>
          </div>
        </dl>
        <h3 class="section-title">Sources</h3>
        <ul class="source-list">
          ${record.sources
            .map(
              (source) => `
                <li>
                  <a href="${sourceDetailHref(source)}">${escapeHtml(source.title)}</a>
                  <br><span class="section-note">${escapeHtml(source.publisher)} / ${escapeHtml(source.source_type)} / ${escapeHtml(source.published_date)}</span>
                  <br><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">External source URL</a>
                </li>
              `
            )
            .join("")}
        </ul>
        <h3 class="section-title section-title--spaced">Correction</h3>
        <p><a href="${sitePath(`/submit/?record_id=${encodeURIComponent(record.id)}`)}">Request a source-backed correction</a></p>
        <h3 class="section-title section-title--spaced">Changelog</h3>
        <ul class="source-list">
          ${record.changelog
            .map(
              (entry) => `
                <li>
                  <span class="mono">${escapeHtml(entry.date)}</span>
                  <br>${escapeHtml(entry.note)}
                </li>
              `
            )
            .join("")}
        </ul>
      </aside>
    </div>
  `;
}

function renderSchools() {
  const root = document.querySelector("#schools-root");
  if (!root) return;

  initializeSchoolFiltersFromUrl();
  let selectedId = new URLSearchParams(window.location.search).get("id") || state.schoolsList[0]?.id;
  const allRows = state.schoolsList.map((school) => ({ school, stats: schoolStats(school.id) }));
  const states = unique(state.schoolsList.map((school) => [school.state]));
  const communities = unique(allRows.map(({ stats }) => stats.communities));
  const sortOptions = [
    { value: "relevance", label: "Search relevance" },
    { value: "records_desc", label: "Most records" },
    { value: "name_asc", label: "School A-Z" },
    { value: "latest_desc", label: "Most recent update" }
  ];
  const rows = sortedSchoolRows(
    allRows
      .filter(({ school }) => {
        const query = state.schoolFilters.q.trim().toLowerCase();
        const schoolCommunities = schoolStats(school.id).communities.join(" ").toLowerCase();
        if (query && ![school.name, school.city, school.state, school.id, schoolCommunities].join(" ").toLowerCase().includes(query)) {
          return false;
        }
        if (state.schoolFilters.state && school.state !== state.schoolFilters.state) return false;
        if (state.schoolFilters.community && !schoolStats(school.id).communities.includes(state.schoolFilters.community)) return false;
        return true;
      })
  );
  if (!rows.some(({ school }) => school.id === selectedId)) {
    selectedId = rows[0]?.school.id ?? null;
  }

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Tracked Schools</h2>
        <p class="section-note">${rows.length} of ${state.schoolsList.length} schools</p>
      </div>
      <form class="toolbar toolbar--compact" id="school-filter-form">
        <input id="school_q" name="q" type="search" value="${escapeHtml(state.schoolFilters.q)}" placeholder="Search schools" aria-label="Search schools">
        <select id="school_state" name="state" aria-label="Filter schools by state">${renderSelectOptions(states, state.schoolFilters.state, "State")}</select>
        <select id="school_community" name="community" aria-label="Filter schools by community">${renderSelectOptions(communities, state.schoolFilters.community, "Community")}</select>
        <select id="school_sort" name="sort" aria-label="Sort schools">${renderOptionPairs(sortOptions, state.schoolFilters.sort, "Sort")}</select>
      </form>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>School</th>
              <th>State</th>
              <th>Records</th>
              <th>Communities</th>
              <th>Latest</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
              .map(
                ({ school, stats }) => `
                  <tr${school.id === selectedId ? " class=\"is-selected\"" : ""}>
                    <td><a href="${sitePath(`/schools/${encodeURIComponent(school.id)}/`)}">${escapeHtml(school.name)}</a></td>
                    <td>${escapeHtml(school.state)}</td>
                    <td>${stats.count}</td>
                    <td>${escapeHtml(stats.communities.join(", ") || "None")}</td>
                    <td class="mono">${escapeHtml(stats.latest || "None")}</td>
                    <td class="mono">${escapeHtml(stats.latestUpdate || "None")}</td>
                  </tr>
                `
              )
                  .join("")
                : `<tr><td colspan="6" class="empty">No schools match the current filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="detail-panel" id="school-detail"></section>
  `;

  const form = document.querySelector("#school-filter-form");
  form.addEventListener("input", updateSchoolFilters);
  form.addEventListener("change", updateSchoolFilters);
  renderSchoolDetail(selectedId);
}

function initializeSchoolFiltersFromUrl() {
  if (state.schoolFiltersInitialized) return;
  const params = new URLSearchParams(window.location.search);
  state.schoolFilters = {
    q: params.get("q") || "",
    state: params.get("state") || "",
    community: params.get("community") || "",
    recordQ: params.get("record_q") || "",
    recordCategory: params.get("record_category") || "",
    sort: params.get("sort") || state.schoolFilters.sort
  };
  state.schoolFiltersInitialized = true;
}

function sortedSchoolRows(rows) {
  return [...rows].sort((a, b) => {
    switch (state.schoolFilters.sort) {
      case "name_asc":
        return a.school.name.localeCompare(b.school.name);
      case "latest_desc":
        return b.stats.latestUpdate.localeCompare(a.stats.latestUpdate) || a.school.name.localeCompare(b.school.name);
      case "records_desc":
      default:
        return b.stats.count - a.stats.count || a.school.name.localeCompare(b.school.name);
    }
  });
}

function updateSchoolsUrl() {
  const params = new URLSearchParams();
  if (state.schoolFilters.q) params.set("q", state.schoolFilters.q);
  if (state.schoolFilters.state) params.set("state", state.schoolFilters.state);
  if (state.schoolFilters.community) params.set("community", state.schoolFilters.community);
  if (state.schoolFilters.recordQ) params.set("record_q", state.schoolFilters.recordQ);
  if (state.schoolFilters.recordCategory) params.set("record_category", state.schoolFilters.recordCategory);
  if (state.schoolFilters.sort !== "records_desc") params.set("sort", state.schoolFilters.sort);
  const query = params.toString();
  window.history.replaceState(null, "", sitePath(query ? `/schools/?${query}` : "/schools/"));
}

function updateSchoolFilters(event) {
  const formData = new FormData(event.currentTarget);
  state.schoolFilters = {
    q: String(formData.get("q") || ""),
    state: String(formData.get("state") || ""),
    community: String(formData.get("community") || ""),
    recordQ: state.schoolFilters.recordQ,
    recordCategory: state.schoolFilters.recordCategory,
    sort: String(formData.get("sort") || "records_desc")
  };
  updateSchoolsUrl();
  withPreservedTextInputState(renderSchools);
}

function updateSchoolRecordFilters(event) {
  const formData = new FormData(event.currentTarget);
  state.schoolFilters = {
    ...state.schoolFilters,
    community: String(formData.get("community") || ""),
    recordQ: String(formData.get("record_q") || ""),
    recordCategory: String(formData.get("record_category") || "")
  };
  updateSchoolsUrl();
  withPreservedTextInputState(renderSchools);
}

function schoolEventsHref(schoolId, options = {}) {
  const params = new URLSearchParams();
  params.set("school", schoolId);
  if (options.community) params.set("community", options.community);
  if (options.category) params.set("category", options.category);
  if (options.q) params.set("q", options.q);
  return sitePath(`/events/?${params.toString()}`);
}

function initializeSourceFiltersFromUrl() {
  if (state.sourceFiltersInitialized) return;
  const params = new URLSearchParams(window.location.search);
  state.sourceFilters = {
    q: params.get("q") || "",
    sourceType: params.get("source_type") || "",
    publisher: params.get("publisher") || "",
    sort: params.get("sort") || state.sourceFilters.sort
  };
  state.sourceFiltersInitialized = true;
}

function sourceRows() {
  const query = state.sourceFilters.q.trim();
  return [...state.sources.values()]
    .map((source) => {
      const events = state.records.filter((record) => record.source_ids.includes(source.id));
      const schoolNames = unique(events.map((record) => [record.school?.name]));
      const search = weightedSearch(source, query, sourceWeightedFields(source, events, schoolNames));

      return {
        source,
        events,
        schools: schoolNames,
        latestEventDate: events.map((record) => record.date).sort().at(-1) ?? "",
        audit: state.sourceAudit?.entries?.find((entry) => entry.source_id === source.id),
        search_score: search.score,
        search_matches: search.matches
      };
    })
    .filter(({ source, search_matches }) => {
      if (query && !search_matches) return false;
      if (state.sourceFilters.sourceType && source.source_type !== state.sourceFilters.sourceType) return false;
      if (state.sourceFilters.publisher && source.publisher !== state.sourceFilters.publisher) return false;
      return true;
    });
}

function sortedSourceRows(rows) {
  return [...rows].sort((a, b) => {
    switch (state.sourceFilters.sort) {
      case "relevance":
        return (b.search_score ?? 0) - (a.search_score ?? 0) || b.events.length - a.events.length;
      case "publisher_asc":
        return a.source.publisher.localeCompare(b.source.publisher) || a.source.title.localeCompare(b.source.title);
      case "date_desc":
        return b.source.published_date.localeCompare(a.source.published_date) || a.source.title.localeCompare(b.source.title);
      case "title_asc":
        return a.source.title.localeCompare(b.source.title);
      case "records_desc":
      default:
        return b.events.length - a.events.length || a.source.publisher.localeCompare(b.source.publisher);
    }
  });
}

function updateSourcesUrl() {
  const params = new URLSearchParams();
  if (state.sourceFilters.q) params.set("q", state.sourceFilters.q);
  if (state.sourceFilters.sourceType) params.set("source_type", state.sourceFilters.sourceType);
  if (state.sourceFilters.publisher) params.set("publisher", state.sourceFilters.publisher);
  if (state.sourceFilters.sort !== "records_desc") params.set("sort", state.sourceFilters.sort);
  const query = params.toString();
  window.history.replaceState(null, "", sitePath(query ? `/sources/?${query}` : "/sources/"));
}

function updateSourceFilters(event) {
  const formData = new FormData(event.currentTarget);
  state.sourceFilters = {
    q: String(formData.get("q") || ""),
    sourceType: String(formData.get("source_type") || ""),
    publisher: String(formData.get("publisher") || ""),
    sort: String(formData.get("sort") || "records_desc")
  };
  updateSourcesUrl();
  withPreservedTextInputState(renderSources);
}

function recordsByNeed(records, predicate) {
  return records.filter(predicate);
}

function schoolPacketLink(label, records, question) {
  if (!records.length) return "";
  const ids = records
    .map((record) => record.id)
    .slice(0, MAX_WORKSPACE_HANDOFF)
    .join(",");
  const params = new URLSearchParams();
  params.set("record_ids", ids);
  params.set("title", `Campus Evidence Lab ${label}`);
  params.set("question", question);
  return sitePath(`/research-workspace/?${params.toString()}`);
}

function renderSchoolDetail(schoolId) {
  const panel = document.querySelector("#school-detail");
  if (!panel) return;

  const school = state.schools.get(schoolId);
  if (!school) {
    panel.innerHTML = "";
    return;
  }

  const stats = schoolStats(schoolId);
  const communities = unique(stats.records.map((record) => record.affected_communities));
  const categories = unique(stats.records.map((record) => [record.category]));
  const filteredRecords = stats.records.filter((record) => {
    const query = state.schoolFilters.recordQ.trim().toLowerCase();
    const haystack = [
      record.summary,
      record.description,
      record.legal_status,
      record.institutional_response,
      join(record.affected_communities),
      record.category
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (state.schoolFilters.community && !record.affected_communities.includes(state.schoolFilters.community)) return false;
    if (state.schoolFilters.recordCategory && record.category !== state.schoolFilters.recordCategory) return false;
    return true;
  });
  const sourceIds = unique(filteredRecords.map((record) => record.source_ids));
  const sources = sourceIds.map((id) => state.sources.get(id)).filter(Boolean);
  const responseRecords = filteredRecords.filter(hasDisplayInstitutionalResponse);
  const signals = documentationSignals(stats.records);
  const legalRecords = filteredRecords.filter((record) =>
    /ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(`${record.category} ${record.legal_status}`)
  );
  const reviewNeedRecords = recordsByNeed(stats.records, (record) => reviewNeedLabels(record).length > 0);
  const dossierPackets = [
    [
      "Dossier packet",
      schoolPacketLink(`${school.name} Dossier Packet`, stats.records, "What public-source records exist for this school in the current snapshot?")
    ],
    [
      "Legal/OCR packet",
      schoolPacketLink(`${school.name} Legal/OCR Packet`, legalRecords, "Which public legal or OCR records are documented for this school?")
    ],
    [
      "Response packet",
      schoolPacketLink(`${school.name} Institutional Response Packet`, responseRecords, "Which public institutional responses are documented for this school?")
    ],
    [
      "Review-needs packet",
      schoolPacketLink(`${school.name} Review Needs Packet`, reviewNeedRecords, "Which records in this school dossier most need source, classification, or use-limit review?")
    ]
  ].filter(([, href]) => href);
  const filteredEventsLink = schoolEventsHref(school.id, {
    community: state.schoolFilters.community,
    category: state.schoolFilters.recordCategory,
    q: state.schoolFilters.recordQ
  });
  const jewishLink = communities.includes("Jewish")
    ? `<a class="button-link" href="${schoolEventsHref(school.id, { community: "Jewish" })}">Open Jewish records in Events</a>`
    : "";
  const antisemitismLink = `<a class="button-link" href="${schoolEventsHref(school.id, { q: "antisemitism" })}">Open antisemitism search in Events</a>`;

  panel.innerHTML = `
    <div class="detail-grid">
      <div>
        <p class="page-kicker">${escapeHtml(school.state)} / ${escapeHtml(school.city)}</p>
        <h2>${escapeHtml(school.name)} Dossier</h2>
        <p>${stats.count} public-source record${stats.count === 1 ? "" : "s"} in the current dataset. This dossier describes public documentation, not school safety, quality of life, or incident prevalence.</p>
        <div class="utility-bar">
          <a class="button-link" href="${filteredEventsLink}">Open Filtered Records</a>
          <a class="button-link" href="${workspaceUrlForRecords(stats.records)}">Build Citation Packet</a>
          <a class="button-link" href="${sitePath(`/submit/?record_id=${encodeURIComponent(stats.records[0]?.id ?? "")}`)}">Request Correction</a>
        </div>
        <h3 class="section-title section-title--spaced">Dossier Packets</h3>
        <div class="utility-bar">
          ${dossierPackets.map(([label, href]) => `<a class="button-link" href="${href}">${escapeHtml(label)}</a>`).join("")}
        </div>
        <h3 class="section-title section-title--spaced">Use This Dossier Responsibly</h3>
        <ul class="evidence-list">
          <li>This dossier describes public documentation in the current snapshot, not campus safety or incident frequency.</li>
          <li>Use source pages and event audit cards before citing records.</li>
          <li>Use the <a href="${sitePath("/codebook/")}">codebook</a> and <a href="${sitePath("/coverage/")}">coverage limits</a> before making comparisons or broader claims.</li>
        </ul>
        <dl>
          <div class="data-line">
            <dt>Communities</dt>
            <dd>${escapeHtml(stats.communities.join(", ") || "None")}</dd>
          </div>
          <div class="data-line">
            <dt>Categories</dt>
            <dd>${escapeHtml(stats.categories.join(", ") || "None")}</dd>
          </div>
          <div class="data-line">
            <dt>Latest update</dt>
            <dd class="mono">${escapeHtml(stats.latestUpdate || "None")}</dd>
          </div>
          <div class="data-line">
            <dt>Dataset snapshot</dt>
            <dd class="mono">${escapeHtml(shortHash(state.manifest.hashes.full_snapshot))}</dd>
          </div>
          <div class="data-line">
            <dt>Use limit</dt>
            <dd>Do not read this dossier as a ranking, safety score, legal finding, or complete incident history.</dd>
          </div>
          ${
            school.website
              ? `<div class="data-line">
                  <dt>Website</dt>
                  <dd><a href="${escapeHtml(school.website)}" target="_blank" rel="noreferrer">${escapeHtml(school.website)}</a></dd>
                </div>`
              : ""
          }
        </dl>
        <h3 class="section-title section-title--spaced">Filter this dossier</h3>
        <p class="section-note">${filteredRecords.length} of ${stats.records.length} records shown. Use community labels or text search for terms like antisemitism, OCR, or Title VI.</p>
        <form class="toolbar toolbar--compact" id="school-record-filter-form">
          <input id="school_record_q" name="record_q" type="search" value="${escapeHtml(state.schoolFilters.recordQ)}" placeholder="Search this dossier" aria-label="Search this dossier">
          <select id="school_record_community" name="community" aria-label="Filter dossier by community">${renderSelectOptions(communities, state.schoolFilters.community, "Community")}</select>
          <select id="school_record_category" name="record_category" aria-label="Filter dossier by category">${renderSelectOptions(categories, state.schoolFilters.recordCategory, "Category")}</select>
        </form>
        <div class="utility-bar">
          ${jewishLink}
          ${antisemitismLink}
          <a class="button-link" href="${filteredEventsLink}">Open current dossier filter in Events</a>
        </div>
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
              ${filteredRecords.length
                ? filteredRecords.map(
                  (record) => `
                    <tr>
                      <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                      <td>${escapeHtml(record.category)}</td>
                      <td><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                      <td>${record.sources.length}</td>
                    </tr>
                  `
                )
                .join("")
                : `<tr><td colspan="4" class="empty">No records match the current dossier filters.</td></tr>`}
            </tbody>
          </table>
        </div>
        <h3 class="section-title section-title--spaced">Institutional Responses</h3>
        ${
          responseRecords.length
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
                    ${responseRecords
                      .map(
                        (record) => `
                          <tr>
                            <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                            <td><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                            <td>${escapeHtml(String(record.institutional_response ?? "").trim())}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
            : `<p class="empty">No public institutional response is recorded for this school in the current dataset.</p>`
        }
        <h3 class="section-title section-title--spaced">Public Legal/OCR Items</h3>
        ${
          legalRecords.length
            ? `<div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Record</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${legalRecords
                      .map(
                        (record) => `
                          <tr>
                            <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                            <td><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                            <td>${escapeHtml(record.legal_status || "Not recorded")}</td>
                          </tr>
                        `
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
            : `<p class="empty">No public legal or OCR item is recorded for this school in the current dataset.</p>`
        }
      </div>
      <aside>
        <h3 class="section-title">Documentation Signals</h3>
        <p class="section-note">These signals describe public documentation in this dataset, not safety, prevalence, or quality of life.</p>
        ${documentationSignalRows(signals)}
        <h3 class="section-title section-title--spaced">Dossier Review Needs</h3>
        ${countRows(schoolReviewNeeds(stats.records), "Review Need")}
        <h3 class="section-title">Related Sources</h3>
        <ul class="source-list">
          ${sources
            .map(
              (source) => `
                <li>
                  <a href="${sourceDetailHref(source)}">${escapeHtml(source.title)}</a>
                  <br><span class="section-note">${escapeHtml(source.publisher)} / ${escapeHtml(source.source_type)}</span>
                </li>
              `
            )
            .join("")}
        </ul>
      </aside>
    </div>
  `;

  const recordFilterForm = document.querySelector("#school-record-filter-form");
  if (recordFilterForm) {
    recordFilterForm.addEventListener("input", updateSchoolRecordFilters);
    recordFilterForm.addEventListener("change", updateSchoolRecordFilters);
  }
}

function renderBriefs() {
  const root = document.querySelector("#briefs-root");
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const sortedBriefs = [...state.briefs].sort((a, b) => b.published_date.localeCompare(a.published_date));
  const selectedId = params.get("id") || sortedBriefs[0]?.id;

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Published Briefs</h2>
        <p class="section-note">${sortedBriefs.length} briefs</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Published</th>
              <th>Brief</th>
              <th>New</th>
              <th>Updated</th>
              <th>Snapshot</th>
            </tr>
          </thead>
          <tbody>
            ${sortedBriefs
              .map(
                (brief) => `
                  <tr${brief.id === selectedId ? " class=\"is-selected\"" : ""}>
                    <td class="mono">${escapeHtml(brief.published_date)}</td>
                    <td><a href="${sitePath(`/briefs/${encodeURIComponent(brief.id)}/`)}">${escapeHtml(brief.title)}</a></td>
                    <td>${brief.new_event_ids.length}</td>
                    <td>${brief.updated_event_ids.length}</td>
                    <td class="mono">${escapeHtml(shortHash(brief.snapshot_hash || state.manifest.hashes.events))}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="detail-panel" id="brief-detail"></section>
  `;

  renderBriefDetail(selectedId);
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
            .map(
              (record) => `
                <tr>
                  <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                  <td>${escapeHtml(record.school?.name ?? "Unknown")}</td>
                  <td>${escapeHtml(record.category)}</td>
                  <td><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function briefSourceBreakdown(records) {
  return countRows(countBy(records.flatMap((record) => record.source_types), (type) => type), "Source Type");
}

function briefResponseList(records) {
  const responseRecords = records.filter(hasDisplayInstitutionalResponse);
  if (!responseRecords.length) return `<p class="empty">No institutional responses recorded in this brief.</p>`;
  return `
    <ul class="source-list">
      ${responseRecords
        .map(
          (record) => `
            <li>
              <a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.school?.name ?? "Unknown")}</a>
              <br><span>${escapeHtml(String(record.institutional_response ?? "").trim())}</span>
            </li>
          `
        )
        .join("")}
    </ul>
  `;
}

function briefLegalUpdates(records) {
  const legalRecords = records.filter((record) => /ocr|legal|lawsuit|resolution|title vi|title ix/i.test(`${record.category} ${record.legal_status}`));
  if (!legalRecords.length) return `<p class="empty">No legal or OCR updates recorded in this brief.</p>`;
  return briefRecordTable(legalRecords, "No legal or OCR updates recorded in this brief.");
}

function briefListSection(title, items) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <h3 class="section-title section-title--spaced">${escapeHtml(title)}</h3>
    <ul class="evidence-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function verificationRationale(record) {
  const sourceCount = record.sources?.length ?? record.source_ids?.length ?? 0;
  const sourceTypes = join(record.source_types);
  return `${record.verification_status}; ${sourceCount} public source${sourceCount === 1 ? "" : "s"} reviewed (${sourceTypes}). Confidence reflects source support, not severity.`;
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

function recordAuditCard(record) {
  const profile = buildAuditProfile(record, record.sources);
  return `
    <section class="section section--tight record-audit-card">
      <div class="section-header">
        <h3 class="section-title">Record Audit</h3>
        <p class="section-note">Source basis and classification review</p>
      </div>
      <dl>
        <div class="data-line">
          <dt>Source basis</dt>
          <dd>${escapeHtml(profile.sourceBasis)}</dd>
        </div>
        <div class="data-line">
          <dt>Classification rationale</dt>
          <dd>${escapeHtml(profile.classificationRationale)}</dd>
        </div>
        <div class="data-line">
          <dt>Community rationale</dt>
          <dd>${escapeHtml(profile.communityRationale)}</dd>
        </div>
        <div class="data-line">
          <dt>Confidence rationale</dt>
          <dd>${escapeHtml(profile.confidenceRationale)}</dd>
        </div>
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
      <h4 class="section-title section-title--spaced">Use Limits</h4>
      <ul class="evidence-list">
        ${profile.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderBriefDetail(briefId) {
  const panel = document.querySelector("#brief-detail");
  if (!panel) return;

  const brief = state.briefs.find((item) => item.id === briefId);
  if (!brief) {
    panel.innerHTML = "";
    return;
  }

  const newRecords = brief.new_event_ids.map((id) => state.records.find((record) => record.id === id)).filter(Boolean);
  const updatedRecords = brief.updated_event_ids.map((id) => state.records.find((record) => record.id === id)).filter(Boolean);
  const allBriefRecords = [...newRecords, ...updatedRecords];

  panel.innerHTML = `
    <div class="detail-grid">
      <div>
        <p class="page-kicker">${escapeHtml(brief.week_start)} / ${escapeHtml(brief.week_end)}</p>
        <h2>${escapeHtml(brief.title)}</h2>
        <p>${escapeHtml(brief.summary)}</p>
        ${briefListSection("Analysis Notes", brief.analysis_points)}
        ${briefListSection("Responsible Uses", brief.responsible_uses)}
        ${
          brief.methods_note
            ? `<h3 class="section-title section-title--spaced">Method Note</h3>
               <p>${escapeHtml(brief.methods_note)}</p>`
            : ""
        }
        <h3 class="section-title section-title--spaced">Newly Added Verified Records</h3>
        ${briefRecordTable(newRecords, "No newly added records in this brief.")}
        <h3 class="section-title section-title--spaced">Updated Records</h3>
        ${briefRecordTable(updatedRecords, "No updated records in this brief.")}
        <h3 class="section-title section-title--spaced">Notable Institutional Responses</h3>
        ${briefResponseList(allBriefRecords)}
        <h3 class="section-title section-title--spaced">Legal/OCR Updates</h3>
        ${briefLegalUpdates(allBriefRecords)}
      </div>
      <aside>
        <dl>
          <div class="data-line">
            <dt>Brief type</dt>
            <dd>${escapeHtml(brief.brief_type || "Dataset update")}</dd>
          </div>
          <div class="data-line">
            <dt>Published</dt>
            <dd class="mono">${escapeHtml(brief.published_date)}</dd>
          </div>
          <div class="data-line">
            <dt>Dataset version</dt>
            <dd class="mono">${escapeHtml(state.manifest.snapshot_id)}</dd>
          </div>
          <div class="data-line">
            <dt>Dataset hash</dt>
            <dd class="mono">${escapeHtml(brief.snapshot_hash || state.manifest.hashes.events)}</dd>
          </div>
          <div class="data-line">
            <dt>New records</dt>
            <dd>${newRecords.length}</dd>
          </div>
          <div class="data-line">
            <dt>Updated records</dt>
            <dd>${updatedRecords.length}</dd>
          </div>
          <div class="data-line">
            <dt>Corrections</dt>
            <dd>${brief.correction_ids.length}</dd>
          </div>
        </dl>
        ${briefListSection("Research Questions", brief.research_questions)}
        <h3 class="section-title section-title--spaced">Source-Type Breakdown</h3>
        ${briefSourceBreakdown(allBriefRecords)}
        <h3 class="section-title section-title--spaced">Corrections Issued</h3>
        <p class="empty">${brief.correction_ids.length ? escapeHtml(brief.correction_ids.join(", ")) : "No corrections issued in this brief."}</p>
        <h3 class="section-title section-title--spaced">Dataset Downloads</h3>
        <ul class="source-list">
          <li><a href="${sitePath("/data/events.json")}">Events JSON</a></li>
          <li><a href="${sitePath("/data/events.csv")}">Events CSV</a></li>
          <li><a href="${sitePath("/data/snapshot-manifest.json")}">Snapshot manifest</a></li>
          <li><a href="${sitePath("/downloads/")}">All downloads</a></li>
        </ul>
      </aside>
    </div>
  `;
}

function renderSources() {
  const root = document.querySelector("#sources-root");
  if (!root) return;

  initializeSourceFiltersFromUrl();
  const sourceTypes = unique([...state.sources.values()].map((source) => [source.source_type]));
  const publishers = unique([...state.sources.values()].map((source) => [source.publisher]));
  const sortOptions = [
    { value: "records_desc", label: "Most records" },
    { value: "relevance", label: "Search relevance" },
    { value: "publisher_asc", label: "Publisher A-Z" },
    { value: "date_desc", label: "Published date" },
    { value: "title_asc", label: "Title A-Z" }
  ];
  const rows = sortedSourceRows(sourceRows());

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Source Index</h2>
        <p class="section-note">${rows.length} of ${state.sources.size} sources</p>
      </div>
      <form class="toolbar toolbar--sources" id="source-filter-form">
        <input id="source_q" name="q" type="search" value="${escapeHtml(state.sourceFilters.q)}" placeholder="Search sources" aria-label="Search sources">
        <select id="source_type" name="source_type" aria-label="Filter sources by type">${renderSelectOptions(sourceTypes, state.sourceFilters.sourceType, "Source type")}</select>
        <select id="source_publisher" name="publisher" aria-label="Filter sources by publisher">${renderSelectOptions(publishers, state.sourceFilters.publisher, "Publisher")}</select>
        <select id="source_sort" name="sort" aria-label="Sort sources">${renderOptionPairs(sortOptions, state.sourceFilters.sort, "Sort")}</select>
      </form>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Publisher</th>
              <th>Type</th>
              <th>Published</th>
              <th>Schools</th>
              <th>Records</th>
              <th>Audit</th>
              <th>External</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map(
                      ({ source, events, schools, audit }) => `
                  <tr>
                    <td class="summary-cell"><a href="${sitePath(`/sources/${encodeURIComponent(source.id)}/`)}">${escapeHtml(source.title)}</a></td>
                    <td>${escapeHtml(source.publisher)}</td>
                    <td>${escapeHtml(source.source_type)}</td>
                    <td class="mono">${escapeHtml(source.published_date)}</td>
                    <td>${escapeHtml(schools.join(", ") || "None")}</td>
                    <td>${events.length}</td>
                    <td>${escapeHtml((audit?.launch_check_status ?? "not_checked").replaceAll("_", " "))}</td>
                    <td><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">External source URL</a></td>
                  </tr>
                `
                    )
                    .join("")
                : `<tr><td colspan="8" class="empty">No sources match the current filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <p class="section-note download-inline">Audit files: <a href="${sitePath("/data/sources.json")}" download>Sources JSON</a> / <a href="${sitePath("/data/sources.csv")}" download>Sources CSV</a> / <a href="${sitePath("/data/source-audit.json")}" download>Source Audit JSON</a></p>
    </section>
  `;

  const form = document.querySelector("#source-filter-form");
  form.addEventListener("input", updateSourceFilters);
  form.addEventListener("change", updateSourceFilters);
}

function renderQuality() {
  const root = document.querySelector("#quality-root");
  if (!root) return;

  const recordsWithSources = state.records.filter((record) => record.sources.length > 0).length;
  const recordsWithHashes = state.records.filter((record) => record.record_hash).length;
  const sourceTypes = countBy([...state.sources.values()], (source) => source.source_type);
  const sourceCoverage = [...state.sources.values()]
    .map((source) => [source.title, state.records.filter((record) => record.source_ids.includes(source.id)).length])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const decisionCounts = state.reviewLog?.decision_counts ?? {};
  const signals = documentationSignals(state.records);

  root.innerHTML = `
    <section class="section section--tight" aria-label="Quality metrics">
      <div class="metric-grid">
        ${metric(state.records.length, "Event records")}
        ${metric(recordsWithSources, "Records with sources")}
        ${metric(recordsWithHashes, "Records with hashes")}
        ${metric(state.corrections.length, "Correction records")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Documentation Signals, Not Safety Scores</h2>
        <p class="section-note">These fields describe how much public documentation the archive currently holds and how auditable it is. They do not rate campus safety, quality of life, institutional virtue, or event prevalence.</p>
      </div>
      ${documentationSignalRows(signals)}
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Snapshot Integrity</h2>
        <p class="section-note">${escapeHtml(state.manifest.generated_at)}</p>
      </div>
      <dl>
        <div class="data-line">
          <dt>Snapshot</dt>
          <dd class="mono">${escapeHtml(state.manifest.snapshot_id)}</dd>
        </div>
        <div class="data-line">
          <dt>Event hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.events)}</dd>
        </div>
        <div class="data-line">
          <dt>Full snapshot hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.full_snapshot)}</dd>
        </div>
        <div class="data-line">
          <dt>Correction hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.corrections)}</dd>
        </div>
        <div class="data-line">
          <dt>Review log hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.review_log)}</dd>
        </div>
        <div class="data-line">
          <dt>Archived snapshot</dt>
          <dd><a href="${sitePath(`/data/snapshots/${encodeURIComponent(state.manifest.snapshot_id)}.json`)}">Open archived JSON</a></dd>
        </div>
      </dl>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Record Classification</h2>
        <p class="section-note">Counts from current event dataset</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3 class="section-title">Confidence</h3>
          ${countRows(countBy(state.records, (record) => record.confidence), "Confidence")}
        </div>
        <aside>
          <h3 class="section-title">Verification</h3>
          ${countRows(countBy(state.records, (record) => record.verification_status), "Status")}
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Coverage</h2>
        <p class="section-note">${state.schoolsList.length} schools / ${state.sources.size} sources / ${state.briefs.length} briefs / ${state.reviewLog.queues.length} review queues</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3 class="section-title">Categories</h3>
          ${countRows(countBy(state.records, (record) => record.category), "Category")}
        </div>
        <aside>
          <h3 class="section-title">Communities</h3>
          ${countRows(countBy(state.records.flatMap((record) => record.affected_communities), (community) => community), "Community")}
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Review System</h2>
        <p class="section-note">Updated ${escapeHtml(state.reviewLog.updated_at)}</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3 class="section-title">Correction Decisions</h3>
          ${countRows(
            [
              ["Pending", decisionCounts.pending ?? 0],
              ["Accepted", decisionCounts.accepted ?? 0],
              ["Rejected", decisionCounts.rejected ?? 0],
              ["Needs more evidence", decisionCounts.needs_more_evidence ?? 0]
            ],
            "Status"
          )}
        </div>
        <aside>
          <h3 class="section-title">Service Standard</h3>
          <dl>
            <div class="data-line">
              <dt>Triage target</dt>
              <dd>${escapeHtml(state.reviewLog.service_standard.triage_target_days)} days</dd>
            </div>
            <div class="data-line">
              <dt>Publication rule</dt>
              <dd>${escapeHtml(state.reviewLog.service_standard.publication_rule)}</dd>
            </div>
            <div class="data-line">
              <dt>Correction rule</dt>
              <dd>${escapeHtml(state.reviewLog.service_standard.correction_rule)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Source Mix</h2>
        <p class="section-note">Provenance distribution</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3 class="section-title">Source Types</h3>
          ${countRows(sourceTypes, "Type", "Sources")}
        </div>
        <aside>
          <h3 class="section-title">Most Referenced Sources</h3>
          ${countRows(sourceCoverage.slice(0, 8), "Source")}
        </aside>
      </div>
    </section>
  `;
}

function renderSubmitWorkflow() {
  const root = document.querySelector("#submit-workflow-root");
  if (!root) return;
  const requestedRecordId = new URLSearchParams(window.location.search).get("record_id") || "";

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Prepare a Source Submission</h2>
        <p class="section-note">No account or backend required here</p>
      </div>
      <form class="stacked-form" id="source-submission-form">
        <label>
          <span>Public source URL</span>
          <input name="source_url" type="url" placeholder="https://..." required>
        </label>
        <label>
          <span>School</span>
          <input name="school" type="text" placeholder="Institution, city, state" required>
        </label>
        <label>
          <span>Source type</span>
          <select name="source_type" required>
            <option value="">Choose type</option>
            <option>Campus newspaper</option>
            <option>University statement</option>
            <option>Annual security report</option>
            <option>Public safety notice</option>
            <option>Public legal filing</option>
            <option>Government release</option>
            <option>Government dataset</option>
            <option>Journalism</option>
            <option>Nonprofit report</option>
            <option>Other public source</option>
          </select>
        </label>
        <label>
          <span>Affected community</span>
          <select name="affected_community" required>
            <option value="">Choose community</option>
            <option>Jewish</option>
            <option>Asian</option>
            <option>Black</option>
            <option>Native</option>
            <option>Indigenous</option>
            <option>Latino</option>
            <option>Muslim</option>
            <option>Arab</option>
            <option>Palestinian</option>
            <option>Sikh</option>
            <option>Hindu</option>
            <option>LGBTQ+</option>
            <option>Race</option>
            <option>Religion</option>
            <option>National origin</option>
            <option>Ethnicity</option>
            <option>Gender</option>
            <option>Disability</option>
            <option>Students with disabilities</option>
            <option>Women</option>
            <option>Other source-backed civil rights community</option>
          </select>
        </label>
        <label>
          <span>Event category</span>
          <select name="event_category" required>
            <option value="">Choose category</option>
            <option>Harassment or threat</option>
            <option>Vandalism</option>
            <option>Discrimination allegation</option>
            <option>Protest-related incident</option>
            <option>Institutional response</option>
            <option>Public statement</option>
            <option>Policy change</option>
            <option>Public safety notice</option>
            <option>OCR complaint</option>
            <option>Lawsuit or legal filing</option>
            <option>Criminal investigation</option>
            <option>Community response</option>
            <option>Other source-backed civil rights event</option>
          </select>
        </label>
        <label>
          <span>Why this may fit</span>
          <textarea name="relevance" rows="5" required></textarea>
        </label>
        <button type="submit">Generate Review Packet</button>
      </form>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Prepare a Correction Request</h2>
        <p class="section-note">Requires a record ID</p>
      </div>
      <form class="stacked-form" id="correction-request-form">
        <label>
          <span>Record ID</span>
          <input name="record_id" type="text" value="${escapeHtml(requestedRecordId)}" placeholder="evt_2025_0010" required>
        </label>
        <label>
          <span>Field to correct</span>
          <input name="field" type="text" placeholder="date, summary, school, legal_status" required>
        </label>
        <label>
          <span>Public source URL</span>
          <input name="source_url" type="url" placeholder="https://..." required>
        </label>
        <label>
          <span>Requested correction</span>
          <textarea name="correction" rows="5" required></textarea>
        </label>
        <button type="submit">Generate Correction Packet</button>
      </form>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Report a Duplicate</h2>
        <p class="section-note">Two record IDs required</p>
      </div>
      <form class="stacked-form" id="duplicate-report-form">
        <label>
          <span>Primary record ID</span>
          <input name="primary_record_id" type="text" placeholder="evt_2025_0010" required>
        </label>
        <label>
          <span>Possible duplicate record ID</span>
          <input name="duplicate_record_id" type="text" placeholder="evt_2025_0011" required>
        </label>
        <label>
          <span>Public source URL</span>
          <input name="source_url" type="url" placeholder="https://..." required>
        </label>
        <label>
          <span>Why these appear duplicate</span>
          <textarea name="duplicate_reason" rows="5" required></textarea>
        </label>
        <button type="submit">Generate Duplicate Packet</button>
      </form>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Suggest School Metadata Correction</h2>
        <p class="section-note">Institution profile fields</p>
      </div>
      <form class="stacked-form" id="school-metadata-form">
        <label>
          <span>School ID or name</span>
          <input name="school" type="text" placeholder="university_of_kentucky or University of Kentucky" required>
        </label>
        <label>
          <span>Field to correct</span>
          <input name="field" type="text" placeholder="name, state, school_type, location" required>
        </label>
        <label>
          <span>Public source URL</span>
          <input name="source_url" type="url" placeholder="https://..." required>
        </label>
        <label>
          <span>Requested metadata correction</span>
          <textarea name="metadata_correction" rows="5" required></textarea>
        </label>
        <button type="submit">Generate Metadata Packet</button>
      </form>
    </section>

    <section class="section packet-section" id="generated-packet-section">
      <div class="section-header">
        <h2 class="section-title">Generated Packet</h2>
        <p class="section-note">Public-source review format</p>
      </div>
      <div class="packet-actions">
        <button type="button" id="copy-packet" disabled>Copy Packet</button>
        <a id="open-github-issue" class="button-link is-disabled" aria-disabled="true">Open GitHub Issue</a>
        <span id="packet-status" class="section-note" role="status"></span>
      </div>
      <textarea id="submission-output" class="packet-output" rows="14" readonly aria-label="Generated review packet"></textarea>
    </section>
  `;

  document.querySelector("#source-submission-form").addEventListener("submit", handleSourceSubmission);
  document.querySelector("#correction-request-form").addEventListener("submit", handleCorrectionSubmission);
  document.querySelector("#duplicate-report-form").addEventListener("submit", handleDuplicateReport);
  document.querySelector("#school-metadata-form").addEventListener("submit", handleSchoolMetadataCorrection);
  document.querySelector("#copy-packet").addEventListener("click", copyPacketOutput);
}

function assertPublicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Use an HTTPS public source URL.");
  }
  return url.toString();
}

function issueLabelsForType(type) {
  return {
    "source-submission": "source-submission,pending-review",
    "correction-request": "correction,pending-review",
    "duplicate-report": "duplicate,pending-review",
    "school-metadata-correction": "school-metadata,correction,pending-review"
  }[type] ?? "pending-review";
}

function issueTitleForPacket(packet) {
  if (packet.type === "source-submission") return `Source submission: ${packet.school || packet.source_url}`;
  if (packet.type === "correction-request") return `Correction request: ${packet.record_id || "record"}`;
  if (packet.type === "duplicate-report") return `Duplicate report: ${packet.primary_record_id || "record"} / ${packet.duplicate_record_id || "record"}`;
  if (packet.type === "school-metadata-correction") return `School metadata correction: ${packet.school || "school"}`;
  return "Campus Evidence Lab review packet";
}

function issueBodyForPacket(packetText) {
  return `Generated by the Campus Evidence Lab public intake page.\n\nReview packet:\n\n\`\`\`json\n${packetText}\n\`\`\`\n`;
}

function issueUrlForPacket(packet, packetText) {
  const url = new URL("https://github.com/maximilian-kornstein/campus-evidence-lab/issues/new");
  url.searchParams.set("title", issueTitleForPacket(packet));
  url.searchParams.set("body", issueBodyForPacket(packetText));
  url.searchParams.set("labels", issueLabelsForType(packet.type));
  return url.toString();
}

function setPacketOutput(value, packet = null) {
  const output = document.querySelector("#submission-output");
  if (output) output.value = value;
  const copyButton = document.querySelector("#copy-packet");
  const issueLink = document.querySelector("#open-github-issue");
  const status = document.querySelector("#packet-status");

  if (copyButton) copyButton.disabled = !value || !packet;
  if (status) status.textContent = packet ? "Packet ready for public issue filing" : "";
  if (!issueLink) {
    if (value) revealPacketOutput();
    return;
  }

  if (!packet) {
    issueLink.removeAttribute("href");
    issueLink.classList.add("is-disabled");
    issueLink.setAttribute("aria-disabled", "true");
    if (value) revealPacketOutput();
    return;
  }

  issueLink.href = issueUrlForPacket(packet, value);
  issueLink.classList.remove("is-disabled");
  issueLink.setAttribute("aria-disabled", "false");
  revealPacketOutput();
}

function revealPacketOutput() {
  const section = document.querySelector("#generated-packet-section");
  const output = document.querySelector("#submission-output");
  if (!section || !output) return;
  const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));

  schedule(() => {
    const targetTop = section.getBoundingClientRect().top + window.scrollY;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    try {
      window.scrollTo({
        top: targetTop,
        left: 0,
        behavior: reduceMotion ? "auto" : "smooth"
      });
    } catch {
      window.location.hash = "generated-packet-section";
    }
    output.focus({ preventScroll: true });
  });
}

async function copyPacketOutput() {
  const output = document.querySelector("#submission-output");
  const status = document.querySelector("#packet-status");
  if (!output?.value) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(output.value);
    } else {
      output.focus();
      output.select();
      document.execCommand("copy");
    }
    if (status) status.textContent = "Packet copied";
  } catch {
    if (status) status.textContent = "Copy failed; select the packet text manually";
  }
}

function handleSourceSubmission(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const sourceUrl = assertPublicUrl(String(formData.get("source_url") || ""));
    const packet = {
      type: "source-submission",
      source_url: sourceUrl,
      school: String(formData.get("school") || "").trim(),
      source_type: String(formData.get("source_type") || "").trim(),
      affected_community: String(formData.get("affected_community") || "").trim(),
      event_category: String(formData.get("event_category") || "").trim(),
      relevance: String(formData.get("relevance") || "").trim(),
      exclusions_confirmed: [
        "No private screenshots",
        "No direct messages",
        "No private testimony",
        "No sensitive personal information"
      ]
    };
    setPacketOutput(JSON.stringify(packet, null, 2), packet);
  } catch (error) {
    setPacketOutput(error.message);
  }
}

function handleCorrectionSubmission(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const sourceUrl = assertPublicUrl(String(formData.get("source_url") || ""));
    const packet = {
      type: "correction-request",
      record_id: String(formData.get("record_id") || "").trim(),
      field: String(formData.get("field") || "").trim(),
      public_source_url: sourceUrl,
      requested_correction: String(formData.get("correction") || "").trim()
    };
    setPacketOutput(JSON.stringify(packet, null, 2), packet);
  } catch (error) {
    setPacketOutput(error.message);
  }
}

function handleDuplicateReport(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const sourceUrl = assertPublicUrl(String(formData.get("source_url") || ""));
    const packet = {
      type: "duplicate-report",
      primary_record_id: String(formData.get("primary_record_id") || "").trim(),
      duplicate_record_id: String(formData.get("duplicate_record_id") || "").trim(),
      public_source_url: sourceUrl,
      duplicate_reason: String(formData.get("duplicate_reason") || "").trim()
    };
    setPacketOutput(JSON.stringify(packet, null, 2), packet);
  } catch (error) {
    setPacketOutput(error.message);
  }
}

function handleSchoolMetadataCorrection(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  try {
    const sourceUrl = assertPublicUrl(String(formData.get("source_url") || ""));
    const packet = {
      type: "school-metadata-correction",
      school: String(formData.get("school") || "").trim(),
      field: String(formData.get("field") || "").trim(),
      public_source_url: sourceUrl,
      requested_metadata_correction: String(formData.get("metadata_correction") || "").trim()
    };
    setPacketOutput(JSON.stringify(packet, null, 2), packet);
  } catch (error) {
    setPacketOutput(error.message);
  }
}

function workspaceParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    q: params.get("q") || "",
    title: params.get("title") || "Campus Evidence Lab Research Packet",
    question: params.get("question") || "",
    recordIds: (params.get("record_ids") || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  };
}

function updateWorkspaceUrl(next) {
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.title && next.title !== "Campus Evidence Lab Research Packet") params.set("title", next.title);
  if (next.question) params.set("question", next.question);
  if (next.recordIds.length) params.set("record_ids", next.recordIds.join(","));
  const query = params.toString();
  window.history.replaceState(null, "", sitePath(query ? `/research-workspace/?${query}` : "/research-workspace/"));
}

function workspaceCandidateRecords(query) {
  return state.records
    .map((record) => ({ record, search: weightedSearch(record, query, recordWeightedFields(record)) }))
    .filter(({ search }) => !query || search.matches)
    .sort((a, b) => (b.search.score ?? 0) - (a.search.score ?? 0) || byDateDesc(a.record, b.record))
    .map(({ record }) => record)
    .slice(0, query ? 50 : 25);
}

function renderResearchWorkspace() {
  const root = document.querySelector("#research-workspace-root");
  if (!root) return;

  const params = workspaceParams();
  const selectedSet = new Set(params.recordIds);
  const selectedRecords = params.recordIds.map((id) => state.records.find((record) => record.id === id)).filter(Boolean);
  const candidates = workspaceCandidateRecords(params.q);
  const packet = selectedRecords.length ? researchPacket(selectedRecords, params.title, params.question) : "Select records to generate a citation packet.";
  const workspaceWorkflows = (state.workflows.workflows ?? []).filter((workflow) => workflow.packet_url.startsWith("/research-workspace/"));

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Quick Packet Presets</h2>
        <p class="section-note">URL-encoded templates</p>
      </div>
      <div class="action-grid">
        ${workspaceWorkflows
          .map(
            (workflow) => `
              <a class="action-link" href="${sitePath(workflow.packet_url)}">
                <span>${escapeHtml(workflow.title)}</span>
                <span>${escapeHtml(workflow.audience)}</span>
              </a>
            `
          )
          .join("")}
        <a class="action-link" href="${sitePath("/downloads/")}">
          <span>Open Downloads</span>
          <span>Move to raw files only after deciding whether you need a packet, CSV, research JSON, or full snapshot artifact.</span>
        </a>
      </div>
    </section>

    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Record Selection</h2>
        <p class="section-note">${selectedRecords.length} selected / ${candidates.length} visible candidates</p>
      </div>
      <form class="toolbar toolbar--compact" id="workspace-search-form">
        <input id="workspace_q" name="q" type="search" value="${escapeHtml(params.q)}" placeholder="Search records to add" aria-label="Search records to add">
        <button type="submit">Search</button>
        <button type="button" id="workspace-add-visible">Add Visible</button>
      </form>
      <div class="utility-bar">
        <button type="button" id="workspace-clear">Clear Selection</button>
        <button type="button" id="workspace-copy-link">Copy Workspace Link</button>
        <span id="workspace-status" class="section-note" role="status">Selection is encoded in the URL</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Date</th>
              <th>School</th>
              <th>Community</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            ${candidates
              .map(
                (record) => `
                  <tr>
                    <td><input type="checkbox" class="workspace-record-toggle" value="${escapeHtml(record.id)}" aria-label="Select ${escapeHtml(record.id)}"${selectedSet.has(record.id) ? " checked" : ""}></td>
                    <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                    <td>${escapeHtml(record.school?.name ?? "Unknown")}<br><span class="section-note">${escapeHtml(record.school?.state ?? "")}</span></td>
                    <td>${escapeHtml(join(record.affected_communities))}</td>
                    <td class="summary-cell"><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Citation Packet</h2>
        <p class="section-note">Markdown and JSON are generated locally</p>
      </div>
      <form class="stacked-form" id="workspace-packet-form">
        <label>
          <span>Packet title</span>
          <input name="title" type="text" value="${escapeHtml(params.title)}">
        </label>
        <label>
          <span>Research question</span>
          <textarea name="question" rows="3">${escapeHtml(params.question)}</textarea>
        </label>
      </form>
      <div class="utility-bar">
        <button type="button" id="workspace-copy-packet"${selectedRecords.length ? "" : " disabled"}>Copy Packet</button>
        <button type="button" id="workspace-download-markdown"${selectedRecords.length ? "" : " disabled"}>Download Markdown</button>
        <button type="button" id="workspace-download-json"${selectedRecords.length ? "" : " disabled"}>Download JSON</button>
      </div>
      <textarea id="workspace-packet-output" class="packet-output" rows="18" readonly aria-label="Generated citation packet">${escapeHtml(packet)}</textarea>
    </section>
  `;

  document.querySelector("#workspace-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    updateWorkspaceUrl({ ...params, q: String(new FormData(event.currentTarget).get("q") || "") });
    renderResearchWorkspace();
  });
  document.querySelector("#workspace-add-visible").addEventListener("click", () => {
    updateWorkspaceUrl({ ...workspaceParams(), recordIds: unique([params.recordIds, candidates.map((record) => record.id)]).slice(0, MAX_WORKSPACE_HANDOFF) });
    renderResearchWorkspace();
  });
  document.querySelector("#workspace-clear").addEventListener("click", () => {
    updateWorkspaceUrl({ ...workspaceParams(), recordIds: [] });
    renderResearchWorkspace();
  });
  document.querySelector("#workspace-copy-link").addEventListener("click", async () => {
    const status = document.querySelector("#workspace-status");
    try {
      await copyText(currentAbsoluteUrl());
      if (status) status.textContent = "Workspace link copied";
    } catch {
      if (status) status.textContent = "Copy failed; use the browser address bar";
    }
  });
  document.querySelectorAll(".workspace-record-toggle").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const current = new Set(workspaceParams().recordIds);
      if (checkbox.checked) current.add(checkbox.value);
      else current.delete(checkbox.value);
      updateWorkspaceUrl({ ...workspaceParams(), recordIds: [...current].slice(0, MAX_WORKSPACE_HANDOFF) });
      renderResearchWorkspace();
    });
  });
  document.querySelector("#workspace-packet-form").addEventListener("change", (event) => {
    const formData = new FormData(event.currentTarget);
    updateWorkspaceUrl({
      ...workspaceParams(),
      title: String(formData.get("title") || ""),
      question: String(formData.get("question") || "")
    });
    renderResearchWorkspace();
  });
  document.querySelector("#workspace-copy-packet").addEventListener("click", async () => {
    const output = document.querySelector("#workspace-packet-output");
    const status = document.querySelector("#workspace-status");
    try {
      await copyText(output.value);
      if (status) status.textContent = "Packet copied";
    } catch {
      if (status) status.textContent = "Copy failed; select the packet text manually";
    }
  });
  document.querySelector("#workspace-download-markdown").addEventListener("click", () => {
    downloadTextFile("campus-evidence-lab-research-packet.md", "text/markdown;charset=utf-8", researchPacket(selectedRecords, workspaceParams().title, workspaceParams().question));
  });
  document.querySelector("#workspace-download-json").addEventListener("click", () => {
    const payload = {
      snapshot_id: state.manifest.snapshot_id,
      snapshot_hash: state.manifest.hashes.full_snapshot,
      title: workspaceParams().title,
      question: workspaceParams().question,
      records: selectedRecords.map(selectedEventExport)
    };
    downloadTextFile("campus-evidence-lab-research-packet.json", "application/json;charset=utf-8", JSON.stringify(payload, null, 2));
  });
}

function reviewerIssueUrl(title, body) {
  const url = new URL("https://github.com/maximilian-kornstein/campus-evidence-lab/issues/new");
  url.searchParams.set("template", "reviewer-checklist.yml");
  url.searchParams.set("title", title);
  url.searchParams.set("body", body);
  return url.toString();
}

function queueRecordTable(records, emptyText) {
  if (!records.length) return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>School</th>
            <th>Record</th>
            <th>Reason</th>
            <th>Workspace</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .slice(0, 25)
            .map(
              (record) => `
                <tr>
                  <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                  <td>${escapeHtml(record.school?.name ?? "Unknown")}</td>
                  <td class="summary-cell"><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                  <td>${escapeHtml(reviewNeedLabels(record).join("; ") || "Review sample")}</td>
                  <td><a href="${workspaceUrlForRecords([record])}">Packet</a></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function reviewSampleTable(sample, recordById) {
  if (!sample.records.length) return `<p class="empty">No records are currently in this sample.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>School</th>
            <th>Record</th>
            <th>Review reasons</th>
            <th>Packet</th>
          </tr>
        </thead>
        <tbody>
          ${sample.records
            .map((row) => {
              const record = recordById.get(row.event_id);
              return `
                <tr>
                  <td class="mono">${escapeHtml(formatDate(row.date, record?.date_precision ?? "day"))}</td>
                  <td>${escapeHtml(record?.school?.name ?? row.school_id)}</td>
                  <td class="summary-cell"><a href="${sitePath(`/events/${encodeURIComponent(row.event_id)}/`)}">${escapeHtml(record?.summary ?? row.event_id)}</a></td>
                  <td>${escapeHtml(row.reason_codes.join("; "))}</td>
                  <td><a href="${row.workspace_url}">Packet</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function sampleById(id) {
  return state.reviewSamples?.samples?.find((sample) => sample.id === id);
}

function renderWorkflows() {
  const root = document.querySelector("#workflows-root");
  if (!root) return;
  const workflows = state.workflows.workflows ?? [];
  root.innerHTML = `
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Task Entry Points</h2>
        <p class="section-note">Workflow links preserve source and use-limit context</p>
      </div>
      <div class="principle-grid">
        ${workflows
          .map(
            (workflow) => `
              <div id="${escapeHtml(workflow.id)}">
                <h3>${escapeHtml(workflow.title)}</h3>
                <p>${escapeHtml(workflow.audience)}</p>
                <p>${escapeHtml(workflow.supported_claims[0])}</p>
                <p><a href="${sitePath(workflow.start_url)}">Start</a> / <a href="${sitePath(workflow.packet_url)}">Packet</a></p>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderReviewerQueue() {
  const root = document.querySelector("#reviewer-queue-root");
  if (!root) return;

  const samples = state.reviewSamples?.samples ?? [];
  const recordById = new Map(state.records.map((record) => [record.id, record]));
  const ledgerEntries = state.reviewLedger?.entries ?? [];
  const summarySamples = [
    sampleById("low-confidence-25"),
    sampleById("single-source-25"),
    sampleById("broad-label-25"),
    sampleById("source-audit-followup-25")
  ];
  const detailSamples = ["low-confidence-25", "broad-label-25", "single-source-25"].map(sampleById).filter(Boolean);

  root.innerHTML = `
    <section class="section section--tight">
      <div class="metric-grid">
        ${metric(String(sampleById("low-confidence-25")?.count ?? 0), "Low-confidence sample")}
        ${metric(String(sampleById("single-source-25")?.count ?? 0), "Single-source sample")}
        ${metric(String(sampleById("broad-label-25")?.count ?? 0), "Broad-label sample")}
        ${metric(String(ledgerEntries.length), "Ledger entries")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Fixed Review Samples</h2>
        <p class="section-note">Deterministic for ${escapeHtml(state.reviewSamples?.snapshot_id ?? state.manifest.snapshot_id)}</p>
      </div>
      <div class="principle-grid">
        ${summarySamples
          .filter(Boolean)
          .map(
            (sample) => `
              <div>
                <h3>${escapeHtml(sample.label)}</h3>
                <p>${sample.count} records. <a href="${sample.workspace_url}">Build sample packet</a> / <a href="${sample.checklist_url}">Open checklist</a></p>
              </div>
            `
          )
          .join("")}
        <div>
          <h3>Public Ledger</h3>
          <p>${ledgerEntries.length} published review entries. <a href="${sitePath("/data/review-ledger.json")}">Open ledger JSON</a></p>
        </div>
      </div>
    </section>

    ${detailSamples
      .map(
        (sample) => `
          <section class="section">
            <div class="section-header">
              <h2 class="section-title">${escapeHtml(sample.label)}</h2>
              <p class="section-note">${escapeHtml(sample.description)}</p>
            </div>
            ${reviewSampleTable(sample, recordById)}
          </section>
        `
      )
      .join("")}

    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Review Method</h2>
        <p class="section-note">${escapeHtml(state.reviewSamples?.method ?? "Review samples are generated from public data artifacts.")}</p>
      </div>
      <p><a href="${sitePath("/data/review-samples.json")}">Download review samples JSON</a></p>
    </section>
  `;
}

function metricCount(entry) {
  if (!entry) return "0";
  return `${entry.count} (${entry.percent}%)`;
}

function robustnessRows(values = [], limit = 8) {
  return values.slice(0, limit).map((entry) => [entry.value, `${entry.count} (${entry.percent}%)`]);
}

function responseDepthLabel(code) {
  return {
    direct_institutional_response: "Direct institutional response",
    agency_described_institutional_action: "Agency-described institutional action",
    limited_public_response_note: "Limited public response note",
    no_public_response_found: "No public response found"
  }[code] ?? code;
}

function evidenceDepthQueueTable(queue, recordById) {
  if (!queue?.records?.length) return `<p class="empty">No records are currently in this queue.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>School</th>
            <th>Review reasons</th>
            <th>Response depth</th>
            <th>Packet</th>
          </tr>
        </thead>
        <tbody>
          ${queue.records
            .slice(0, 10)
            .map((row) => {
              const record = recordById.get(row.event_id);
              return `
                <tr>
                  <td class="summary-cell"><a href="${sitePath(`/events/${encodeURIComponent(row.event_id)}/`)}">${escapeHtml(record?.summary ?? row.event_id)}</a></td>
                  <td>${escapeHtml(record?.school?.name ?? row.school_id)}</td>
                  <td>${escapeHtml(row.reason_codes.join("; "))}</td>
                  <td>${escapeHtml(responseDepthLabel(row.response_depth))}</td>
                  <td><a href="${sitePath(row.packet_url)}">Open</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderRobustness() {
  const root = document.querySelector("#robustness-root");
  if (!root) return;

  const metrics = state.robustnessMetrics;
  if (!metrics) {
    root.innerHTML = `<p class="empty">Robustness metrics are not available.</p>`;
    return;
  }

  const recordById = new Map(state.records.map((record) => [record.id, record]));
  const queues = state.evidenceDepthQueues.queues ?? [];
  const priorityQueues = ["single-source-government-dataset", "year-precision-followup", "response-depth-followup", "high-stakes-rationale-followup"]
    .map((id) => queues.find((queue) => queue.id === id))
    .filter(Boolean);
  const responseDepthRows = Object.entries(metrics.response_depth ?? {}).map(([code, entry]) => [
    responseDepthLabel(code),
    `${entry.count} (${entry.percent}%)`
  ]);

  root.innerHTML = `
    <section class="section section--tight">
      <div class="metric-grid metric-grid--dashboard">
        ${metric(String(metrics.totals.events), "Records measured")}
        ${metric(metricCount(metrics.source_type_concentration.top_value), "Largest source-type share")}
        ${metric(metricCount(metrics.date_precision.year), "Year-precision records")}
        ${metric(metricCount(metrics.confidence.Medium), "Medium-confidence records")}
        ${metric(String(metrics.totals.records_with_explicit_rationales), "Records with explicit rationales")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Composition Signals</h2>
        <p class="section-note">Use these to choose what to inspect next, not to compare campuses.</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3>Source Types</h3>
          ${countRows(robustnessRows(metrics.source_type_concentration.values), "Source type", "Records")}
        </div>
        <div>
          <h3>Response Depth</h3>
          ${countRows(responseDepthRows, "Response depth", "Records")}
        </div>
      </div>
      <div class="detail-grid">
        <div>
          <h3>Categories</h3>
          ${countRows(robustnessRows(metrics.category_concentration.values), "Category", "Records")}
        </div>
        <div>
          <h3>Affected Communities</h3>
          ${countRows(robustnessRows(metrics.community_concentration.values), "Community", "Records")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Evidence-Depth Review Queues</h2>
        <p class="section-note">${escapeHtml(state.evidenceDepthQueues.method)}</p>
      </div>
      ${priorityQueues
        .map(
          (queue) => `
            <div class="section section--tight">
              <div class="section-header">
                <h3 class="section-title">${escapeHtml(queue.label)}</h3>
                <p class="section-note">${escapeHtml(queue.description)}</p>
              </div>
              ${evidenceDepthQueueTable(queue, recordById)}
            </div>
          `
        )
        .join("")}
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Gold Candidate Set and Challenge Pack</h2>
        <p class="section-note">Candidate status is a work queue, not outside approval.</p>
      </div>
      <div class="principle-grid">
        <div>
          <h3>Gold record candidates</h3>
          <p>${state.goldRecordSet.records.length} records prioritized for deeper source-text review after existing-metadata enrichment.</p>
          <p><a href="${sitePath("/data/gold-record-set.json")}">Open gold candidate JSON</a></p>
        </div>
        <div>
          <h3>Reviewer challenge pack</h3>
          <p>${state.reviewerChallengePack.records.length} records selected to help reviewers find ambiguity, source gaps, or wording that should be tightened.</p>
          <p><a href="${sitePath("/data/reviewer-challenge-pack.json")}">Open challenge pack JSON</a></p>
        </div>
      </div>
    </section>

    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Known Limits</h2>
        <p class="section-note">Snapshot ${escapeHtml(metrics.snapshot_id)}</p>
      </div>
      <ul>
        ${metrics.known_limits.map((limit) => `<li>${escapeHtml(limit)}</li>`).join("")}
      </ul>
      <p><a href="${sitePath("/data/robustness-metrics.json")}">Open robustness metrics JSON</a> / <a href="${sitePath("/data/evidence-depth-queues.json")}">Open evidence-depth queues JSON</a></p>
    </section>
  `;
}

function sourceProvenanceQueueTable(queue, recordById) {
  if (!queue?.records?.length) return `<p class="empty">No records are currently in this queue.</p>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Record</th>
            <th>School</th>
            <th>Import family</th>
            <th>Locator</th>
            <th>Review needs</th>
            <th>Packet</th>
          </tr>
        </thead>
        <tbody>
          ${queue.records
            .slice(0, 10)
            .map((row) => {
              const record = recordById.get(row.event_id);
              return `
                <tr>
                  <td class="summary-cell"><a href="${sitePath(row.event_url)}">${escapeHtml(record?.summary ?? row.event_id)}</a></td>
                  <td>${escapeHtml(record?.school?.name ?? row.school_id)}</td>
                  <td>${escapeHtml(row.import_family)}</td>
                  <td>${escapeHtml(row.locator_quality)}</td>
                  <td>${escapeHtml(row.review_needs.join("; "))}</td>
                  <td><a href="${sitePath(row.workspace_url)}">Open</a></td>
                </tr>
              `;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function objectCountRows(counts = {}, limit = 8) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function renderEvidence() {
  const root = document.querySelector("#evidence-root");
  if (!root) return;

  const capsules = state.evidenceCapsules;
  const queues = state.sourceProvenanceQueues.queues ?? [];
  const recordById = new Map(state.records.map((record) => [record.id, record]));
  const priorityQueues = ["dataset-cell-locator-review", "single-source-review", "response-depth-review", "explicit-rationale-review"]
    .map((id) => queues.find((queue) => queue.id === id))
    .filter(Boolean);

  root.innerHTML = `
    <section class="section section--tight">
      <div class="metric-grid metric-grid--dashboard">
        ${metric(String(capsules.totals.records ?? 0), "Evidence capsules")}
        ${metric(String(capsules.totals.records_with_single_source ?? 0), "Single-source capsules")}
        ${metric(String(capsules.totals.records_with_dataset_file_locator ?? 0), "Dataset-file locators")}
        ${metric(String(capsules.totals.records_with_source_page_locator ?? 0), "Source-page locators")}
        ${metric(String(queues.length), "Provenance queues")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Import and Locator Mix</h2>
        <p class="section-note">Generated from current event and source metadata; use as a review map.</p>
      </div>
      <div class="detail-grid">
        <div>
          <h3>Import families</h3>
          ${countRows(objectCountRows(capsules.import_family_counts), "Import family", "Records")}
        </div>
        <div>
          <h3>Locator quality</h3>
          ${countRows(objectCountRows(capsules.locator_quality_counts), "Locator", "Records")}
        </div>
      </div>
      <div class="detail-grid">
        <div>
          <h3>Review needs</h3>
          ${countRows(objectCountRows(capsules.review_need_counts), "Review need", "Records")}
        </div>
        <div>
          <h3>Artifacts</h3>
          <ul>
            <li><a href="${sitePath("/data/evidence-capsules.json")}">Evidence capsules JSON</a></li>
            <li><a href="${sitePath("/data/source-provenance-queues.json")}">Source provenance queues JSON</a></li>
            <li><a href="${sitePath("/schema/evidence-capsules.schema.json")}">Evidence capsules schema</a></li>
            <li><a href="${sitePath("/schema/source-provenance-queues.schema.json")}">Source provenance queues schema</a></li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Source-Provenance Queues</h2>
        <p class="section-note">${escapeHtml(state.sourceProvenanceQueues.method)}</p>
      </div>
      ${priorityQueues
        .map(
          (queue) => `
            <div class="section section--tight">
              <div class="section-header">
                <h3 class="section-title">${escapeHtml(queue.label)}</h3>
                <p class="section-note">${escapeHtml(queue.description)}</p>
              </div>
              ${sourceProvenanceQueueTable(queue, recordById)}
            </div>
          `
        )
        .join("")}
    </section>

    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Use Limit</h2>
        <p class="section-note">Capsules describe metadata support, not outside source re-review.</p>
      </div>
      <p>Evidence capsules are source-to-field review aids. They help reviewers find weak locators, dataset-cell follow-up needs, and missing rationales. They must not be used as comparative campus judgments, frequency measures, risk ratings, legal conclusions, or approval claims.</p>
    </section>
  `;
}

function renderImpact() {
  const root = document.querySelector("#impact-root");
  if (!root) return;

  const statesRepresented = unique(state.records.map((record) => [record.school?.state]));
  const communitiesRepresented = unique(state.records.map((record) => record.affected_communities));
  const sourceTypesRepresented = unique(state.sources.values ? [...state.sources.values()].map((source) => [source.source_type]) : []);
  const latestUpdated = state.records.map((record) => record.updated_at).sort().at(-1) ?? state.manifest.created_at;
  const liveChecked = (state.sourceAuditLive.entries ?? []).filter((entry) => entry.live_status === "ok").length;
  const updates = [...(state.productUpdates?.entries ?? [])].sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  const milestones = [...(state.productMilestones?.entries ?? [])].sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  const latestProductUpdate = updates[0]?.publish_date ?? state.manifest.created_at;

  root.innerHTML = `
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Proof Summary</h2>
        <p class="section-note">Current public snapshot and visible cadence</p>
      </div>
      <div class="metric-grid metric-grid--dashboard">
        ${metric(String(state.manifest.totals.events), "Public-source records")}
        ${metric(String(state.manifest.totals.schools), "Schools tracked")}
        ${metric(String(updates.length), "Product/archive improvements")}
        ${metric(String(milestones.length), "Selected milestones")}
        ${metric(String(state.manifest.totals.briefs), "Research briefs")}
        ${metric(formatDate(latestProductUpdate), "Latest product update")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Selected Milestones</h2>
        <p class="section-note">Curated project phases, not a dump of every update</p>
      </div>
      ${
        milestones.length
          ? `<ul class="update-list">
              ${milestones
                .map((entry) => {
                  const links = Array.isArray(entry.links) && entry.links.length
                    ? `<ul class="update-entry__links">
                        ${entry.links
                          .map(
                            (link) => `
                              <li><a href="${sitePath(link.href)}">${escapeHtml(link.label)}</a></li>
                            `
                          )
                          .join("")}
                      </ul>`
                    : "";
                  return `
                    <li class="update-entry">
                      <div class="update-entry__meta">
                        <span class="mono">${escapeHtml(entry.publish_date)}</span>
                        <span class="update-entry__category">${escapeHtml(entry.phase)}</span>
                      </div>
                      <h2>${escapeHtml(entry.title)}</h2>
                      <p>${escapeHtml(entry.summary)}</p>
                      ${links}
                    </li>
                  `;
                })
                .join("")}
            </ul>`
          : `<p class="empty">No selected milestones have been published yet.</p>`
      }
      <p class="section-copy">For the complete chronological maintenance log, use the <a href="${sitePath("/updates/")}">Updates page</a>.</p>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Research Infrastructure</h2>
        <p class="section-note">Public-source archive and research infrastructure</p>
      </div>
      <dl>
        <div class="data-line">
          <dt>Searchable archive</dt>
          <dd>Events, schools, sources, briefs, filters, generated detail pages, and source-backed school timelines are public and reproducible.</dd>
        </div>
        <div class="data-line">
          <dt>Research surfaces</dt>
          <dd>Briefs, the research workspace, the reviewer queue, the press brief, and the journalist guide extend the archive beyond record listings.</dd>
        </div>
        <div class="data-line">
          <dt>Exports and artifacts</dt>
          <dd>JSON, CSV, research exports, source audits, changelog, release notes, RSS, archived snapshots, and the public product/archive improvements log are all published.</dd>
        </div>
        <div class="data-line">
          <dt>Coverage dimensions</dt>
          <dd>${statesRepresented.length} states and jurisdictions, ${communitiesRepresented.length} community labels, and ${sourceTypesRepresented.length} source types are represented in the current dataset.</dd>
        </div>
        <div class="data-line">
          <dt>Latest dataset update</dt>
          <dd class="mono">${escapeHtml(latestUpdated)}</dd>
        </div>
      </dl>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Auditability and Correction</h2>
        <p class="section-note">Documentation, not prevalence</p>
      </div>
      <dl>
        <div class="data-line">
          <dt>Snapshot</dt>
          <dd class="mono">${escapeHtml(state.manifest.snapshot_id)}</dd>
        </div>
        <div class="data-line">
          <dt>Snapshot hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.full_snapshot)}</dd>
        </div>
        <div class="data-line">
          <dt>Live source audit</dt>
          <dd>${liveChecked} source URLs checked in the latest live audit artifact.</dd>
        </div>
        <div class="data-line">
          <dt>Correction path</dt>
          <dd>Public source submissions, corrections, duplicate reports, metadata fixes, and changelog artifacts are published as auditability and correction surfaces.</dd>
        </div>
        <div class="data-line">
          <dt>Reviewer path</dt>
          <dd>Use the <a href="${sitePath("/trust/")}">Trust & Review Packet</a>, <a href="${sitePath("/reviewer-brief/")}">Reviewer Brief</a>, <a href="${sitePath("/quality/")}">Quality page</a>, and <a href="${sitePath("/downloads/")}">Downloads</a> to inspect standards and artifacts without implying endorsement.</dd>
        </div>
        <div class="data-line">
          <dt>Public limits</dt>
          <dd>This public-source archive documents what has been collected, checked, and shipped. It does not measure prevalence, school quality, legal fault, or campus safety.</dd>
        </div>
      </dl>
    </section>
  `;
}

function renderUpdates() {
  const root = document.querySelector("#updates-root");
  if (!root) return;

  const entries = [...(state.productUpdates?.entries ?? [])].sort((a, b) => b.publish_date.localeCompare(a.publish_date));
  const latest = entries[0]?.publish_date ?? state.manifest.created_at;
  const categories = unique(entries.map((entry) => [entry.category]));

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Cadence</h2>
        <p class="section-note">Product consistency log</p>
      </div>
      <div class="metric-grid">
        ${metric(String(entries.length), "Published updates")}
        ${metric(String(categories.length), "Update categories")}
        ${metric(formatDate(latest), "Latest product update")}
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Recent Product Work</h2>
        <p class="section-note">Archive, workflow, and interface improvements</p>
      </div>
      ${
        entries.length
          ? `<ul class="update-list">
              ${entries
                .map((entry) => {
                  const links = Array.isArray(entry.links) && entry.links.length
                    ? `<ul class="update-entry__links">
                        ${entry.links
                          .map(
                            (link) => `
                              <li><a href="${sitePath(link.href)}">${escapeHtml(link.label)}</a></li>
                            `
                          )
                          .join("")}
                      </ul>`
                    : "";
                  return `
                    <li class="update-entry">
                      <div class="update-entry__meta">
                        <span class="mono">${escapeHtml(entry.publish_date)}</span>
                        <span class="update-entry__category">${escapeHtml(entry.category)}</span>
                      </div>
                      <h2>${escapeHtml(entry.title)}</h2>
                      <p>${escapeHtml(entry.summary)}</p>
                      ${links}
                    </li>
                  `;
                })
                .join("")}
            </ul>`
          : `<p class="empty">No public product updates have been published yet.</p>`
      }
    </section>
  `;
}

function renderDownloads() {
  const root = document.querySelector("#downloads-root");
  if (!root) return;
  const latestUpdated = state.records.map((record) => record.updated_at).sort().at(-1) ?? state.manifest.created_at;

  root.innerHTML = `
    <section class="section section--tight">
      <div class="section-header">
        <h2 class="section-title">Dataset Status</h2>
        <p class="section-note">Current snapshot</p>
      </div>
      <dl>
        <div class="data-line">
          <dt>Record count</dt>
          <dd>${state.manifest.totals.events}</dd>
        </div>
        <div class="data-line">
          <dt>Last updated</dt>
          <dd class="mono">${escapeHtml(latestUpdated)}</dd>
        </div>
        <div class="data-line">
          <dt>Schema version</dt>
          <dd class="mono">${escapeHtml(state.manifest.schema_version)}</dd>
        </div>
        <div class="data-line">
          <dt>Latest snapshot hash</dt>
          <dd class="mono">${escapeHtml(state.manifest.hashes.full_snapshot)}</dd>
        </div>
      </dl>
    </section>

    <section class="section section--tight">
      <div class="download-list">
        ${downloadRow("Research Workspace", sitePath("/research-workspace/"), "Local packet builder for reporters, researchers, and reviewers", false)}
        ${downloadRow("Events JSON", sitePath("/data/events.json"), `${state.manifest.totals.events} records`)}
        ${downloadRow("Events CSV", sitePath("/data/events.csv"), "Flat event export")}
        ${downloadRow("Research Events JSON", sitePath("/data/events-research.json"), "Events with school and source fields")}
        ${downloadRow("Research Events CSV", sitePath("/data/events-research.csv"), "Denormalized event export")}
        ${downloadRow("Schools JSON", sitePath("/data/schools.json"), `${state.manifest.totals.schools} schools`)}
        ${downloadRow("Schools CSV", sitePath("/data/schools.csv"), "Flat school export")}
        ${downloadRow("Research Schools JSON", sitePath("/data/schools-research.json"), "Schools with derived event counts")}
        ${downloadRow("Research Schools CSV", sitePath("/data/schools-research.csv"), "Denormalized school export")}
        ${downloadRow("Sources JSON", sitePath("/data/sources.json"), `${state.manifest.totals.sources} sources`)}
        ${downloadRow("Sources CSV", sitePath("/data/sources.csv"), "Flat source export")}
        ${downloadRow("Research Sources JSON", sitePath("/data/sources-research.json"), "Sources with related event IDs")}
        ${downloadRow("Research Sources CSV", sitePath("/data/sources-research.csv"), "Denormalized source export")}
        ${downloadRow("Source Audit JSON", sitePath("/data/source-audit.json"), "Source provenance checklist")}
        ${downloadRow("Live Source Audit JSON", sitePath("/data/source-audit-live.json"), `${state.sourceAuditLive.entries?.length ?? 0} live URL checks`)}
        ${downloadRow("Product Updates JSON", sitePath("/data/product-updates.json"), `${state.productUpdates?.entry_count ?? 0} public product entries`)}
        ${downloadRow("Milestones JSON", sitePath("/data/product-milestones.json"), `${state.productMilestones?.entry_count ?? 0} curated proof milestones`)}
        ${downloadRow("Changelog JSON", sitePath("/data/changelog.json"), "Record-level public edit log")}
        ${downloadRow("Public Product Updates Page", sitePath("/updates/"), "Human-readable archive and workflow changes", false)}
        ${downloadRow("Release Notes", sitePath("/RELEASE_NOTES.md"), state.manifest.snapshot_id)}
        ${downloadRow("Briefs JSON", sitePath("/data/briefs.json"), `${state.manifest.totals.briefs} briefs`)}
        ${downloadRow("Briefs RSS", sitePath("/rss.xml"), "Published research feed")}
        ${downloadRow("Corrections JSON", sitePath("/data/corrections.json"), `${state.manifest.totals.corrections} corrections`)}
        ${downloadRow("Review Log JSON", sitePath("/data/review-log.json"), `${state.manifest.totals.review_queues} review queues`)}
        ${downloadRow("Review Samples JSON", sitePath("/data/review-samples.json"), `${state.manifest.totals.review_samples} deterministic samples`)}
        ${downloadRow("Review Ledger JSON", sitePath("/data/review-ledger.json"), `${state.manifest.totals.review_ledger_entries} public review entries`)}
        ${downloadRow("Methodology Examples JSON", sitePath("/data/methodology-examples.json"), `${state.methodologyExamples.length} restraint examples`)}
        ${downloadRow("Workflow Definitions JSON", sitePath("/data/workflows.json"), `${state.workflows.workflows.length} task workflows`)}
        ${downloadRow("Release Metadata JSON", sitePath("/data/releases.json"), `${state.releases.releases.length} named releases`)}
        ${downloadRow("Release Verification JSON", sitePath("/data/release-verification.json"), `${state.releaseVerification?.status ?? "unknown"} local verification`)}
        ${downloadRow("Credibility Status JSON", sitePath("/data/credibility-status.json"), `${state.credibilityStatus.entries.length} bounded status entries`)}
        ${downloadRow("Robustness Metrics JSON", sitePath("/data/robustness-metrics.json"), `${state.robustnessMetrics?.totals?.events ?? 0} measured records`)}
        ${downloadRow("Evidence-Depth Queues JSON", sitePath("/data/evidence-depth-queues.json"), `${state.evidenceDepthQueues.queues.length} review queues`)}
        ${downloadRow("Gold Record Set JSON", sitePath("/data/gold-record-set.json"), `${state.goldRecordSet.records.length} candidate records`)}
        ${downloadRow("Reviewer Challenge Pack JSON", sitePath("/data/reviewer-challenge-pack.json"), `${state.reviewerChallengePack.records.length} challenge records`)}
        ${downloadRow("Evidence Capsules JSON", sitePath("/data/evidence-capsules.json"), `${state.evidenceCapsules.records.length} source-to-field capsules`)}
        ${downloadRow("Source Provenance Queues JSON", sitePath("/data/source-provenance-queues.json"), `${state.sourceProvenanceQueues.queues.length} provenance queues`)}
        ${downloadRow("Workflows Page", sitePath("/workflows/"), "Task-based entry points for public use", false)}
        ${downloadRow("Evidence Robustness Page", sitePath("/robustness/"), "Dataset composition and evidence-depth review priorities", false)}
        ${downloadRow("Evidence Provenance Page", sitePath("/evidence/"), "Source-to-field capsules and import provenance", false)}
        ${downloadRow("Replication Packet", sitePath("/replicate/"), "Commands and release verification artifacts", false)}
        ${downloadRow("Credibility Boundaries", sitePath("/credibility/"), "Review and acknowledgment status limits", false)}
        ${downloadRow("Public Codebook", sitePath("/codebook/"), "Operational definitions for record review", false)}
        ${downloadRow("Coverage Limits", sitePath("/coverage/"), "Responsible-use boundaries for coverage signals", false)}
        ${downloadRow("Methodology Stress Test", sitePath("/briefs/brief_2026_06_16_methodology_stress_test/"), "Where the archive can be wrong", false)}
        ${downloadRow("Snapshot Manifest", sitePath("/data/snapshot-manifest.json"), shortHash(state.manifest.hashes.full_snapshot))}
        ${downloadRow("Snapshot Index", sitePath("/data/snapshot-index.json"), `${state.snapshotIndex.snapshot_count} archived snapshots`)}
        ${downloadRow("Archived Snapshot", sitePath(`/data/snapshots/${state.manifest.snapshot_id}.json`), state.manifest.snapshot_id)}
        ${downloadRow("Data Dictionary", sitePath("/docs/data-dictionary.md"), "Field definitions")}
        ${downloadRow("Citation Guidance", sitePath("/docs/citation.md"), "How to cite records, briefs, and snapshots")}
        ${downloadRow("Contribution Guide", sitePath("/docs/contributing.md"), "Public-source GitHub workflow")}
        ${downloadRow("Source Audit Notes", sitePath("/docs/source-audit.md"), "Pre-launch source checks")}
        ${downloadRow("Correction Schema", sitePath("/schema/correction.schema.json"), "Correction fields")}
        ${downloadRow("Review Log Schema", sitePath("/schema/review-log.schema.json"), "Review workflow fields")}
        ${downloadRow("Review Ledger Schema", sitePath("/schema/review-ledger.schema.json"), "Public review ledger fields")}
        ${downloadRow("Methodology Examples Schema", sitePath("/schema/methodology-example.schema.json"), "Methodology example fields")}
        ${downloadRow("Workflow Schema", sitePath("/schema/workflow.schema.json"), "Workflow definition fields")}
        ${downloadRow("Release Schema", sitePath("/schema/release.schema.json"), "Release metadata fields")}
        ${downloadRow("Release Verification Schema", sitePath("/schema/release-verification.schema.json"), "Release verification fields")}
        ${downloadRow("Credibility Status Schema", sitePath("/schema/credibility-status.schema.json"), "Credibility status fields")}
        ${downloadRow("Robustness Metrics Schema", sitePath("/schema/robustness-metrics.schema.json"), "Robustness metric fields")}
        ${downloadRow("Evidence-Depth Queues Schema", sitePath("/schema/evidence-depth-queues.schema.json"), "Evidence-depth queue fields")}
        ${downloadRow("Gold Record Set Schema", sitePath("/schema/gold-record-set.schema.json"), "Gold candidate fields")}
        ${downloadRow("Reviewer Challenge Pack Schema", sitePath("/schema/reviewer-challenge-pack.schema.json"), "Challenge pack fields")}
        ${downloadRow("Evidence Capsules Schema", sitePath("/schema/evidence-capsules.schema.json"), "Evidence capsule fields")}
        ${downloadRow("Source Provenance Queues Schema", sitePath("/schema/source-provenance-queues.schema.json"), "Source provenance queue fields")}
        ${downloadRow("Dataset License", sitePath("/DATA_LICENSE.md"), "Reuse terms")}
        ${downloadRow("Code License", sitePath("/LICENSE.md"), "MIT License")}
      </div>
    </section>
  `;
}

function downloadRow(title, href, meta, downloadable = true) {
  return `
    <div class="download-row">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(meta)}</p>
      </div>
      <a href="${href}"${downloadable ? " download" : ""}>${downloadable ? "Download" : "Open"}</a>
    </div>
  `;
}

async function init() {
  const initDocument = document;
  setCurrentNav();
  try {
    await loadDataset();
    if (document !== initDocument) return;
    renderDashboard();
    renderEvents();
    renderSchools();
    renderBriefs();
    renderSources();
    renderQuality();
    renderSubmitWorkflow();
    renderResearchWorkspace();
    renderReviewerQueue();
    renderWorkflows();
    renderRobustness();
    renderEvidence();
    renderImpact();
    renderUpdates();
    renderDownloads();
  } catch (error) {
    if (document !== initDocument) return;
    const target = document.querySelector("[data-error-root]");
    if (target) target.textContent = error.message;
    console.error(error);
  }
}

window.__campusEvidenceLabReady = init();
