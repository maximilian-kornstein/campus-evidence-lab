import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildAuditProfile } from "../assets/audit-profile.js";
import { hasSubstantiveInstitutionalResponse, responseDepthDisplayProfile, responseDisplayProfile } from "../assets/record-display.js";
import { paths, readJson, rootDir } from "./lib.mjs";

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
  edDatasetProvenanceAudit,
  certificationBatches,
  edCertificationBatchReview
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
  readJson(paths.edDatasetProvenanceAudit),
  readJson(paths.certificationBatches),
  readJson(paths.edCertificationBatchReview)
]);

const schoolMap = new Map(schools.map((school) => [school.id, school]));
const sourceMap = new Map(sources.map((source) => [source.id, source]));
const challengePacketEventIds = new Set((challengeQueues.packets ?? []).map((packet) => packet.event_id));
const eventsDir = path.join(rootDir, "events");
const schoolsDir = path.join(rootDir, "schools");
const briefsDir = path.join(rootDir, "briefs");
const sourcesDir = path.join(rootDir, "sources");
const reviewDebtDir = path.join(rootDir, "review-debt");
const externalReviewDir = path.join(rootDir, "external-review");
const knownLimitsDir = path.join(rootDir, "known-limits");
const certificationDir = path.join(rootDir, "certification");
const edProvenanceDir = path.join(rootDir, "ed-provenance");
const certificationBatchesDir = path.join(rootDir, "certification-batches");
const edCertificationBatchReviewDir = path.join(rootDir, "ed-certification-batch-001");
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
          <a href="${sitePath("/review-debt/", depth)}">Review Debt</a>
          <a href="${sitePath("/certification/", depth)}">Certification</a>
          <a href="${sitePath("/certification-batches/", depth)}">Batches</a>
          <a href="${sitePath("/ed-certification-batch-001/", depth)}">ED Review</a>
          <a href="${sitePath("/external-review/", depth)}">External Review</a>
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

await mkdir(path.join(certificationDir, "batch-001"), { recursive: true });
const topCertificationRecords = (certificationLedger.records ?? [])
  .slice()
  .sort((a, b) => b.open_gates.length - a.open_gates.length || a.event_id.localeCompare(b.event_id));
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
              ${dataLine("ED Batch 001 review", `<a href="${sitePath("/ed-certification-batch-001/", 1)}">Open applied review</a>`)}
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
              ${dataLine("Applied review", `<a href="${sitePath("/ed-certification-batch-001/", 2)}">Open Batch 001 review</a>`)}
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

await mkdir(edCertificationBatchReviewDir, { recursive: true });
const edReviewRecords = edCertificationBatchReview.records ?? [];
await writeFile(
  path.join(edCertificationBatchReviewDir, "index.html"),
  page(
    "ED Certification Batch 001 Review",
    `
      <p class="page-kicker">Applied ED Batch 001 review</p>
      <h1 class="page-title page-title--small">Source-cell locators are applied, but certification still requires every gate to pass.</h1>
      <p class="page-intro">This page shows the bounded internal source-to-record review for the first ED dataset certification batch. A matched ED workbook cell is necessary, but not sufficient: category fit, affected-label boundary, date precision, response-depth, rationale specificity, and overclaim-risk gates must also pass.</p>
      <section class="detail-panel">
        <div class="detail-grid">
          <div>
            <h2 class="section-title">Batch Review Status Counts</h2>
            ${countTable(objectCountRows(edCertificationBatchReview.status_counts), "Certification Status")}
            <h2 class="section-title section-title--spaced">Open Gate Counts</h2>
            ${countTable(objectCountRows(edCertificationBatchReview.open_gate_counts), "Open Gate")}
            <h2 class="section-title section-title--spaced">Provenance Status Counts</h2>
            ${countTable(objectCountRows(edCertificationBatchReview.provenance_status_counts), "Provenance Status")}
            <h2 class="section-title section-title--spaced">Reviewed Records</h2>
            ${edBatchReviewRecordTable(edReviewRecords, 1)}
          </div>
          <aside>
            <dl>
              ${dataLine("Snapshot", escapeHtml(edCertificationBatchReview.snapshot_id), "mono")}
              ${dataLine("Standard", escapeHtml(edCertificationBatchReview.certification_standard_version), "mono")}
              ${dataLine("Batch", escapeHtml(edCertificationBatchReview.review_batch_id), "mono")}
              ${dataLine("Records", escapeHtml(edCertificationBatchReview.totals.records))}
              ${dataLine("Certified", escapeHtml(edCertificationBatchReview.totals.certified))}
              ${dataLine("Not certified", escapeHtml(edCertificationBatchReview.totals.not_certified))}
              ${dataLine("Blocked", escapeHtml(edCertificationBatchReview.totals.blocked))}
              ${dataLine("Review JSON", `<a href="${sitePath("/data/ed-certification-batch-001-review.json", 1)}">Download artifact</a>`)}
              ${dataLine("ED provenance", `<a href="${sitePath("/ed-provenance/", 1)}">Open source-cell audit</a>`)}
              ${dataLine("Ledger", `<a href="${sitePath("/certification/", 1)}">Open full ledger</a>`)}
              ${dataLine("Use limit", escapeHtml(edCertificationBatchReview.public_claim_limit))}
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
          <li>Certified means the current source-to-record gates passed for this bounded batch-review version.</li>
          <li>Not certified means at least one reviewed gate did not pass; the exact gate remains visible.</li>
          <li>Blocked means the record cannot be certified until a source-cell or identity blocker is repaired.</li>
          <li>The page must not be used as external validation, endorsement, ranking, prevalence measurement, safety scoring, severity scoring, or legal adjudication.</li>
        </ul>
      </section>
    `,
    1
  )
);

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
              ${dataLine("ED Batch 001 review", `<a href="${sitePath("/ed-certification-batch-001/", 1)}">Open applied review</a>`)}
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
