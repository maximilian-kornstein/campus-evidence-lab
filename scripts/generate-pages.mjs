import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAuditProfile } from "../assets/audit-profile.js";
import { hasSubstantiveInstitutionalResponse, responseDepthDisplayProfile, responseDisplayProfile } from "../assets/record-display.js";
import { paths, readJson, rootDir } from "./lib.mjs";

const [events, schools, sources, briefs, manifest] = await Promise.all([
  readJson(paths.events),
  readJson(paths.schools),
  readJson(paths.sources),
  readJson(paths.briefs),
  readJson(paths.manifest)
]);

const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
const eventsDir = path.join(rootDir, "events");
const schoolsDir = path.join(rootDir, "schools");
const briefsDir = path.join(rootDir, "briefs");
const sourcesDir = path.join(rootDir, "sources");
const detailDepth = 2;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
          <a href="${sitePath("/events/", depth)}">Events</a>
          <a href="${sitePath("/schools/", depth)}">Schools</a>
          <a href="${sitePath("/briefs/", depth)}">Briefs</a>
          <a href="${sitePath("/sources/", depth)}">Sources</a>
          <a href="${sitePath("/quality/", depth)}">Quality</a>
          <a href="${sitePath("/methodology/", depth)}">Methodology</a>
          <a href="${sitePath("/impact/", depth)}">Impact</a>
          <a href="${sitePath("/guide/", depth)}">Guide</a>
          <a href="${sitePath("/downloads/", depth)}">Data</a>
          <a href="${sitePath("/submit/", depth)}">Submit</a>
          <a href="${sitePath("/about/", depth)}">About</a>
          <a href="${sitePath("/license/", depth)}">License</a>
        </nav>
      </div>
    </header>
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
    <footer class="site-footer">Campus Evidence Lab / Generated from public dataset</footer>
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

function verificationRationale(event, sourceCount) {
  return `${event.verification_status}; ${sourceCount} public source${sourceCount === 1 ? "" : "s"} reviewed (${event.source_types.join(", ")}). Confidence reflects source support, not severity.`;
}

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
              <p><a href="${sitePath(`/submit/?record_id=${encodeURIComponent(event.id)}`, detailDepth)}">Request a source-backed correction</a></p>
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
  const schoolDir = path.join(schoolsDir, school.id);
  await mkdir(schoolDir, { recursive: true });

  await writeFile(
    path.join(schoolDir, "index.html"),
    page(
      school.name,
      `
        <p class="page-kicker">${escapeHtml(school.state)} / ${escapeHtml(school.city)}</p>
        <h1 class="page-title page-title--small">${escapeHtml(school.name)} Dossier</h1>
        <p class="page-intro">${schoolEvents.length} source-backed record${schoolEvents.length === 1 ? "" : "s"} in the current dataset. This dossier is generated from public event records and does not rank the institution, score safety, or estimate incident prevalence.</p>
        <div class="utility-bar">
          <a class="button-link" href="${sitePath(`/events/?school=${encodeURIComponent(school.id)}`, detailDepth)}">Open Filtered Records</a>
          <a class="button-link" href="${workspaceUrlForEvents(schoolEvents, detailDepth)}">Build Citation Packet</a>
          <a class="button-link" href="${sitePath(`/submit/?record_id=${encodeURIComponent(schoolEvents[0]?.id ?? "")}`, detailDepth)}">Request Correction</a>
        </div>
        <h2 class="section-title section-title--spaced">Dossier Packets</h2>
        <div class="utility-bar">
          ${dossierPackets.map(([label, href]) => `<a class="button-link" href="${href}">${escapeHtml(label)}</a>`).join("")}
        </div>
        <h2 class="section-title section-title--spaced">Use This Dossier Responsibly</h2>
        <ul class="evidence-list">
          <li>This dossier describes public documentation in the current snapshot, not campus safety or incident frequency.</li>
          <li>Use source pages and event audit cards before citing records.</li>
          <li>Use the <a href="${sitePath("/codebook/", detailDepth)}">codebook</a> and <a href="${sitePath("/coverage/", detailDepth)}">coverage limits</a> before making comparisons or broader claims.</li>
        </ul>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              <dl>
                ${dataLine("Records", escapeHtml(schoolEvents.length))}
                ${dataLine("Communities", escapeHtml(communities.join(", ") || "None"))}
                ${dataLine("Categories", escapeHtml(categories.join(", ") || "None"))}
                ${dataLine("Latest update", escapeHtml(latestUpdate || "None"), "mono")}
                ${dataLine("Dataset snapshot", escapeHtml(manifest.hashes.full_snapshot), "mono")}
                ${dataLine("Use limit", "Do not read this dossier as a ranking, safety score, legal finding, or complete incident history.")}
                ${
                  school.website
                    ? dataLine("Website", `<a href="${escapeHtml(school.website)}" target="_blank" rel="noreferrer">${escapeHtml(school.website)}</a>`)
                    : ""
                }
              </dl>
              <h2 class="section-title section-title--spaced">Filter this dossier</h2>
              <p class="section-note">School pages are static summaries. Use these focused Events links to narrow by community or keyword before building a packet or citing records.</p>
              <div class="utility-bar">
                ${schoolFilterLinks}
                ${antisemitismLink}
              </div>
              <h2 class="section-title section-title--spaced">Timeline</h2>
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
                    ${schoolEvents
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
                      .join("")}
                  </tbody>
                </table>
              </div>
              <h2 class="section-title section-title--spaced">Institutional Responses</h2>
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
                  : `<p class="empty">No public institutional response is recorded for this school in the current dataset.</p>`
              }
              <h2 class="section-title section-title--spaced">Public Legal/OCR Items</h2>
              ${
                legalEvents.length
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
                          ${legalEvents
                            .map(
                              (event) => `
                                <tr>
                                  <td class="mono">${escapeHtml(event.date)}</td>
                                  <td><a href="${sitePath(`/events/${encodeURIComponent(event.id)}/`, detailDepth)}">${escapeHtml(event.summary)}</a></td>
                                  <td>${escapeHtml(event.legal_status || "Not recorded")}</td>
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
              <h2 class="section-title">Dossier Review Needs</h2>
              ${countTable(reviewNeeds.length ? reviewNeeds : [["No priority review flags", 0]], "Review Need")}
              <h2 class="section-title">Related Sources</h2>
              <ul class="source-list">
                ${schoolSources
                  .map(
                    (source) => `
                      <li>
                        <a href="${sitePath(`/sources/${encodeURIComponent(source.id)}/`, detailDepth)}">${escapeHtml(source.title)}</a>
                        <br><span class="section-note">${escapeHtml(source.publisher)} / ${escapeHtml(source.source_type)}</span>
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            </aside>
          </div>
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

console.log(`Generated ${events.length} event pages, ${schools.length} school pages, ${briefs.length} brief pages, and ${sources.length} source pages.`);
