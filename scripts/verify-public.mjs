const siteUrl = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

if (!siteUrl) {
  console.error("Usage: npm run verify:public -- <public-site-url>");
  process.exit(1);
}

const baseUrl = new URL(siteUrl);
if (!/^https?:$/.test(baseUrl.protocol)) {
  console.error("Public site URL must start with http:// or https://");
  process.exit(1);
}
const publicBase = baseUrl.href.replace(/\/+$/, "");
const configuredMaxFetchAttempts = Number(process.env.PUBLIC_VERIFY_MAX_FETCH_ATTEMPTS ?? 4);
const maxFetchAttempts = Number.isInteger(configuredMaxFetchAttempts) && configuredMaxFetchAttempts > 0 ? configuredMaxFetchAttempts : 4;
const retryDelayMs = 250;
const transientStatuses = new Set([429, 500, 502, 503, 504]);
const configuredFetchTimeoutMs = Number(process.env.PUBLIC_VERIFY_FETCH_TIMEOUT_MS ?? 15000);
const fetchTimeoutMs = Number.isFinite(configuredFetchTimeoutMs) && configuredFetchTimeoutMs > 0 ? configuredFetchTimeoutMs : 15000;
const configuredDetailConcurrency = Number(process.env.PUBLIC_VERIFY_DETAIL_CONCURRENCY ?? 4);
const detailConcurrency = Number.isInteger(configuredDetailConcurrency) && configuredDetailConcurrency > 0 ? configuredDetailConcurrency : 4;

