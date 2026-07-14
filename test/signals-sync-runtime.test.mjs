import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  fetchWithRetry,
  MAX_D1_STATEMENTS_PER_REQUEST,
  partitionArtifact,
  SYNC_ARTIFACT_SPECS,
} from "../scripts/signals/sync-runtime-lib.mjs";

const artifactByFile = new Map();
for (const spec of SYNC_ARTIFACT_SPECS) artifactByFile.set(spec.file, JSON.parse(await readFile(new URL(`../${spec.file}`, import.meta.url), "utf8")));

test("runtime sync partitions every artifact below the free-tier D1 statement limit", () => {
  for (const spec of SYNC_ARTIFACT_SPECS) {
    const batches = partitionArtifact(spec, artifactByFile.get(spec.file));
    assert.ok(batches.length > 0);
    assert.equal(batches.every((batch) => batch.estimatedStatements <= MAX_D1_STATEMENTS_PER_REQUEST), true, spec.route);
    if (spec.collection === "decisions") assert.equal(batches.every((batch) => batch.body.decisions.length <= 20), true);
    if (spec.collection === "aliases") assert.equal(batches.every((batch) => batch.body.aliases.length <= 20), true);
  }
});

test("signal batching accounts for each source write", () => {
  const spec = SYNC_ARTIFACT_SPECS.find((row) => row.collection === "signals");
  const signals = Array.from({ length: 20 }, (_, index) => ({ id: `sig_${index}`, sources: [{ id: "a" }, { id: "b" }] }));
  const batches = partitionArtifact(spec, { signals });
  assert.equal(batches.length, 2);
  assert.deepEqual(batches.map((batch) => batch.estimatedStatements), [45, 15]);
});

test("transient runtime sync errors retry exponentially without duplicating the successful request", async () => {
  const statuses = [503, 503, 200];
  const delays = [];
  let calls = 0;
  const response = await fetchWithRetry("https://worker.test/ingest", { method: "POST" }, {
    fetchImpl: async () => new Response("result", { status: statuses[calls++] }),
    sleep: async (delay) => delays.push(delay),
  });
  assert.equal(response.status, 200);
  assert.equal(calls, 3);
  assert.deepEqual(delays, [1000, 2000]);
});

test("workflow conditionals never reference secrets directly", async () => {
  const workflow = await readFile(new URL("../.github/workflows/signals-shadow.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /if:\s*\$\{\{[^\n]*secrets\./);
  assert.match(workflow, /if:\s*\$\{\{\s*env\.SIGNALS_WORKER_URL/);
});
