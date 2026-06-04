import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { rootDir } from "./lib.mjs";

const errors = [];
const siteRoot = process.env.SITE_ROOT ? path.resolve(rootDir, process.env.SITE_ROOT) : rootDir;
const appUrl = pathToFileURL(path.join(siteRoot, "assets", "app.js")).href;

const pages = [
  {
    route: "/",
    file: "index.html",
    checks: [
      "102",
      "Communities represented",
      "States represented",
      "Campus civil-rights records",
      "Research Entry Points",
      "Search Event Database",
      "Latest Weekly Brief",
      "Read Methodology",
      "Download Data",
      "Trend Charts",
      "Records by Event Month",
      "Records by Affected Community",
      "Records by Source Type",
      "Small charts summarize current public records"
    ],
    linkChecks: ["/events/", "/methodology/", "/downloads/", "/briefs/brief_2026_06_03_broader_scope_seed/"],
    dashboardSmoke: true
  },
  {
    route: "/events/",
    file: "events/index.html",
    checks: ["Search", "Source type", "Verification", "Sort", "Community", "Sources", "Updated", "Events JSON", "Events CSV", "Research JSON", "Research CSV", "University of Kentucky", "Asian, Black, Latino, Native, Indigenous"],
    linkChecks: ["/sources/src_uky_2025_09_23_ocr_phd_project/"],
    eventsSmoke: true
  },
  {
    route: "/schools/",
    file: "schools/index.html",
    checks: ["Tracked Schools", "Search schools", "Most recent update", "University of Kentucky"],
    linkChecks: ["/sources/src_ed_2025_03_10_letters_60/"],
    schoolsSmoke: true
  },
  {
    route: "/briefs/",
    file: "briefs/index.html",
    checks: ["Published Briefs", "Broader Civil Rights Scope Seed", "Source-Type Breakdown", "Legal/OCR Updates", "Dataset Downloads"]
  },
  {
    route: "/sources/",
    file: "sources/index.html",
    checks: ["Source Index", "Search sources", "Source type", "Publisher", "Sort", "Audit", "External source URL", "Source Audit JSON", "University of Kentucky OCR Case Number 03-25-2099"],
    linkChecks: ["/sources/src_uky_2025_09_23_ocr_phd_project/"],
    sourcesSmoke: true
  },
  {
    route: "/quality/",
    file: "quality/index.html",
    checks: ["Snapshot Integrity", "Review System", "Black", "Latino", "Native", "Indigenous"]
  },
  {
    route: "/downloads/",
    file: "downloads/index.html",
    checks: ["Dataset Status", "Record count", "Last updated", "Schema version", "Latest snapshot hash", "Events JSON", "Research Events JSON", "Research Events CSV", "Research Schools JSON", "Research Schools CSV", "Research Sources JSON", "Research Sources CSV", "Source Audit JSON", "Changelog JSON", "Release Notes", "Snapshot Index", "Citation Guidance", "Contribution Guide", "Briefs RSS", "Source Audit Notes", "Corrections JSON", "Review Log JSON"]
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
      "Read the contribution guide",
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

  for (const text of page.checks) {
    if (!(await waitForText(dom, text))) {
      errors.push(`${page.file} did not render expected text: ${text}`);
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
    if (actionLinks.length !== 4) {
      errors.push(`${page.file} rendered ${actionLinks.length} research entry links; expected 4`);
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
      "1 of 102 records",
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
      "1 of 81 schools",
      "University of Kentucky",
      "Open event database filtered to this school",
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
      "1 of 13 sources",
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
