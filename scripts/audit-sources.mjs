import { paths, readJson, sha256, writeJson } from "./lib.mjs";

const checkOnly = process.argv.includes("--check");
const checkLive = process.argv.includes("--check-live");
const currentDate = "2026-06-03";
const outputPath = checkLive ? paths.sourceAuditLive : paths.sourceAudit;

const [events, sources] = await Promise.all([
  readJson(paths.events),
  readJson(paths.sources)
]);

async function checkUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });
    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal
      });
    }
    return {
      live_status: response.ok ? "ok" : "check_failed",
      http_status: response.status,
      final_url: response.url
    };
  } catch (error) {
    return {
      live_status: "check_failed",
      http_status: null,
      final_url: url,
      error: error.name === "AbortError" ? "timeout" : error.message
    };
  } finally {
    clearTimeout(timeout);
  }
}

const entries = [];
for (const source of sources) {
  const sourceEvents = events.filter((event) => event.source_ids.includes(source.id));
  const baseEntry = {
    source_id: source.id,
    title: source.title,
    publisher: source.publisher,
    source_type: source.source_type,
    published_date: source.published_date,
    accessed_date: source.accessed_date,
    external_url: source.url,
    internal_source_path: `/sources/${source.id}/`,
    referenced_event_ids: sourceEvents.map((event) => event.id).sort(),
    referenced_record_count: sourceEvents.length,
    launch_check_status: "metadata_checked"
  };

  if (checkLive) {
    Object.assign(baseEntry, await checkUrl(source.url), {
      launch_check_status: "live_checked"
    });
  }

  entries.push(baseEntry);
}

entries.sort((a, b) => b.referenced_record_count - a.referenced_record_count || a.source_id.localeCompare(b.source_id));

const audit = {
  generated_at: currentDate,
  mode: checkLive ? "live" : "metadata",
  source_count: sources.length,
  event_count: events.length,
  unchecked_external_urls: checkLive ? 0 : sources.length,
  notes: checkLive
    ? "Live mode attempted external URL checks. Network results are advisory because publishers can block automated requests."
    : "Metadata mode is deterministic and does not call external websites. Run npm run audit:sources:live before public launch for advisory URL checks.",
  entries,
  audit_hash: ""
};

audit.audit_hash = sha256({ ...audit, audit_hash: "" });

if (checkOnly) {
  const existing = await readJson(outputPath);
  const existingComparable = JSON.stringify(existing);
  const nextComparable = JSON.stringify(audit);
  if (existingComparable !== nextComparable) {
    console.error(`Source audit artifact is stale. Run ${checkLive ? "npm run audit:sources:live" : "npm run audit:sources"}.`);
    process.exit(1);
  }
  console.log(`Source audit check passed: ${audit.source_count} sources, ${audit.audit_hash}`);
  process.exit(0);
}

await writeJson(outputPath, audit);
console.log(`Wrote source audit for ${audit.source_count} sources.`);
console.log(audit.audit_hash);
