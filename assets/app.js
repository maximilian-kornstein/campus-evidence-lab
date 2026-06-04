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
  manifest: sitePath("/data/snapshot-manifest.json"),
  snapshotIndex: sitePath("/data/snapshot-index.json"),
  sourceAudit: sitePath("/data/source-audit.json")
};

const state = {
  records: [],
  schoolsList: [],
  briefs: [],
  corrections: [],
  reviewLog: null,
  snapshotIndex: null,
  sourceAudit: null,
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

async function loadDataset() {
  const [events, schools, sources, briefs, corrections, reviewLog, manifest, snapshotIndex, sourceAudit] = await Promise.all([
    fetchJson(DATA_PATHS.events),
    fetchJson(DATA_PATHS.schools),
    fetchJson(DATA_PATHS.sources),
    fetchJson(DATA_PATHS.briefs),
    fetchJson(DATA_PATHS.corrections),
    fetchJson(DATA_PATHS.reviewLog),
    fetchJson(DATA_PATHS.manifest),
    fetchJson(DATA_PATHS.snapshotIndex),
    fetchJson(DATA_PATHS.sourceAudit)
  ]);

  state.schools = new Map(schools.map((school) => [school.id, school]));
  state.schoolsList = schools;
  state.sources = new Map(sources.map((source) => [source.id, source]));
  state.manifest = manifest;
  state.briefs = briefs;
  state.corrections = corrections;
  state.reviewLog = reviewLog;
  state.snapshotIndex = snapshotIndex;
  state.sourceAudit = sourceAudit;
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
          <span class="metric__label">States represented</span>
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
  const query = state.filters.q.trim().toLowerCase();
  return state.records.filter((record) => {
    const school = record.school ?? {};
    const sourceText = record.sources
      .map((source) => [source.title, source.publisher, source.source_type, source.published_date].join(" "))
      .join(" ");
    const haystack = [
      record.id,
      record.summary,
      record.description,
      record.category,
      record.confidence,
      record.verification_status,
      record.institutional_response,
      record.legal_status,
      school.name,
      school.state,
      sourceText,
      ...record.source_types,
      ...record.affected_communities,
      ...record.tags
    ]
      .join(" ")
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
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
  });
}

function sortedRecords(records) {
  return [...records].sort((a, b) => {
    switch (state.filters.sort) {
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
      <p class="section-note download-inline">Download current dataset: <a href="${sitePath("/data/events.json")}" download>Events JSON</a> / <a href="${sitePath("/data/events.csv")}" download>Events CSV</a> / <a href="${sitePath("/data/events-research.json")}" download>Research JSON</a> / <a href="${sitePath("/data/events-research.csv")}" download>Research CSV</a></p>
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
  renderEvents();
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
        <dl>
          <div class="data-line">
            <dt>Institutional response</dt>
            <dd>${escapeHtml(record.institutional_response)}</dd>
          </div>
          <div class="data-line">
            <dt>Legal status</dt>
            <dd>${escapeHtml(record.legal_status)}</dd>
          </div>
          <div class="data-line">
            <dt>Response date</dt>
            <dd class="mono">${escapeHtml(record.response_date || "None recorded")}</dd>
          </div>
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
  const states = unique(state.schoolsList.map((school) => [school.state]));
  const sortOptions = [
    { value: "records_desc", label: "Most records" },
    { value: "name_asc", label: "School A-Z" },
    { value: "latest_desc", label: "Most recent update" }
  ];
  const rows = sortedSchoolRows(
    state.schoolsList
    .map((school) => ({ school, stats: schoolStats(school.id) }))
      .filter(({ school }) => {
        const query = state.schoolFilters.q.trim().toLowerCase();
        if (query && ![school.name, school.city, school.state, school.id].join(" ").toLowerCase().includes(query)) {
          return false;
        }
        if (state.schoolFilters.state && school.state !== state.schoolFilters.state) return false;
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
  if (state.schoolFilters.sort !== "records_desc") params.set("sort", state.schoolFilters.sort);
  const query = params.toString();
  window.history.replaceState(null, "", sitePath(query ? `/schools/?${query}` : "/schools/"));
}

function updateSchoolFilters(event) {
  const formData = new FormData(event.currentTarget);
  state.schoolFilters = {
    q: String(formData.get("q") || ""),
    state: String(formData.get("state") || ""),
    sort: String(formData.get("sort") || "records_desc")
  };
  updateSchoolsUrl();
  renderSchools();
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
  const query = state.sourceFilters.q.trim().toLowerCase();
  return [...state.sources.values()]
    .map((source) => {
      const events = state.records.filter((record) => record.source_ids.includes(source.id));
      const schoolNames = unique(events.map((record) => [record.school?.name]));
      const haystack = [
        source.id,
        source.title,
        source.url,
        source.publisher,
        source.source_type,
        source.published_date,
        source.accessed_date,
        ...schoolNames,
        ...events.map((record) => record.id),
        ...events.map((record) => record.summary),
        ...events.map((record) => record.affected_communities).flat()
      ]
        .join(" ")
        .toLowerCase();

      return {
        source,
        events,
        schools: schoolNames,
        latestEventDate: events.map((record) => record.date).sort().at(-1) ?? "",
        audit: state.sourceAudit?.entries?.find((entry) => entry.source_id === source.id),
        haystack
      };
    })
    .filter(({ source, events, haystack }) => {
      if (query && !haystack.includes(query)) return false;
      if (state.sourceFilters.sourceType && source.source_type !== state.sourceFilters.sourceType) return false;
      if (state.sourceFilters.publisher && source.publisher !== state.sourceFilters.publisher) return false;
      return true;
    });
}

function sortedSourceRows(rows) {
  return [...rows].sort((a, b) => {
    switch (state.sourceFilters.sort) {
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
  renderSources();
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
  const sourceIds = unique(stats.records.map((record) => record.source_ids));
  const sources = sourceIds.map((id) => state.sources.get(id)).filter(Boolean);
  const responseRecords = stats.records.filter((record) => record.institutional_response);
  const legalRecords = stats.records.filter((record) =>
    /ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(`${record.category} ${record.legal_status}`)
  );

  panel.innerHTML = `
    <div class="detail-grid">
      <div>
        <p class="page-kicker">${escapeHtml(school.state)} / ${escapeHtml(school.city)}</p>
        <h2>${escapeHtml(school.name)}</h2>
        <p>${stats.count} public-source record${stats.count === 1 ? "" : "s"} in the current dataset.</p>
        <p><a href="${sitePath(`/events/?school=${encodeURIComponent(school.id)}`)}">Open event database filtered to this school</a></p>
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
          ${
            school.website
              ? `<div class="data-line">
                  <dt>Website</dt>
                  <dd><a href="${escapeHtml(school.website)}" target="_blank" rel="noreferrer">${escapeHtml(school.website)}</a></dd>
                </div>`
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
              ${stats.records
                .map(
                  (record) => `
                    <tr>
                      <td class="mono">${escapeHtml(formatDate(record.date, record.date_precision))}</td>
                      <td>${escapeHtml(record.category)}</td>
                      <td><a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.summary)}</a></td>
                      <td>${record.sources.length}</td>
                    </tr>
                  `
                )
                .join("")}
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
                            <td>${escapeHtml(record.institutional_response)}</td>
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
  const responseRecords = records.filter((record) => record.institutional_response);
  if (!responseRecords.length) return `<p class="empty">No institutional responses recorded in this brief.</p>`;
  return `
    <ul class="source-list">
      ${responseRecords
        .map(
          (record) => `
            <li>
              <a href="${sitePath(`/events/${encodeURIComponent(record.id)}/`)}">${escapeHtml(record.school?.name ?? "Unknown")}</a>
              <br><span>${escapeHtml(record.institutional_response)}</span>
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

function verificationRationale(record) {
  const sourceCount = record.sources?.length ?? record.source_ids?.length ?? 0;
  const sourceTypes = join(record.source_types);
  return `${record.verification_status}; ${sourceCount} public source${sourceCount === 1 ? "" : "s"} reviewed (${sourceTypes}). Confidence reflects source support, not severity.`;
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
            <option>Public safety notice</option>
            <option>Public legal filing</option>
            <option>Government release</option>
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
            <option>Disability</option>
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

    <section class="section">
      <div class="section-header">
        <h2 class="section-title">Generated Packet</h2>
        <p class="section-note">Public-source review format</p>
      </div>
      <textarea id="submission-output" class="packet-output" rows="14" readonly aria-label="Generated review packet"></textarea>
    </section>
  `;

  document.querySelector("#source-submission-form").addEventListener("submit", handleSourceSubmission);
  document.querySelector("#correction-request-form").addEventListener("submit", handleCorrectionSubmission);
  document.querySelector("#duplicate-report-form").addEventListener("submit", handleDuplicateReport);
  document.querySelector("#school-metadata-form").addEventListener("submit", handleSchoolMetadataCorrection);
}

function assertPublicUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("Use an HTTPS public source URL.");
  }
  return url.toString();
}

function setPacketOutput(value) {
  const output = document.querySelector("#submission-output");
  if (output) output.value = value;
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
    setPacketOutput(JSON.stringify(packet, null, 2));
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
    setPacketOutput(JSON.stringify(packet, null, 2));
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
    setPacketOutput(JSON.stringify(packet, null, 2));
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
    setPacketOutput(JSON.stringify(packet, null, 2));
  } catch (error) {
    setPacketOutput(error.message);
  }
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
        ${downloadRow("Changelog JSON", sitePath("/data/changelog.json"), "Record-level public edit log")}
        ${downloadRow("Release Notes", sitePath("/RELEASE_NOTES.md"), state.manifest.snapshot_id)}
        ${downloadRow("Briefs JSON", sitePath("/data/briefs.json"), `${state.manifest.totals.briefs} briefs`)}
        ${downloadRow("Briefs RSS", sitePath("/rss.xml"), "Published research feed")}
        ${downloadRow("Corrections JSON", sitePath("/data/corrections.json"), `${state.manifest.totals.corrections} corrections`)}
        ${downloadRow("Review Log JSON", sitePath("/data/review-log.json"), `${state.manifest.totals.review_queues} review queues`)}
        ${downloadRow("Snapshot Manifest", sitePath("/data/snapshot-manifest.json"), shortHash(state.manifest.hashes.full_snapshot))}
        ${downloadRow("Snapshot Index", sitePath("/data/snapshot-index.json"), `${state.snapshotIndex.snapshot_count} archived snapshots`)}
        ${downloadRow("Archived Snapshot", sitePath(`/data/snapshots/${state.manifest.snapshot_id}.json`), state.manifest.snapshot_id)}
        ${downloadRow("Data Dictionary", sitePath("/docs/data-dictionary.md"), "Field definitions")}
        ${downloadRow("Citation Guidance", sitePath("/docs/citation.md"), "How to cite records, briefs, and snapshots")}
        ${downloadRow("Contribution Guide", sitePath("/docs/contributing.md"), "Public-source GitHub workflow")}
        ${downloadRow("Source Audit Notes", sitePath("/docs/source-audit.md"), "Pre-launch source checks")}
        ${downloadRow("Correction Schema", sitePath("/schema/correction.schema.json"), "Correction fields")}
        ${downloadRow("Review Log Schema", sitePath("/schema/review-log.schema.json"), "Review workflow fields")}
        ${downloadRow("Dataset License", sitePath("/DATA_LICENSE.md"), "Reuse terms")}
        ${downloadRow("Code License", sitePath("/LICENSE.md"), "MIT License")}
      </div>
    </section>
  `;
}

function downloadRow(title, href, meta) {
  return `
    <div class="download-row">
      <div>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(meta)}</p>
      </div>
      <a href="${href}" download>Download</a>
    </div>
  `;
}

async function init() {
  setCurrentNav();
  try {
    await loadDataset();
    renderDashboard();
    renderEvents();
    renderSchools();
    renderBriefs();
    renderSources();
    renderQuality();
    renderSubmitWorkflow();
    renderDownloads();
  } catch (error) {
    const target = document.querySelector("[data-error-root]");
    if (target) target.textContent = error.message;
    console.error(error);
  }
}

init();
