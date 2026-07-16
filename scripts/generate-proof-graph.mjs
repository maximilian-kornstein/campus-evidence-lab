import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { readJson, rootDir, writeJson } from "./lib.mjs";
import { buildEvidenceGraph, digest, merkleProof, merkleRoot, PROOF_GRAPH_SCHEMA_VERSION } from "./proof-graph-lib.mjs";

const generatedAt = "2026-07-15";
const outputDir = path.join(rootDir, "proof-graph");
const graphDir = path.join(outputDir, "graphs");
const [events, schools, sources, certifications, snapshot] = await Promise.all([
  readJson(path.join(rootDir, "data/events.json")),
  readJson(path.join(rootDir, "data/schools.json")),
  readJson(path.join(rootDir, "data/sources.json")),
  readJson(path.join(rootDir, "data/certification-ledger.json")),
  readJson(path.join(rootDir, "data/snapshot-manifest.json")),
]);
const schoolMap = new Map(schools.map((row) => [row.id, row]));
const certificationMap = new Map(certifications.records.map((row) => [row.event_id, row]));

await rm(outputDir, { recursive: true, force: true });
await mkdir(graphDir, { recursive: true });

const graphs = events.map((event) => buildEvidenceGraph({
  event,
  school: schoolMap.get(event.school_id),
  sources,
  certification: certificationMap.get(event.id),
  snapshot,
  generatedAt,
})).sort((a, b) => a.record_id.localeCompare(b.record_id));
const registryLeaves = graphs.map((graph) => digest({ record_id: graph.record_id, graph_root: graph.graph_root }));
const registryRoot = merkleRoot(registryLeaves);

for (let index = 0; index < graphs.length; index += 1) {
  const graph = graphs[index];
  graph.registry = {
    root: registryRoot,
    leaf_hash: registryLeaves[index],
    leaf_index: index,
    leaf_count: graphs.length,
    proof: merkleProof(registryLeaves, index),
  };
  await writeFile(path.join(graphDir, `${graph.record_id}.json`), `${JSON.stringify(graph)}\n`);
}

const index = {
  schema_version: PROOF_GRAPH_SCHEMA_VERSION,
  generated_at: generatedAt,
  snapshot_id: snapshot.snapshot_id,
  snapshot_hash: snapshot.hashes.full_snapshot,
  graph_count: graphs.length,
  node_count: graphs.reduce((sum, graph) => sum + graph.nodes.length, 0),
  edge_count: graphs.reduce((sum, graph) => sum + graph.edges.length, 0),
  registry_root: registryRoot,
  public_claim_limit: "A valid ProofGraph proves that a published graph matches its committed hashes and snapshot registry root. It does not prove that the underlying claim is true, independently reviewed, or immutable outside CEL's published artifacts.",
  graphs: graphs.map((graph, indexValue) => ({
    record_id: graph.record_id,
    graph_id: graph.graph_id,
    graph_root: graph.graph_root,
    registry_leaf: registryLeaves[indexValue],
    path: `/proof-graph/graphs/${graph.record_id}.json`,
  })),
};
await writeJson(path.join(outputDir, "index.json"), index);
await writeJson(path.join(outputDir, "registry.json"), {
  schema_version: PROOF_GRAPH_SCHEMA_VERSION,
  generated_at: generatedAt,
  snapshot_id: snapshot.snapshot_id,
  snapshot_hash: snapshot.hashes.full_snapshot,
  graph_count: graphs.length,
  root: registryRoot,
  leaves: index.graphs.map(({ record_id, graph_root, registry_leaf }) => ({ record_id, graph_root, leaf_hash: registry_leaf })),
});
await writeJson(path.join(outputDir, "schema.json"), {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://campusevidencelab.org/proof-graph/schema.json",
  title: "CEL ProofGraph",
  type: "object",
  required: ["schema_version", "graph_id", "record_id", "snapshot_id", "snapshot_hash", "nodes", "edges", "graph_root", "registry"],
  properties: {
    schema_version: { const: PROOF_GRAPH_SCHEMA_VERSION },
    graph_id: { type: "string", pattern: "^proofgraph:" },
    record_id: { type: "string", pattern: "^evt_" },
    snapshot_id: { type: "string" },
    snapshot_hash: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    nodes: { type: "array", items: { type: "object", required: ["id", "type", "label", "data", "hash"] } },
    edges: { type: "array", items: { type: "object", required: ["id", "type", "from", "to", "hash"] } },
    graph_root: { type: "string", pattern: "^sha256:[a-f0-9]{64}$" },
    registry: { type: "object", required: ["root", "leaf_hash", "leaf_index", "leaf_count", "proof"] },
  },
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ProofGraph / Campus Evidence Lab</title>
  <link rel="stylesheet" href="../assets/styles.css">
</head>
<body>
  <header class="site-header"><div class="site-header__inner"><a class="brand" href="../"><span class="brand__name">Campus Evidence Lab</span><span class="brand__tag">Public evidence infrastructure</span></a><nav class="nav" aria-label="Primary navigation"><a href="../proof/">Proof</a><a href="../events/">Events</a><a href="../capabilities/">Capabilities</a><a href="../protocol/">Protocol</a></nav></div></header>
  <main class="main proofgraph-main">
    <p class="page-kicker">ProofGraph · ${graphs.length.toLocaleString()} record graphs</p>
    <h1 class="page-title page-title--small">Trace a public claim to its sources, boundaries, response, and certification.</h1>
    <p class="page-intro">Every CEL record is compiled into a typed evidence graph. Node and edge hashes produce a record root; every record root is included in one snapshot-wide Merkle registry. Verification runs in your browser.</p>
    <section class="proofgraph-console" aria-labelledby="proofgraph-title">
      <div>
        <h2 id="proofgraph-title">Verify a record</h2>
        <form id="proofgraph-form" class="proofgraph-form">
          <label for="proofgraph-record">Record ID</label>
          <div><input id="proofgraph-record" name="record" value="evt_2024_0001" pattern="evt_[A-Za-z0-9_]+" required><button type="submit">Load and verify</button></div>
        </form>
      </div>
      <dl class="proofgraph-registry"><div><dt>Registry root</dt><dd class="mono">${registryRoot}</dd></div><div><dt>Snapshot</dt><dd>${snapshot.snapshot_id}</dd></div><div><dt>Graphs</dt><dd>${graphs.length.toLocaleString()}</dd></div><div><dt>Typed nodes</dt><dd>${index.node_count.toLocaleString()}</dd></div></dl>
    </section>
    <section id="proofgraph-result" class="proofgraph-result" aria-live="polite"><p>Enter a record ID to inspect its graph.</p></section>
    <section class="section section--tight"><div class="section-header"><h2 class="section-title">Machine-readable protocol</h2><p class="section-note">Deterministic, downloadable, independently recomputable</p></div><div class="hero-actions"><a class="button-link button-link--primary" href="index.json">Open graph index</a><a class="button-link" href="registry.json">Open registry</a><a class="button-link" href="schema.json">Open schema</a><a class="button-link" href="../contracts/ProofGraphRegistry.sol">Open Solidity registry</a></div><aside class="known-limit"><strong>Claim boundary</strong><p>${index.public_claim_limit}</p></aside></section>
  </main>
  <footer class="site-footer">Campus Evidence Lab / Hash verification is not truth adjudication</footer>
  <script type="module" src="../assets/proof-graph.js"></script>
</body>
</html>`;
await writeFile(path.join(outputDir, "index.html"), html);
console.log(`Generated ${graphs.length} ProofGraphs with registry root ${registryRoot}`);