function resolvePath(pathname) {
  return new URL(pathname.replace(/^\/+/, ""), `${publicBase}/`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayForResponse(response, attempt) {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 0;
  if (retryAfterSeconds > 0) return retryAfterSeconds * 1000;
  if (response.status === 429) return 2000 * attempt;
  return retryDelayMs * attempt;
}

async function fetchText(pathname, expectedText = []) {
  const url = resolvePath(pathname);
  let lastError;

  for (let attempt = 1; attempt <= maxFetchAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
    try {
      const response = await fetch(url, { redirect: "follow", signal: controller.signal });
      if (!response.ok) {
        lastError = new Error(`${url.href} returned HTTP ${response.status}`);
        if (transientStatuses.has(response.status) && attempt < maxFetchAttempts) {
          await sleep(retryDelayForResponse(response, attempt));
          continue;
        }
        throw lastError;
      }

      const text = await response.text();
      for (const expected of expectedText) {
        if (!text.includes(expected)) {
          throw new Error(`${url.href} is missing expected text: ${expected}`);
        }
      }
      return { url, text };
    } catch (error) {
      const normalizedError = error?.name === "AbortError" ? new Error(`${url.href} timed out after ${fetchTimeoutMs}ms`) : error;
      lastError = normalizedError;
      if (attempt < maxFetchAttempts && (normalizedError instanceof TypeError || /timed out after/i.test(normalizedError.message ?? ""))) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
      throw normalizedError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function fetchJson(pathname) {
  const { url, text } = await fetchText(pathname);
  try {
    return { url, json: JSON.parse(text) };
  } catch {
    throw new Error(`${url.href} did not return valid JSON`);
  }
}

async function mapWithConcurrency(items, limit, task) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

const checks = [];

async function check(label, task) {
  try {
    await task();
    checks.push({ label, status: "PASS" });
  } catch (error) {
    checks.push({ label, status: "FAIL", message: error.message });
  }
}

await check("Core pages", async () => {
  for (const [path, text] of [
    ["/", "Campus Evidence Lab"],
    ["/accountability-room/", "Accountability Room"],
    ["/proof/", "Public accountability infrastructure, not a ranking"],
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
    ["/license/", "License"]
  ]) {
    await fetchText(path, [text]);
  }
});

await check("Release artifacts", async () => {
  await fetchText("/RELEASE_NOTES.md", ["Live audit artifact", "Research Exports"]);
  await fetchText("/sitemap.xml", [`<loc>${publicBase}/</loc>`, `${publicBase}/events/`, `${publicBase}/proof/`]);
  await fetchText("/rss.xml", ["Campus Evidence Lab Briefs", `<link>${publicBase}/briefs/</link>`]);
  await fetchText("/robots.txt", [`Sitemap: ${publicBase}/sitemap.xml`]);
});

await check("Accountability infrastructure", async () => {
  await fetchText("/accountability-room/", ["Accountability Room", "accepted import-wave QA candidates"]);
  await fetchText("/proof/", ["Public accountability infrastructure, not a ranking", "api/v1/index.json", "npm run researcher:institution"]);

  const { json: index } = await fetchJson("/api/v1/index.json");
  const { json: snapshot } = await fetchJson("/api/v1/snapshot.json");
  const { json: institutionsIndex } = await fetchJson("/api/v1/institutions/index.json");
  const { json: sourceFamilies } = await fetchJson("/api/v1/source-families.json");
  const { json: importWaves } = await fetchJson("/api/v1/import-waves.json");
  const { json: brownInstitution } = await fetchJson("/api/v1/institutions/brown_university.json");
  const { json: brownCitationPacket } = await fetchJson("/api/v1/citation-packets/brown_university.json");

  if (index.api_version !== "v1") throw new Error("API index must use v1");
  if (snapshot.snapshot_id !== index.snapshot_id) throw new Error("API snapshot_id mismatch");
  if (institutionsIndex.snapshot_id !== index.snapshot_id) throw new Error("API institutions index snapshot_id mismatch");
  if (!Array.isArray(institutionsIndex.institutions) || !institutionsIndex.institutions.length) throw new Error("API institutions index is empty");
  if (!Array.isArray(sourceFamilies.source_families) || !sourceFamilies.source_families.length) throw new Error("API source-family index is empty");
  if (!Array.isArray(importWaves.import_waves) || !importWaves.import_waves.length) throw new Error("API import-wave index is empty");
  if (brownInstitution.school_id !== "brown_university") throw new Error("Brown institution API endpoint is malformed");
  if (brownInstitution.routes?.api !== "/api/v1/institutions/brown_university.json") throw new Error("Brown institution API self-route is missing");
  if (brownCitationPacket.school_id !== "brown_university") throw new Error("Brown citation packet is malformed");
});

await check("Datasets", async () => {
  const { json: events } = await fetchJson("/data/events.json");
  const { json: schools } = await fetchJson("/data/schools.json");
  const { json: sources } = await fetchJson("/data/sources.json");
  const { json: manifest } = await fetchJson("/data/snapshot-manifest.json");
  const { json: researchEvents } = await fetchJson("/data/events-research.json");
  const { json: productUpdates } = await fetchJson("/data/product-updates.json");
  const { json: productMilestones } = await fetchJson("/data/product-milestones.json");

  if (!Array.isArray(events) || events.length < 100) throw new Error(`Expected at least 100 events, found ${events.length}`);
  if (!Array.isArray(schools) || schools.length !== manifest.totals.schools) throw new Error("School count does not match manifest");
  if (!Array.isArray(sources) || sources.length !== manifest.totals.sources) throw new Error("Source count does not match manifest");
  if (!Array.isArray(researchEvents) || researchEvents.length !== events.length) throw new Error("Research events export does not match event count");
  if (manifest.totals.events !== events.length) throw new Error("Event count does not match manifest");
  if (!Array.isArray(productUpdates.entries) || productUpdates.entry_count !== productUpdates.entries.length) throw new Error("Product updates artifact is malformed");
  if (!Array.isArray(productMilestones.entries) || productMilestones.entry_count !== productMilestones.entries.length) throw new Error("Product milestones artifact is malformed");
});

await check("Source audits", async () => {
  const { json: sourceAudit } = await fetchJson("/data/source-audit.json");
  const { json: liveAudit } = await fetchJson("/data/source-audit-live.json");

  if (sourceAudit.mode !== "metadata") throw new Error("Deterministic source audit must use metadata mode");
  if (liveAudit.mode !== "live") throw new Error("Live source audit must use live mode");
  const failed = (liveAudit.entries ?? []).filter(
    (entry) => entry.launch_check_status !== "live_checked" || entry.live_status !== "ok" || entry.http_status < 200 || entry.http_status > 399
  );
  if (failed.length) throw new Error(`${failed.length} live source audit checks failed`);
});

await check("All generated detail pages", async () => {
  const { json: events } = await fetchJson("/data/events.json");
  const { json: schools } = await fetchJson("/data/schools.json");
  const { json: sources } = await fetchJson("/data/sources.json");
  const { json: briefs } = await fetchJson("/data/briefs.json");
  const { text: sitemap } = await fetchText("/sitemap.xml");

  await mapWithConcurrency(events, detailConcurrency, async (event) => {
    await fetchText(`/events/${event.id}/`, [event.record_hash, "External source URL"]);
    if (!sitemap.includes(`${publicBase}/events/${event.id}/`)) {
      throw new Error(`Sitemap is missing event ${event.id}`);
    }
  });

  await mapWithConcurrency(schools, detailConcurrency, async (school) => {
    await fetchText(`/schools/${school.id}/`, ["Dataset snapshot"]);
    if (!sitemap.includes(`${publicBase}/schools/${school.id}/`)) {
      throw new Error(`Sitemap is missing school ${school.id}`);
    }
  });

  await mapWithConcurrency(sources, detailConcurrency, async (source) => {
    await fetchText(`/sources/${source.id}/`, ["Source URL", source.url]);
    if (!sitemap.includes(`${publicBase}/sources/${source.id}/`)) {
      throw new Error(`Sitemap is missing source ${source.id}`);
    }
  });

  await mapWithConcurrency(briefs, detailConcurrency, async (brief) => {
    await fetchText(`/briefs/${brief.id}/`, ["Dataset Downloads", brief.snapshot_hash]);
    if (!sitemap.includes(`${publicBase}/briefs/${brief.id}/`)) {
      throw new Error(`Sitemap is missing brief ${brief.id}`);
    }
  });
});

for (const result of checks) {
  console.log(`${result.status} ${result.label}${result.message ? `: ${result.message}` : ""}`);
}

const failures = checks.filter((result) => result.status === "FAIL");
if (failures.length) {
  console.error(`\nPublic verification failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`\nPublic verification passed for ${publicBase}`);
