import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { rootDir } from "../scripts/lib.mjs";
import { buildEvidenceGraph, digest, merkleProof, merkleRoot, verifyEvidenceGraph, verifyMerkleProof } from "../scripts/proof-graph-lib.mjs";

const read = async (file) => JSON.parse(await readFile(path.join(rootDir, file), "utf8"));

test("ProofGraph generation is deterministic and binds bounded evidence layers", async () => {
  const [events, schools, sources, certifications, snapshot] = await Promise.all([read("data/events.json"), read("data/schools.json"), read("data/sources.json"), read("data/certification-ledger.json"), read("data/snapshot-manifest.json")]);
  const event = events[0];
  const input = { event, school: schools.find((row) => row.id === event.school_id), sources, certification: certifications.records.find((row) => row.event_id === event.id), snapshot, generatedAt: "2026-07-15" };
  const first = buildEvidenceGraph(input);
  const second = buildEvidenceGraph(input);
  assert.deepEqual(first, second);
  assert.deepEqual(new Set(first.nodes.map((node) => node.type)), new Set(["record", "source", "bounded_claim", "institutional_response", "claim_boundary", "certification"]));
  assert.ok(first.edges.some((edge) => edge.type === "supports"));
  assert.ok(first.edges.some((edge) => edge.type === "bounds"));
});

test("Merkle proofs verify and reject tampering", () => {
  const leaves = ["a", "b", "c", "d"].map((value) => digest({ value }));
  const root = merkleRoot(leaves);
  assert.equal(verifyMerkleProof(leaves[2], merkleProof(leaves, 2), root), true);
  assert.equal(verifyMerkleProof(digest({ value: "changed" }), merkleProof(leaves, 2), root), false);
});

test("canonical hashes survive JSON serialization when optional fields are absent", async () => {
  const node = { id: "response:test", data: { text: "Recorded response", response_date: undefined } };
  const hashBefore = digest(node);
  const hashAfter = digest(JSON.parse(JSON.stringify(node)));
  assert.equal(hashAfter, hashBefore);
});

test("committed ProofGraphs verify and a changed claim is detected", async () => {
  const index = await read("proof-graph/index.json");
  assert.equal(index.graph_count, 4000);
  assert.equal(index.graphs.length, 4000);
  const graph = await read("proof-graph/graphs/evt_2024_0001.json");
  assert.equal(verifyEvidenceGraph(graph).valid, true);
  graph.nodes.find((node) => node.type === "bounded_claim").data.value = "tampered";
  const result = verifyEvidenceGraph(graph);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith("node_hash:")));
});

test("public ProofGraph explorer exposes browser verification and machine-readable artifacts", async () => {
  const [html, script, schema] = await Promise.all([readFile(path.join(rootDir, "proof-graph/index.html"), "utf8"), readFile(path.join(rootDir, "assets/proof-graph.js"), "utf8"), read("proof-graph/schema.json")]);
  assert.match(html, /Load and verify/);
  assert.match(html, /Hash verification is not truth adjudication/);
  assert.match(script, /crypto\.subtle\.digest/);
  assert.ok(schema.required.includes("registry"));
});
