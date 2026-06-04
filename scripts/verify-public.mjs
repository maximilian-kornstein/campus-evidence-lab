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

function resolvePath(pathname) {
  return new URL(pathname.replace(/^\/+/, ""), `${baseUrl.href.replace(/\/+$/, "")}/`);
}

async function fetchText(pathname, expectedText = []) {
  const url = resolvePath(pathname);
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`${url.href} returned HTTP ${response.status}`);
  }

  const text = await response.text();
  for (const expected of expectedText) {
    if (!text.includes(expected)) {
      throw new Error(`${url.href} is missing expected text: ${expected}`);
    }
  }
  return { url, text };
}

async function fetchJson(pathname) {
  const { url, text } = await fetchText(pathname);
  try {
    return { url, json: JSON.parse(text) };
  } catch {
    throw new Error(`${url.href} did not return valid JSON`);
  }
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
    ["/events/", "Search source-backed campus records"],
    ["/schools/", "Search schools"],
    ["/briefs/", "Weekly dataset notes"],
    ["/sources/", "source index"],
    ["/quality/", "Quality"],
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
  await fetchText("/sitemap.xml", [baseUrl.href.replace(/\/+$/, "")]);
  await fetchText("/rss.xml", ["Campus Evidence Lab Briefs"]);
  await fetchText("/robots.txt", ["Sitemap:"]);
});

await check("Datasets", async () => {
  const { json: events } = await fetchJson("/data/events.json");
  const { json: schools } = await fetchJson("/data/schools.json");
  const { json: sources } = await fetchJson("/data/sources.json");
  const { json: manifest } = await fetchJson("/data/snapshot-manifest.json");
  const { json: researchEvents } = await fetchJson("/data/events-research.json");

  if (!Array.isArray(events) || events.length < 100) throw new Error(`Expected at least 100 events, found ${events.length}`);
  if (!Array.isArray(schools) || schools.length !== manifest.totals.schools) throw new Error("School count does not match manifest");
  if (!Array.isArray(sources) || sources.length !== manifest.totals.sources) throw new Error("Source count does not match manifest");
  if (!Array.isArray(researchEvents) || researchEvents.length !== events.length) throw new Error("Research events export does not match event count");
  if (manifest.totals.events !== events.length) throw new Error("Event count does not match manifest");
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

await check("Representative detail pages", async () => {
  const { json: events } = await fetchJson("/data/events.json");
  const { json: schools } = await fetchJson("/data/schools.json");
  const { json: sources } = await fetchJson("/data/sources.json");
  const latestEvent = [...events].sort((a, b) => b.date.localeCompare(a.date))[0];
  const firstSchool = schools[0];
  const firstSource = sources[0];

  await fetchText(`/events/${latestEvent.id}/`, [latestEvent.record_hash, "External source URL"]);
  await fetchText(`/schools/${firstSchool.id}/`, ["Dataset snapshot"]);
  await fetchText(`/sources/${firstSource.id}/`, ["Source URL"]);
});

for (const result of checks) {
  console.log(`${result.status} ${result.label}${result.message ? `: ${result.message}` : ""}`);
}

const failures = checks.filter((result) => result.status === "FAIL");
if (failures.length) {
  console.error(`\nPublic verification failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log(`\nPublic verification passed for ${baseUrl.href.replace(/\/+$/, "")}`);
