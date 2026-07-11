import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../cel-outreach-control/lib.mjs";
import { rootDir } from "../lib.mjs";

const args = parseArgs(process.argv.slice(2));
const base = String(process.env.SIGNALS_WORKER_URL || "").replace(/\/$/, "");
const token = process.env.SIGNALS_ADMIN_TOKEN || "";
if (!base || !token) throw new Error("SIGNALS_WORKER_URL and SIGNALS_ADMIN_TOKEN are required");
const artifacts = [
  ["/api/signals/ingest", "data/signals.json", "signals", 50],
  ["/api/ingest/identity", "data/institution-identity-index.json", "aliases", 200],
  ["/api/ingest/dossiers", "data/signal-dossiers.json", "dossiers", 50],
  ["/api/ingest/reviews", "data/signal-shadow-review.json", "decisions", 100],
  ["/api/ingest/triggers", "data/signal-triggers.json", "triggers", 100],
];
const partnerFile = "outreach/control/signals-partners.json";
try {
  await access(path.join(rootDir, partnerFile));
  artifacts.push(["/api/ingest/partners", partnerFile, "partners", 50]);
} catch {}
if (!args.apply) {
  console.log(JSON.stringify({ mode: "dry_run", worker: base, artifacts: artifacts.map(([, file]) => file) }, null, 2));
  process.exit(0);
}
for (const [route, file, collection, batchSize] of artifacts) {
  const artifact = JSON.parse(await readFile(path.join(rootDir, file), "utf8"));
  const rows = artifact[collection] ?? [];
  const batches = rows.length ? Array.from({ length: Math.ceil(rows.length / batchSize) }, (_, index) => rows.slice(index * batchSize, (index + 1) * batchSize)) : [[]];
  for (let index = 0; index < batches.length; index += 1) {
    const body = { ...artifact, [collection]: batches[index] };
    if (collection === "triggers" && index > 0) body.providers = [];
    let response;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      response = await fetch(`${base}${route}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
      if (response.ok || ![401, 429, 500, 502, 503, 504].includes(response.status) || attempt === 5) break;
      await response.text();
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
    if (!response.ok) throw new Error(`${route} batch ${index + 1}/${batches.length} failed: ${response.status} ${await response.text()}`);
    console.log(`${route} batch ${index + 1}/${batches.length}`, await response.text());
  }
}
