import path from "node:path";
import { paths, readJson, rootDir, writeJson } from "./lib.mjs";

const ledgerPath = path.join(rootDir, "data", "capability-ledger.json");
const [ledger, events, schools, sources, manifest, certification, quality, provenance, proofGraph, signals] = await Promise.all([
  readJson(ledgerPath), readJson(paths.events), readJson(paths.schools), readJson(paths.sources), readJson(paths.manifest),
  readJson(paths.certificationLedger), readJson(paths.recordQualityAudit), readJson(paths.edDatasetProvenanceAudit),
  readJson(path.join(rootDir, "proof-graph", "index.json")), readJson(paths.signals)
]);

const capability = (id) => ledger.capabilities.find((item) => item.id === id);
const metric = (item, label, value) => {
  const row = item.metrics.find((candidate) => candidate.label === label);
  if (!row) throw new Error(`Capability ${item.id} is missing metric ${label}`);
  row.value = value;
};

ledger.updated_at = "2026-07-16";
ledger.summary.proof_graphs = proofGraph.graph_count;

const archive = capability("public_evidence_archive");
archive.claim = `A public static archive exposes ${events.length.toLocaleString("en-US")} canonical records, institution pages, source metadata, limitations, and correction routes.`;
metric(archive, "event records", events.length);
metric(archive, "institution directory records", schools.length);
metric(archive, "source records", sources.length);

const cert = capability("certification_and_provenance");
cert.claim = `Deterministic gates internally certify ${certification.totals.certified.toLocaleString("en-US")} records; ${certification.totals.awaiting_review.toLocaleString("en-US")} remain awaiting review, including the source-family-checked expansion lane.`;
metric(cert, "certified records", certification.totals.certified);
metric(cert, "records needing internal review", quality.totals.needs_internal_review);
metric(cert, "ED rows with matched workbook provenance", provenance.totals.matched);

const exportsCapability = capability("research_exports");
metric(exportsCapability, "current snapshot", manifest.snapshot_id);

const signalsCapability = capability("cel_signals");
metric(signalsCapability, "shadow candidates", signals.totals.shadow_signals);
metric(signalsCapability, "institutions represented", signals.totals.represented_institutions);
metric(signalsCapability, "active-distribution institutions", signals.totals.active_distribution_institutions);

const graph = capability("proof_graph_protocol");
metric(graph, "record ProofGraphs", proofGraph.graph_count);
metric(graph, "typed nodes", proofGraph.node_count);
metric(graph, "typed edges", proofGraph.edge_count);

for (const item of ledger.capabilities) item.last_verified_at = "2026-07-16";
await writeJson(ledgerPath, ledger);
console.log(`Updated capability ledger for ${events.length} records and ${proofGraph.graph_count} ProofGraphs.`);
