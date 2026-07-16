import { readFile } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "./lib.mjs";
import { verifyEvidenceGraph } from "./proof-graph-lib.mjs";

const args = process.argv.slice(2);
const recordArg = args.find((arg) => arg.startsWith("--record="))?.split("=")[1] ?? (args.includes("--record") ? args[args.indexOf("--record") + 1] : null);
const verifyAll = args.includes("--all");
if (!recordArg && !verifyAll) throw new Error("Use --record <event_id> or --all");
const index = JSON.parse(await readFile(path.join(rootDir, "proof-graph/index.json"), "utf8"));
const records = verifyAll ? index.graphs.map((row) => row.record_id) : [recordArg];
let failures = 0;
for (const recordId of records) {
  const graph = JSON.parse(await readFile(path.join(rootDir, `proof-graph/graphs/${recordId}.json`), "utf8"));
  const result = verifyEvidenceGraph(graph);
  if (!result.valid) {
    failures += 1;
    console.error(`${recordId}: ${result.errors.join(", ")}`);
  } else if (!verifyAll) {
    console.log(JSON.stringify({ record_id: recordId, graph_root: graph.graph_root, registry_root: graph.registry.root, valid: true }, null, 2));
  }
}
if (failures) throw new Error(`${failures} ProofGraph verification failure(s)`);
if (verifyAll) console.log(`Verified ${records.length} ProofGraphs against ${index.registry_root}`);
