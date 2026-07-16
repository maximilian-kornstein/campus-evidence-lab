import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { rootDir } from "../scripts/lib.mjs";

const load = async (name) => JSON.parse(await readFile(path.join(rootDir, "data", name), "utf8"));
const ledger = await load("capability-ledger.json");
const events = await load("events.json");
const schools = await load("schools.json");
const sources = await load("sources.json");
const certification = await load("certification-ledger.json");
const quality = await load("record-quality-audit.json");
const signals = await load("signals.json");
const feedback = await load("external-feedback-summary.json");
const proofGraphIndex = JSON.parse(await readFile(path.join(rootDir, "proof-graph/index.json"), "utf8"));
const allowedStatuses = new Set(Object.keys(ledger.status_definitions));
const capability = (id) => ledger.capabilities.find((row) => row.id === id);
const metric = (id, label) => capability(id).metrics.find((row) => row.label === label).value;

test("capability ledger is bounded, evidenced, and internally consistent", async () => {
  assert.equal(ledger.summary.capabilities, ledger.capabilities.length);
  for (const status of allowedStatuses) assert.equal(ledger.summary[status], ledger.capabilities.filter((row) => row.status === status).length);
  for (const row of ledger.capabilities) {
    assert.equal(allowedStatuses.has(row.status), true, `${row.id} has a defined status`);
    assert.ok(row.claim_boundary.length >= 60, `${row.id} has a substantive claim boundary`);
    assert.ok(row.evidence.length >= 2, `${row.id} links evidence`);
    for (const href of row.evidence.filter((value) => value.startsWith("/") && !value.endsWith("/"))) await access(path.join(rootDir, href));
  }
  assert.equal(capability("external_review_infrastructure").status, "feedback_informed");
  assert.equal(capability("partner_distribution").status, "integration_ready");
  assert.equal(capability("proof_graph_protocol").status, "verifiable_prototype");
  const serialized = JSON.stringify(ledger);
  assert.equal(serialized.includes(["external", "adoption", "count"].join("_")), false);
  assert.doesNotMatch(serialized, /(completed external|verified partner).*(reviews|adoptions)/i);
});

test("capability metrics match canonical artifacts", () => {
  assert.equal(metric("public_evidence_archive", "event records"), events.length);
  assert.equal(metric("public_evidence_archive", "institution directory records"), schools.length);
  assert.equal(metric("public_evidence_archive", "source records"), sources.length);
  assert.equal(metric("certification_and_provenance", "certified records"), certification.totals.certified);
  assert.equal(metric("certification_and_provenance", "records needing internal review"), quality.totals.needs_internal_review);
  assert.equal(metric("cel_signals", "shadow candidates"), signals.totals.shadow_signals);
  assert.equal(metric("cel_signals", "institutions represented"), signals.totals.represented_institutions);
  assert.equal(metric("cel_signals", "active-distribution institutions"), signals.totals.active_distribution_institutions);
  assert.equal(metric("external_review_infrastructure", "documented feedback contributions"), feedback.documented_contributions);
  assert.equal(feedback.themes.reduce((sum, row) => sum + row.contributions, 0), feedback.documented_contributions);
  assert.equal(metric("proof_graph_protocol", "record ProofGraphs"), proofGraphIndex.graph_count);
  assert.equal(metric("proof_graph_protocol", "typed nodes"), proofGraphIndex.node_count);
  assert.equal(metric("proof_graph_protocol", "typed edges"), proofGraphIndex.edge_count);
});

test("public capability surface leads with substance without hiding claim boundaries", async () => {
  const html = await readFile(path.join(rootDir, "capabilities/index.html"), "utf8");
  assert.match(html, /Documented feedback contributions/);
  assert.match(html, /ProofGraphs/);
  assert.doesNotMatch(html, /(completed external|verified partner).*(reviews|adoptions)/i);
});
