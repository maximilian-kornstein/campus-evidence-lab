import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { paths, readJson, rootDir } from "./lib.mjs";

const errors = [];
const siteRoot = process.env.SITE_ROOT ? path.resolve(rootDir, process.env.SITE_ROOT) : rootDir;
const appUrl = pathToFileURL(path.join(siteRoot, "assets", "app.js")).href;
const [events, schools, sources] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources)
]);

const pages = [
  {
    route: "/",
    file: "index.html",
    checks: [
      String(events.length),
      "Communities represented",
      "States and jurisdictions represented",
      "Campus civil-rights records",
      "Audience Entry Points",
      "Journalist Path",
      "Research Path",
      "Research Entry Points",
      "Search Event Database",
      "Latest Weekly Brief",
      "Read Methodology",
      "Impact Page",
      "Product Updates",
      "Trust & Review Packet",
      "Reviewer Brief",
      "Contributor Guide",
      "Research Workspace",
      "Reviewer Queue",
      "Download Data",
      "Trend Charts",
      "Records by Event Month",
      "Records by Affected Community",
      "Records by Source Type",
      "Small charts summarize current public records"
    ],
    linkChecks: ["/events/", "/methodology/", "/impact/", "/trust/", "/reviewer-brief/", "/guide/", "/research-guide/", "/research-workspace/", "/reviewer-queue/", "/downloads/", "/briefs/brief_2026_06_11_findings_memo_001_archive_visibility/"],
    dashboardSmoke: true
  },
  {
    route: "/events/",
    file: "events/index.html",
    checks: ["Search", "Source type", "Verification", "Sort", "Search relevance", "Community", "Sources", "Updated", "Copy Share Link", "Download Filtered JSON", "Download Filtered CSV", "Open Research Workspace", "Events JSON", "Events CSV", "Research JSON", "Research CSV", "University of Kentucky", "Asian, Black, Latino, Native, Indigenous"],
    linkChecks: ["/sources/src_uky_2025_09_23_ocr_phd_project/"],
    eventsSmoke: true
  },
  {
    route: "/events/?q=Brown%20University%20announced%20a%20voluntary%20agreement",
    file: "events/index.html",
    checks: ["Public institutional response", "Brown said it agreed to continue nondiscrimination training", "Response date"]
  },
  {
    route: "/schools/",
    file: "schools/index.html",
    checks: ["Tracked Schools", "Search schools", "Most recent update", "Dossier", "Build Citation Packet", "University of Kentucky"],
    schoolsSmoke: true
  },
  {
    route: "/schools/?q=Brown",
    file: "schools/index.html",
    checks: ["Brown University Dossier", "Institutional Responses", "Brown said it agreed to continue nondiscrimination training"],
    absentChecks: ["does not independently evaluate investigative, disciplinary, or institutional response outcomes."]
  },
  {
    route: "/briefs/",
    file: "briefs/index.html",
    checks: ["Published Briefs", "Broader Civil Rights Scope Seed", "Source-Type Breakdown", "Legal/OCR Updates", "Dataset Downloads"]
  },
  {
    route: "/sources/",
    file: "sources/index.html",
    checks: ["Source Index", "Search sources", "Source type", "Publisher", "Sort", "Search relevance", "Audit", "External source URL", "Source Audit JSON", "University of Kentucky OCR Case Number 03-25-2099"],
    linkChecks: ["/sources/src_uky_2025_09_23_ocr_phd_project/"],
    sourcesSmoke: true
  },
  {
    route: "/quality/",
    file: "quality/index.html",
    checks: ["Snapshot Integrity", "Review System", "Black", "Latino", "Native", "Indigenous"]
  },
  {
    route: "/impact/",
    file: "impact/index.html",
    checks: ["Proof Summary", "Selected Milestones", "Research Infrastructure", "Auditability and Correction", "How To Inspect This Work", "Documentation, Not Prevalence", "Claims Not Made", String(events.length), String(schools.length)],
  },
  {
    route: "/updates/",
    file: "updates/index.html",
    checks: ["Public product updates", "What This Page Tracks", "Cadence", "Recent Product Work", "Institutional response visibility upgrade", "Product consistency log", "Impact page"]
  },
  {
    route: "/trust/",
    file: "trust/index.html",
    checks: ["Trust & Review Packet", "Current Proof Package", "What A Reviewer Can Audit In 30 Minutes", "Review Tasks", "What Trust Signals Prove", "What They Do Not Prove", "Reviewer Entry Points", "Acknowledgment Rule", "Impact page"],
    linkChecks: ["../impact/", "../methodology/", "../quality/", "../research-guide/", "../downloads/", "../acknowledgments/", "../press/", "../journalist-guide/"]
  },
  {
    route: "/press/",
    file: "press/index.html",
    checks: ["Press / Research Brief", "What Campus Evidence Lab Is", "What It Is Not", "Current Public Scale", "Start Here By Task", "Build a reporting packet", "Press and research contact", "maxkornstein04@gmail.com"],
    linkChecks: ["../methodology/", "../reviewer-brief/", "../trust/", "../downloads/", "../research-guide/", "../briefs/", "../journalist-guide/", "../schools/"]
  },
  {
    route: "/acknowledgments/",
    file: "acknowledgments/index.html",
    checks: ["No public acknowledgments yet", "Acknowledgment Criteria", "Future Categories", "Methodology reviewer", "Source audit reviewer", "Organizational collaborator"],
    linkChecks: ["../trust/"]
  },
  {
    route: "/reviewer-brief/",
    file: "reviewer-brief/index.html",
    checks: ["Reviewer Brief", "A small ask for outside critique", "Project In One Paragraph", "Three Review Questions", "Suggested 10-Record Sample", "Acknowledgment Boundary", "Download the Markdown reviewer packet"],
    linkChecks: ["../methodology/", "../research-guide/", "../trust/", "../reviewer-queue/", "../docs/reviewer-brief.md"]
  },
  {
    route: "/journalist-guide/",
    file: "journalist-guide/index.html",
    checks: ["Journalist Use Guide", "Who This Is For", "Fast Start Paths", "How To Use The Archive", "Before Publication Checklist", "Common Mistakes To Avoid", "maxkornstein04@gmail.com"],
    linkChecks: ["../schools/", "../events/", "../downloads/", "../docs/citation.md", "../research-guide/", "../methodology/", "../press/", "../briefs/"]
  },
  {
    route: "/guide/",
    file: "guide/index.html",
    checks: ["Contributor Guide", "Accepted Sources", "Rejected Material", "Submission Workflow", "Partner and Reviewer Path", "Trust & Review Packet", "reviewer-checklist.yml", "npm run prepare:data", "npm run check"]
  },
  {
    route: "/research-guide/",
    file: "research-guide/index.html",
    checks: ["Research Guide", "Use the archive without overstating it", "Read Counts As Documentation", "Cite The Snapshot", "Responsible Output Checklist"]
  },
  {
    route: "/research-workspace/?record_ids=evt_2026_0027",
    file: "research-workspace/index.html",
    checks: ["Research Workspace", "Start Here", "Quick Packet Presets", "Record Selection", "Citation Packet", "Selection is encoded in the URL", "Snapshot hash", "University of Kentucky", "evt_2026_0027"],
    workspaceSmoke: true
  },
  {
    route: "/reviewer-queue/",
    file: "reviewer-queue/index.html",
    checks: ["Reviewer Queue", "Review Priorities", "Low-Confidence Review Sample", "Classification Review Sample", "Source Expansion Sample", "Open checklist", "Build sample packet"]
  },
  {
    route: "/downloads/",
    file: "downloads/index.html",
    checks: ["Choose The Right Artifact", "Dataset Status", "Record count", "Last updated", "Schema version", "Latest snapshot hash", "Research Workspace", "Events JSON", "Research Events JSON", "Research Events CSV", "Research Schools JSON", "Research Schools CSV", "Research Sources JSON", "Research Sources CSV", "Source Audit JSON", "Milestones JSON", "Changelog JSON", "Release Notes", "Snapshot Index", "Citation Guidance", "Contribution Guide", "Briefs RSS", "Source Audit Notes", "Corrections JSON", "Review Log JSON"]
  },
  {
    route: "/about/",
    file: "about/index.html",
    checks: ["Mission", "Founder Note", "Why This Starts Narrow", "Open-Source Commitment", "Contact and Contributions"]
  },
  {
    route: "/submit/?record_id=evt_2026_0027",
    file: "submit/index.html",
    checks: [
      "Generate Review Packet",
      "Generate Correction Packet",
      "Generate Duplicate Packet",
      "Generate Metadata Packet",
      "Read the contributor guide",
      "Affected community",
      "Event category"
    ],
    submitSmoke: true
  }
];

