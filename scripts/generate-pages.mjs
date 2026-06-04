import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nav() {
  return `
    <header class="site-header">
      <div class="site-header__inner">
        <a class="brand" href="/">
          <span class="brand__name">Campus Evidence Lab</span>
          <span class="brand__tag">Public evidence infrastructure</span>
        </a>
        <nav class="nav" aria-label="Primary navigation">
          <a href="/">Dashboard</a>
          <a href="/events/">Events</a>
          <a href="/schools/">Schools</a>
          <a href="/briefs/">Briefs</a>
          <a href="/sources/">Sources</a>
          <a href="/quality/">Quality</a>
          <a href="/methodology/">Methodology</a>
          <a href="/downloads/">Data</a>
          <a href="/submit/">Submit</a>
          <a href="/about/">About</a>
          <a href="/license/">License</a>
        </nav>
      </div>
    </header>
  `;
}

function page(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} / Campus Evidence Lab</title>
    <link rel="stylesheet" href="/assets/styles.css">
  </head>
  <body>
    ${nav()}
    <main class="main">
      ${body}
    </main>
    <footer class="site-footer">Campus Evidence Lab / Generated from public dataset</footer>
  </body>
</html>
`;
}

function dataLine(label, value, className = "") {
  return `
    <div class="data-line">
      <dt>${escapeHtml(label)}</dt>
      <dd${className ? ` class="${className}"` : ""}>${value}</dd>
    </div>
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
                  <td><a href="/events/${encodeURIComponent(event.id)}/">${escapeHtml(event.summary)}</a></td>
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
  const responseRecords = records.filter((event) => event.institutional_response);
  if (!responseRecords.length) return `<p class="empty">No institutional responses recorded in this brief.</p>`;
  return `
    <ul class="source-list">
      ${responseRecords
        .map((event) => {
          const school = schoolMap.get(event.school_id);
          return `
            <li>
              <a href="/events/${encodeURIComponent(event.id)}/">${escapeHtml(school?.name ?? event.school_id)}</a>
              <br><span>${escapeHtml(event.institutional_response)}</span>
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
          <a href="/sources/${encodeURIComponent(source.id)}/">${escapeHtml(source.title)}</a>
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
              <dl>
                ${dataLine("School", `<a href="/schools/${encodeURIComponent(event.school_id)}/">${escapeHtml(school?.name ?? event.school_id)}</a>`)}
                ${dataLine("Date", escapeHtml(event.date), "mono")}
                ${dataLine("Location", escapeHtml(event.location))}
                ${dataLine("Category", escapeHtml(event.category))}
                ${dataLine("Communities", escapeHtml(event.affected_communities.join(", ")))}
                ${dataLine("Institutional response", escapeHtml(event.institutional_response))}
                ${dataLine("Legal status", escapeHtml(event.legal_status))}
                ${dataLine("Response date", escapeHtml(event.response_date || "None recorded"), "mono")}
                ${dataLine("Verification", escapeHtml(event.verification_status))}
                ${dataLine("Confidence", escapeHtml(event.confidence))}
                ${dataLine("Verification rationale", escapeHtml(verificationRationale(event, eventSources.length)))}
                ${dataLine("Last updated", escapeHtml(event.updated_at), "mono")}
                ${dataLine("Record hash", escapeHtml(event.record_hash), "mono")}
              </dl>
            </div>
            <aside>
              <h2 class="section-title">Sources</h2>
              <ul class="source-list">${sourceItems}</ul>
              <h2 class="section-title section-title--spaced">Correction</h2>
              <p><a href="/submit/?record_id=${encodeURIComponent(event.id)}">Request a source-backed correction</a></p>
              <h2 class="section-title section-title--spaced">Changelog</h2>
              <ul class="source-list">${changelog}</ul>
            </aside>
          </div>
        </section>
      `
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
                            <td><a href="/events/${encodeURIComponent(event.id)}/">${escapeHtml(event.summary)}</a></td>
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
      `
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
  const responseEvents = schoolEvents.filter((event) => event.institutional_response);
  const legalEvents = schoolEvents.filter((event) =>
    /ocr|legal|lawsuit|title vi|title ix|resolution|settlement|federal|doj|complaint|finding/i.test(`${event.category} ${event.legal_status}`)
  );
  const schoolDir = path.join(schoolsDir, school.id);
  await mkdir(schoolDir, { recursive: true });

  await writeFile(
    path.join(schoolDir, "index.html"),
    page(
      school.name,
      `
        <p class="page-kicker">${escapeHtml(school.state)} / ${escapeHtml(school.city)}</p>
        <h1 class="page-title page-title--small">${escapeHtml(school.name)}</h1>
        <p class="page-intro">${schoolEvents.length} source-backed record${schoolEvents.length === 1 ? "" : "s"} in the current dataset. This profile is generated from public event records and does not rank the institution.</p>
        <p><a href="/events/?school=${encodeURIComponent(school.id)}">Open event database filtered to this school</a></p>
        <section class="detail-panel">
          <div class="detail-grid">
            <div>
              <dl>
                ${dataLine("Records", escapeHtml(schoolEvents.length))}
                ${dataLine("Communities", escapeHtml(communities.join(", ") || "None"))}
                ${dataLine("Categories", escapeHtml(categories.join(", ") || "None"))}
                ${dataLine("Latest update", escapeHtml(latestUpdate || "None"), "mono")}
                ${dataLine("Dataset snapshot", escapeHtml(manifest.hashes.full_snapshot), "mono")}
                ${
                  school.website
                    ? dataLine("Website", `<a href="${escapeHtml(school.website)}" target="_blank" rel="noreferrer">${escapeHtml(school.website)}</a>`)
                    : ""
                }
              </dl>
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
                            <td><a href="/events/${encodeURIComponent(event.id)}/">${escapeHtml(event.summary)}</a></td>
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
                                  <td><a href="/events/${encodeURIComponent(event.id)}/">${escapeHtml(event.summary)}</a></td>
                                  <td>${escapeHtml(event.institutional_response)}</td>
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
                                  <td><a href="/events/${encodeURIComponent(event.id)}/">${escapeHtml(event.summary)}</a></td>
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
              <h2 class="section-title">Related Sources</h2>
              <ul class="source-list">
                ${schoolSources
                  .map(
                    (source) => `
                      <li>
                        <a href="/sources/${encodeURIComponent(source.id)}/">${escapeHtml(source.title)}</a>
                        <br><span class="section-note">${escapeHtml(source.publisher)} / ${escapeHtml(source.source_type)}</span>
                      </li>
                    `
                  )
                  .join("")}
              </ul>
            </aside>
          </div>
        </section>
      `
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
                ${dataLine("Published", escapeHtml(brief.published_date), "mono")}
                ${dataLine("Dataset version", escapeHtml(manifest.snapshot_id), "mono")}
                ${dataLine("Dataset hash", escapeHtml(brief.snapshot_hash || "See current manifest"), "mono")}
                ${dataLine("New records", escapeHtml(brief.new_event_ids.length))}
                ${dataLine("Updated records", escapeHtml(brief.updated_event_ids.length))}
                ${dataLine("Corrections", escapeHtml(brief.correction_ids.length))}
              </dl>
              <h2 class="section-title section-title--spaced">Source-Type Breakdown</h2>
              ${countTable(sourceTypeRows, "Source Type")}
              <h2 class="section-title section-title--spaced">Corrections Issued</h2>
              <p class="empty">${brief.correction_ids.length ? escapeHtml(brief.correction_ids.join(", ")) : "No corrections issued in this brief."}</p>
              <h2 class="section-title section-title--spaced">Dataset Downloads</h2>
              <ul class="source-list">
                <li><a href="/data/events.json">Events JSON</a></li>
                <li><a href="/data/events.csv">Events CSV</a></li>
                <li><a href="/data/snapshot-manifest.json">Snapshot manifest</a></li>
                <li><a href="/downloads/">All downloads</a></li>
              </ul>
            </aside>
          </div>
        </section>
      `
    )
  );
}

console.log(`Generated ${events.length} event pages, ${schools.length} school pages, ${briefs.length} brief pages, and ${sources.length} source pages.`);
