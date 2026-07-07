import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, "..");

const corePages = new Map([
  ["/", "Campus Evidence Lab"],
  ["/accountability-room/", "Accountability Room\n150,000 accepted import-wave QA candidates"],
  ["/proof/", "Public accountability infrastructure, not a ranking\napi/v1/index.json\nnpm run researcher:institution"],
  ["/events/", "Search source-backed campus records"],
  ["/schools/", "Search schools"],
  ["/briefs/", "Dataset notes and analysis memos"],
  ["/sources/", "source index"],
  ["/quality/", "Quality"],
  ["/import-waves/", "Import Waves"],
  ["/methodology/", "No Ranking System"],
  ["/impact/", "Proof of infrastructure"],
  ["/updates/", "Public product updates"],
  ["/trust/", "Trust & Review Packet"],
  ["/press/", "Press / Research Brief"],
  ["/acknowledgments/", "No public acknowledgments yet"],
  ["/reviewer-brief/", "Reviewer Brief"],
  ["/journalist-guide/", "Journalist Use Guide"],
  ["/guide/", "Contributor Guide"],
  ["/research-guide/", "Research Guide"],
  ["/research-workspace/", "Research Workspace"],
  ["/reviewer-queue/", "Reviewer Queue"],
  ["/external-review/", "External review packet"],
  ["/known-limits/", "Known limits and unresolved records"],
  ["/downloads/", "Download the public dataset"],
  ["/submit/", "Public sources only"],
  ["/about/", "Mission"],
  ["/license/", "License"],
]);

function jsonResponse(value) {
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify(value),
  };
}

test("public verifier retries transient 503 responses", async () => {
  let eventDetailAttempts = 0;
  const events = Array.from({ length: 100 }, (_, index) => ({
    id: `event-${String(index + 1).padStart(3, "0")}`,
    record_hash: `hash-${String(index + 1).padStart(3, "0")}`,
  }));

  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const sitemapEvents = events.map((event) => `${baseUrl}/events/${event.id}/`).join("\n");
    const routes = new Map([
      ["/RELEASE_NOTES.md", { body: "Live audit artifact\nResearch Exports" }],
      ["/sitemap.xml", { body: `<loc>${baseUrl}/</loc>\n${baseUrl}/proof/\n${baseUrl}/api/v1/index.json\n${baseUrl}/events/\n${sitemapEvents}\n${baseUrl}/schools/school-one/\n${baseUrl}/sources/source-one/\n${baseUrl}/briefs/brief-one/` }],
      ["/rss.xml", { body: `Campus Evidence Lab Briefs\n<link>${baseUrl}/briefs/</link>` }],
      ["/robots.txt", { body: `Sitemap: ${baseUrl}/sitemap.xml` }],
      ["/data/events.json", jsonResponse(events)],
      ["/data/schools.json", jsonResponse([{ id: "school-one" }])],
      ["/data/sources.json", jsonResponse([{ id: "source-one", url: "https://example.org/source" }])],
      ["/data/briefs.json", jsonResponse([{ id: "brief-one", snapshot_hash: "snapshot-one" }])],
      ["/data/snapshot-manifest.json", jsonResponse({ totals: { events: events.length, schools: 1, sources: 1 } })],
      ["/data/events-research.json", jsonResponse(events.map(({ id }) => ({ id })))],
      ["/data/product-updates.json", jsonResponse({ entries: [], entry_count: 0 })],
      ["/data/product-milestones.json", jsonResponse({ entries: [], entry_count: 0 })],
      ["/data/source-audit.json", jsonResponse({ mode: "metadata" })],
      ["/data/source-audit-live.json", jsonResponse({ mode: "live", entries: [] })],
      ["/api/v1/index.json", jsonResponse({ api_version: "v1", snapshot_id: "snapshot-test", endpoints: ["/api/v1/institutions/{school_id}.json"] })],
      ["/api/v1/snapshot.json", jsonResponse({ api_version: "v1", snapshot_id: "snapshot-test", totals: { accepted_import_wave_qa_candidates: 150000 } })],
      ["/api/v1/institutions/index.json", jsonResponse({ api_version: "v1", snapshot_id: "snapshot-test", institutions: [{ school_id: "brown_university", name: "Brown University" }] })],
      ["/api/v1/source-families.json", jsonResponse({ api_version: "v1", snapshot_id: "snapshot-test", source_families: [{ source_family: "ed_campus_safety_dataset" }] })],
      ["/api/v1/import-waves.json", jsonResponse({ api_version: "v1", snapshot_id: "snapshot-test", import_waves: [{ id: "wave-1" }] })],
      [
        "/api/v1/institutions/brown_university.json",
        jsonResponse({
          api_version: "v1",
          snapshot_id: "snapshot-test",
          school_id: "brown_university",
          routes: { api: "/api/v1/institutions/brown_university.json", citation_packet: "/api/v1/citation-packets/brown_university.json" },
        }),
      ],
      ["/api/v1/citation-packets/brown_university.json", jsonResponse({ api_version: "v1", snapshot_id: "snapshot-test", school_id: "brown_university", events: [], sources: [] })],
      ["/schools/school-one/", { body: "Dataset snapshot" }],
      ["/sources/source-one/", { body: "Source URL https://example.org/source" }],
      ["/briefs/brief-one/", { body: "Dataset Downloads snapshot-one" }],
    ]);

    if (corePages.has(pathname)) {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(corePages.get(pathname));
      return;
    }

    const event = events.find((candidate) => pathname === `/events/${candidate.id}/`);
    if (event) {
      eventDetailAttempts += 1;
      if (event.id === "event-001" && eventDetailAttempts === 1) {
        response.writeHead(503, { "content-type": "text/plain" });
        response.end("temporarily unavailable");
        return;
      }
      response.writeHead(200, { "content-type": "text/html" });
      response.end(`${event.record_hash} External source URL`);
      return;
    }

    const route = routes.get(pathname);
    if (!route) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end(`missing ${pathname}`);
      return;
    }

    response.writeHead(200, route.headers ?? { "content-type": "text/plain" });
    response.end(route.body);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const { stdout } = await execFileAsync(process.execPath, ["scripts/verify-public.mjs", baseUrl], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    assert.match(stdout, /Public verification passed/);
    assert.match(stdout, /PASS Accountability infrastructure/);
    assert.equal(eventDetailAttempts, events.length + 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