function responseForPath(urlPath) {
  const cleanPath = urlPath.split("?")[0].replace(/^\/+/, "");
  return path.join(siteRoot, cleanPath);
}

function installGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value
  });
}

async function installGlobals(dom) {
  installGlobal("window", dom.window);
  installGlobal("document", dom.window.document);
  installGlobal("navigator", dom.window.navigator);
  installGlobal("FormData", dom.window.FormData);
  installGlobal("Event", dom.window.Event);
  installGlobal("HTMLElement", dom.window.HTMLElement);
  installGlobal("URLSearchParams", dom.window.URLSearchParams);
  installGlobal("fetch", async (url) => {
    const urlPath = typeof url === "string" ? url : url.url;
    const filePath = responseForPath(urlPath);
    try {
      const body = await readFile(filePath, "utf8");
      return new Response(body, {
        status: 200,
        headers: { "content-type": filePath.endsWith(".json") ? "application/json" : "text/plain" }
      });
    } catch {
      return new Response("", { status: 404 });
    }
  });
}

async function waitForText(dom, expectedText) {
  const deadline = Date.now() + 1500;
  while (Date.now() < deadline) {
    if (dom.window.document.body.textContent.includes(expectedText)) return true;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return false;
}

function visibleText(element) {
  return element.textContent.replace(/\s+/g, " ").trim();
}

function hasAccessibleName(element, document) {
  const id = element.getAttribute("id");
  if (element.getAttribute("aria-label")) return true;
  if (element.getAttribute("aria-labelledby")) return true;
  if (id && document.querySelector(`label[for="${id}"]`)) return true;
  return Boolean(element.closest("label"));
}

function checkRenderedAccessibility(dom, file) {
  const { document } = dom.window;

  for (const control of document.querySelectorAll("input, select, textarea")) {
    if (!hasAccessibleName(control, document)) {
      errors.push(`${file} rendered an unlabelled ${control.tagName.toLowerCase()} control`);
    }
  }

  const ids = new Map();
  for (const element of document.querySelectorAll("[id]")) {
    const id = element.getAttribute("id");
    ids.set(id, (ids.get(id) ?? 0) + 1);
  }
  for (const [id, count] of ids.entries()) {
    if (count > 1) errors.push(`${file} rendered duplicate id "${id}"`);
  }

  for (const table of document.querySelectorAll("table")) {
    if (!table.querySelector("th")) {
      errors.push(`${file} rendered a table without header cells`);
    }
    for (const th of table.querySelectorAll("th")) {
      if (!visibleText(th)) errors.push(`${file} rendered an empty table header`);
    }
  }

  for (const link of document.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (!visibleText(link) && !link.getAttribute("aria-label")) {
      errors.push(`${file} rendered a link without accessible text: ${href}`);
    }
    if (link.getAttribute("target") === "_blank") {
      const rel = link.getAttribute("rel") ?? "";
      if (!/\bnoreferrer\b/.test(rel)) {
        errors.push(`${file} rendered target _blank link without rel noreferrer: ${href}`);
      }
    }
  }
}

async function renderPage(page, index) {
  const html = await readFile(path.join(siteRoot, page.file), "utf8");
  const dom = new JSDOM(html, {
    url: `https://campusevidencelab.test${page.route}`,
    pretendToBeVisual: true
  });
  dom.window.__packetScrolls = [];
  dom.window.scrollTo = (options) => {
    dom.window.__packetScrolls.push(options);
  };

  await installGlobals(dom);
  await import(`${appUrl}?qa_render=${Date.now()}_${index}`);
  await dom.window.__campusEvidenceLabReady;

  for (const text of page.checks) {
    if (!(await waitForText(dom, text))) {
      errors.push(`${page.file} did not render expected text: ${text}`);
    }
  }

  for (const text of page.absentChecks ?? []) {
    if (dom.window.document.body.textContent.includes(text)) {
      errors.push(`${page.file} rendered unexpected text: ${text}`);
    }
  }

  for (const href of page.linkChecks ?? []) {
    if (!dom.window.document.querySelector(`a[href="${href}"]`)) {
      errors.push(`${page.file} did not render expected internal link: ${href}`);
    }
  }

  checkRenderedAccessibility(dom, page.file);

  if (page.dashboardSmoke) {
    const trendPanels = dom.window.document.querySelectorAll(".trend-panel");
    const actionLinks = dom.window.document.querySelectorAll(".action-link");
    if (trendPanels.length !== 3) {
      errors.push(`${page.file} rendered ${trendPanels.length} trend panels; expected 3`);
    }
    if (actionLinks.length !== 16) {
      errors.push(`${page.file} rendered ${actionLinks.length} research entry links; expected 16`);
    }
    for (const panel of trendPanels) {
      if (panel.getAttribute("role") !== "img" || !panel.getAttribute("aria-label")) {
        errors.push(`${page.file} rendered a trend panel without accessible chart labeling`);
      }
      if (!panel.querySelector(".trend-row")) {
        errors.push(`${page.file} rendered a trend panel without textual rows`);
      }
    }

    const dashboardTable = dom.window.document.querySelector(".record-table--dashboard");
    const dashboardCells = dashboardTable?.querySelectorAll("tbody tr:first-child td") ?? [];
    if (!dashboardTable || dashboardCells.length === 0) {
      errors.push(`${page.file} did not render a responsive dashboard record table`);
    }
    for (const cell of dashboardCells) {
      if (!cell.getAttribute("data-label")) {
        errors.push(`${page.file} dashboard record cell is missing a mobile data-label`);
      }
    }
  }

  if (page.submitSmoke) {
    const sourceForm = dom.window.document.querySelector("#source-submission-form");
    const correctionForm = dom.window.document.querySelector("#correction-request-form");
    const duplicateForm = dom.window.document.querySelector("#duplicate-report-form");
    const metadataForm = dom.window.document.querySelector("#school-metadata-form");
    const output = dom.window.document.querySelector("#submission-output");
    const copyButton = dom.window.document.querySelector("#copy-packet");
    const issueLink = dom.window.document.querySelector("#open-github-issue");
    const packetSection = dom.window.document.querySelector("#generated-packet-section");
    if (!sourceForm || !correctionForm || !duplicateForm || !metadataForm || !output || !copyButton || !issueLink || !packetSection) {
      errors.push(`${page.file} did not render all required intake forms`);
      return;
    }
    async function checkPacketReveal(label) {
      await new Promise((resolve) => dom.window.requestAnimationFrame(resolve));
      const scroll = dom.window.__packetScrolls.at(-1);
      const expectedTop = packetSection.getBoundingClientRect().top + dom.window.scrollY;
      if (!scroll || scroll.top !== expectedTop || scroll.left !== 0) {
        errors.push(`${page.file} ${label} did not scroll exactly to generated packet section`);
      }
      if (dom.window.document.activeElement !== output) {
        errors.push(`${page.file} ${label} did not focus generated packet output`);
      }
    }
    if (correctionForm.elements.record_id.value !== "evt_2026_0027") {
      errors.push(`${page.file} did not prefill correction record ID from URL`);
    }
    sourceForm.elements.source_url.value = "https://example.edu/public-source";
    sourceForm.elements.school.value = "Example University, City, ST";
    sourceForm.elements.source_type.value = "Government release";
    sourceForm.elements.affected_community.value = "Black";
    sourceForm.elements.event_category.value = "Harassment or threat";
    sourceForm.elements.relevance.value = "Public source may document a campus civil-rights record.";
    sourceForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await checkPacketReveal("source submission");

    for (const text of ["source-submission", "affected_community", "event_category", "No private screenshots"]) {
      if (!output.value.includes(text)) {
        errors.push(`${page.file} generated packet missing ${text}`);
      }
    }
    if (copyButton.disabled) {
      errors.push(`${page.file} did not enable packet copy after source submission`);
    }
    let issueParams = new URL(issueLink.href).searchParams;
    if (!issueLink.href.includes("issues/new") || !issueParams.get("title")?.includes("Source submission")) {
      errors.push(`${page.file} source submission issue link has invalid title`);
    }
    for (const text of ["source-submission", "pending-review"]) {
      if (!issueParams.toString().includes(text)) errors.push(`${page.file} source submission issue link missing ${text}`);
    }

    correctionForm.elements.record_id.value = "evt_2025_0010";
    correctionForm.elements.field.value = "summary";
    correctionForm.elements.source_url.value = "https://example.edu/correction-source";
    correctionForm.elements.correction.value = "Use the public source wording.";
    correctionForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await checkPacketReveal("correction submission");
    for (const text of ["correction-request", "record_id", "requested_correction"]) {
      if (!output.value.includes(text)) {
        errors.push(`${page.file} correction packet missing ${text}`);
      }
    }
    issueParams = new URL(issueLink.href).searchParams;
    if (!issueLink.href.includes("issues/new") || !issueParams.get("title")?.includes("Correction request")) {
      errors.push(`${page.file} correction issue link has invalid title`);
    }
    for (const text of ["correction-request", "pending-review"]) {
      if (!issueParams.toString().includes(text)) errors.push(`${page.file} correction issue link missing ${text}`);
    }

    duplicateForm.elements.primary_record_id.value = "evt_2025_0010";
    duplicateForm.elements.duplicate_record_id.value = "evt_2025_0011";
    duplicateForm.elements.source_url.value = "https://example.edu/duplicate-source";
    duplicateForm.elements.duplicate_reason.value = "Both records appear to describe the same source-backed event.";
    duplicateForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await checkPacketReveal("duplicate submission");
    for (const text of ["duplicate-report", "primary_record_id", "duplicate_record_id"]) {
      if (!output.value.includes(text)) {
        errors.push(`${page.file} duplicate packet missing ${text}`);
      }
    }
    issueParams = new URL(issueLink.href).searchParams;
    if (!issueLink.href.includes("issues/new") || !issueParams.get("title")?.includes("Duplicate report")) {
      errors.push(`${page.file} duplicate issue link has invalid title`);
    }
    for (const text of ["duplicate-report", "pending-review"]) {
      if (!issueParams.toString().includes(text)) errors.push(`${page.file} duplicate issue link missing ${text}`);
    }

    metadataForm.elements.school.value = "Example University";
    metadataForm.elements.field.value = "state";
    metadataForm.elements.source_url.value = "https://example.edu/metadata-source";
    metadataForm.elements.metadata_correction.value = "Use the public source school metadata.";
    metadataForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    await checkPacketReveal("metadata submission");
    for (const text of ["school-metadata-correction", "requested_metadata_correction", "public_source_url"]) {
      if (!output.value.includes(text)) {
        errors.push(`${page.file} metadata packet missing ${text}`);
      }
    }
    issueParams = new URL(issueLink.href).searchParams;
    if (!issueLink.href.includes("issues/new") || !issueParams.get("title")?.includes("School metadata correction")) {
      errors.push(`${page.file} metadata issue link has invalid title`);
    }
    for (const text of ["school-metadata-correction", "pending-review"]) {
      if (!issueParams.toString().includes(text)) errors.push(`${page.file} metadata issue link missing ${text}`);
    }
  }

  if (page.workspaceSmoke) {
    const searchForm = dom.window.document.querySelector("#workspace-search-form");
    const packetForm = dom.window.document.querySelector("#workspace-packet-form");
    const output = dom.window.document.querySelector("#workspace-packet-output");
    const selectedToggle = dom.window.document.querySelector('.workspace-record-toggle[value="evt_2026_0027"]');
    const addVisible = dom.window.document.querySelector("#workspace-add-visible");
    const clearSelection = dom.window.document.querySelector("#workspace-clear");
    const copyLink = dom.window.document.querySelector("#workspace-copy-link");
    if (!searchForm || !packetForm || !output || !selectedToggle || !addVisible || !clearSelection || !copyLink) {
      errors.push(`${page.file} did not render the research workspace controls`);
      return;
    }
    for (const text of ["Campus Evidence Lab Research Packet", "Use limits:", "source_urls", "evt_2026_0027"]) {
      if (!output.value.includes(text)) {
        errors.push(`${page.file} workspace packet missing ${text}`);
      }
    }
    if (!selectedToggle.checked) {
      errors.push(`${page.file} did not initialize selected record from URL`);
    }
    searchForm.elements.q.value = "Kentucky OCR";
    searchForm.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    if (!dom.window.location.href.includes("q=Kentucky+OCR")) {
      errors.push(`${page.file} did not preserve workspace search in URL`);
    }
  }

  if (page.eventsSmoke) {
    const form = dom.window.document.querySelector("#event-filter-form");
    if (!form) {
      errors.push(`${page.file} did not render event filter form`);
      return;
    }

    const requiredControls = ["q", "school", "state", "community", "category", "confidence", "source_type", "verification", "date_from", "date_to", "sort"];
    for (const controlName of requiredControls) {
      if (!form.elements[controlName]) {
        errors.push(`${page.file} missing event filter control ${controlName}`);
      }
    }

    form.elements.q.value = "Case Number 03-25-2099";
    form.elements.school.value = "university_of_kentucky";
    form.elements.source_type.value = "Government letter";
    form.elements.verification.value = "Verified from public source";
    form.elements.date_from.value = "2025-09-01";
    form.elements.date_to.value = "2025-10-31";
    form.elements.sort.value = "confidence_desc";
    form.elements.sort.dispatchEvent(new dom.window.Event("change", { bubbles: true, cancelable: true }));

    for (const text of [
      `1 of ${events.length} records`,
      "OCR found that the University of Kentucky violated Title VI",
      "evt_2026_0027",
      "External source URL",
      "Request a source-backed correction",
      "Verification rationale",
      "2026-06-03"
    ]) {
      if (!(await waitForText(dom, text))) {
        errors.push(`${page.file} filtered event database missing ${text}`);
      }
    }

    const eventTable = dom.window.document.querySelector(".record-table--events");
    const eventCells = eventTable?.querySelectorAll("tbody tr:first-child td") ?? [];
    if (!eventTable || eventCells.length !== 10) {
      errors.push(`${page.file} did not render a responsive event record table with 10 labelled cells`);
    }
    for (const cell of eventCells) {
      if (!cell.getAttribute("data-label")) {
        errors.push(`${page.file} event record cell is missing a mobile data-label`);
      }
    }

    if (!dom.window.location.href.includes("school=university_of_kentucky")) {
      errors.push(`${page.file} did not preserve school filter in URL`);
    }
  }

  if (page.schoolsSmoke) {
    const form = dom.window.document.querySelector("#school-filter-form");
    if (!form) {
      errors.push(`${page.file} did not render school filter form`);
      return;
    }

    for (const controlName of ["q", "state", "sort"]) {
      if (!form.elements[controlName]) {
        errors.push(`${page.file} missing school filter control ${controlName}`);
      }
    }

    form.elements.q.value = "University of Kentucky";
    form.elements.state.value = "KY";
    form.elements.sort.value = "name_asc";
    form.elements.sort.dispatchEvent(new dom.window.Event("change", { bubbles: true, cancelable: true }));

    for (const text of [
      `1 of ${schools.length} schools`,
      "University of Kentucky",
      "Open Filtered Records",
      "Build Citation Packet",
      "Timeline",
      "Institutional Responses",
      "Public Legal/OCR Items",
      "Related Sources",
      "Dataset snapshot"
    ]) {
      if (!(await waitForText(dom, text))) {
        errors.push(`${page.file} filtered school index missing ${text}`);
      }
    }

    if (!dom.window.location.href.includes("q=University+of+Kentucky") || !dom.window.location.href.includes("state=KY")) {
      errors.push(`${page.file} did not preserve school filters in URL`);
    }
  }

  if (page.sourcesSmoke) {
    const form = dom.window.document.querySelector("#source-filter-form");
    if (!form) {
      errors.push(`${page.file} did not render source filter form`);
      return;
    }

    for (const controlName of ["q", "source_type", "publisher", "sort"]) {
      if (!form.elements[controlName]) {
        errors.push(`${page.file} missing source filter control ${controlName}`);
      }
    }

    form.elements.q.value = "Case Number 03-25-2099";
    form.elements.source_type.value = "Government letter";
    form.elements.publisher.value = "U.S. Department of Education Office for Civil Rights";
    form.elements.sort.value = "title_asc";
    form.elements.sort.dispatchEvent(new dom.window.Event("change", { bubbles: true, cancelable: true }));

    for (const text of [
      `1 of ${sources.length} sources`,
      "University of Kentucky OCR Case Number 03-25-2099",
      "metadata checked",
      "External source URL",
      "Sources JSON",
      "Sources CSV",
      "Source Audit JSON"
    ]) {
      if (!(await waitForText(dom, text))) {
        errors.push(`${page.file} filtered source index missing ${text}`);
      }
    }

    if (!dom.window.location.href.includes("source_type=Government+letter") || !dom.window.location.href.includes("sort=title_asc")) {
      errors.push(`${page.file} did not preserve source filters in URL`);
    }
  }
}

for (const [index, page] of pages.entries()) {
  await renderPage(page, index);
}

if (errors.length) {
  console.error(`Render QA failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Render QA passed for ${pages.length} dynamic pages.`);
