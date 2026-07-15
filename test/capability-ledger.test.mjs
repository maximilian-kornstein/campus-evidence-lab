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
const allowedStatuses = new Set(Object.keys(ledger.status_definitions));
const capability = (id) => ledger.capabilities.find((row) => row.id === id);
const metric = (id, label) => capability(id).metrics.find((row) => row.label === label).value;

test("capability ledger is bounded, evidenced, and internally consistent", async () => {
  assert.equal(ledger.summary.capabilities, ledger.capabilities.length);
  assert.equal(ledger.summary.verified_external_adoptions, ledger.capabilities.reduce((sum, row) => sum + row.external_adoption_count, 0));
  for (const row of ledger.capabilities) {
    assert.equal(allowedStatuses.has(row.status), true, `${row.id} has a defined status`);
    assert.ok(row.claim_boundary.length >= 60, `${row.id} has a substantive claim boundary`);
    assert.ok(row.evidence.length >= 2, `${row.id} links evidence`);
    for (const href of row.evidence.filter((value) => value.startsWith("/") && !value.endsWith("/"))) await access(path.join(rootDir, href));
  }
  assert.deepEqual(capability("snapshot_registry_contract").deployment.networks, []);
  assert.equal(capability("snapshot_registry_contract").status, "local_only");
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
});
