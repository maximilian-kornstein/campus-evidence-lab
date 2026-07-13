import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "../cel-outreach-control/lib.mjs";
import { rootDir } from "../lib.mjs";
import { fetchWithRetry, partitionArtifact, SYNC_ARTIFACT_SPECS } from "./sync-runtime-lib.mjs";

const args = parseArgs(process.argv.slice(2));
const base = String(process.env.SIGNALS_WORKER_URL || "").replace(/\/$/, "");
const token = process.env.SIGNALS_ADMIN_TOKEN || "";
if (!base || !token) throw new Error("SIGNALS_WORKER_URL and SIGNALS_ADMIN_TOKEN are required");
const artifacts = [...SYNC_ARTIFACT_SPECS];
const partnerFile = "outreach/control/signals-partners.json";
try {
  await access(path.join(rootDir, partnerFile));
  artifacts.push({ route: "/api/ingest/partners", file: partnerFile, collection: "partners", maxRows: 40 });
} catch {}
if (!args.apply) {
  console.log(JSON.stringify({ mode: "dry_run", worker: base, artifacts: artifacts.map(({ file }) => file) }, null, 2));
  process.exit(0);
}
for (const spec of artifacts) {
  const { route, file } = spec;
  const artifact = JSON.parse(await readFile(path.join(rootDir, file), "utf8"));
  const batches = partitionArtifact(spec, artifact);
  for (let index = 0; index < batches.length; index += 1) {
    const { body, estimatedStatements } = batches[index];
    const response = await fetchWithRetry(`${base}${route}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`${route} batch ${index + 1}/${batches.length} failed: ${response.status} ${await response.text()}`);
    console.log(`${route} batch ${index + 1}/${batches.length} (${estimatedStatements} estimated D1 statements)`, await response.text());
  }
}
