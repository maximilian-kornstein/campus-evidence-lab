import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { rootDir } from "../scripts/lib.mjs";

const execFileAsync = promisify(execFile);
const cliPath = path.join(rootDir, "scripts", "researcher-kit.mjs");

async function runCli(args) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [cliPath, ...args], {
    cwd: rootDir,
    maxBuffer: 1024 * 1024 * 10
  });
  assert.equal(stderr, "");
  return stdout;
}

test("institution command prints a human-readable accountability summary", async () => {
  const stdout = await runCli(["institution", "Brown University"]);

  assert.match(stdout, /Brown University/);
  assert.match(stdout, /brown_university/);
  assert.match(stdout, /public event records/i);
  assert.match(stdout, /accepted QA candidates/i);
  assert.match(stdout, /API: api\/v1\/institutions\/brown_university\.json/);
  assert.match(stdout, /Citation packet: api\/v1\/citation-packets\/brown_university\.json/);
  assert.doesNotMatch(stdout, /ranking|grade|high risk/i);
});

test("institution command can emit stable JSON for terminal researchers", async () => {
  const stdout = await runCli(["institution", "brown_university", "--json"]);
  const payload = JSON.parse(stdout);

  assert.equal(payload.school_id, "brown_university");
  assert.equal(payload.name, "Brown University");
  assert.ok(payload.public_event_count > 0);
  assert.ok(payload.accepted_candidate_count > 0);
  assert.equal(payload.routes.api, "/api/v1/institutions/brown_university.json");
  assert.ok(payload.public_use_limits.length > 0);
});

test("citation command prints a compact packet path with source and event counts", async () => {
  const stdout = await runCli(["citation", "brown_university"]);

  assert.match(stdout, /Brown University/);
  assert.match(stdout, /Citation packet/i);
  assert.match(stdout, /Events:/);
  assert.match(stdout, /Sources:/);
  assert.match(stdout, /api\/v1\/citation-packets\/brown_university\.json/);
});

test("api-check verifies the public API artifact set", async () => {
  const stdout = await runCli(["api-check"]);

  assert.match(stdout, /API integrity check passed/);
  assert.match(stdout, /snapshot_2026_06_03_10000_records/);
  assert.match(stdout, /institution endpoints/i);
  assert.match(stdout, /citation packets/i);
});
