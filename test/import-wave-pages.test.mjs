import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { rootDir } from "../scripts/lib.mjs";

test("import wave pages expose wave status, QA gates, and quarantine links", async () => {
  const index = await readFile(path.join(rootDir, "import-waves", "index.html"), "utf8");
  const detail = await readFile(path.join(rootDir, "import-waves", "ed-campus-safety-wave-002", "index.html"), "utf8");

  assert.match(index, /Import Waves/);
  assert.match(index, /ed-campus-safety-wave-002/);
  assert.match(index, /Accepted/);
  assert.match(detail, /ED Campus Safety/);
  assert.match(detail, /QA Gate Counts/);
  assert.match(detail, /Quarantine Artifact/);
  assert.match(detail, /not individual human certification/i);
});

test("ed campus safety wave 003 publishes 750 accepted candidates", async () => {
  const index = await readFile(path.join(rootDir, "import-waves", "index.html"), "utf8");
  const detail = await readFile(path.join(rootDir, "import-waves", "ed-campus-safety-wave-003", "index.html"), "utf8");
  const candidates = JSON.parse(await readFile(path.join(rootDir, "data", "import-candidates", "ed-campus-safety-wave-003.json"), "utf8"));
  const wave = JSON.parse(await readFile(path.join(rootDir, "data", "import-waves", "ed-campus-safety-wave-003.json"), "utf8"));
  const quarantine = JSON.parse(await readFile(path.join(rootDir, "data", "import-quarantine", "ed-campus-safety-wave-003.json"), "utf8"));

  assert.match(index, /ed-campus-safety-wave-003/);
  assert.equal(candidates.length, 750);
  assert.equal(wave.status, "publishable");
  assert.equal(wave.attempted_count, 750);
  assert.equal(wave.accepted_count, 750);
  assert.equal(wave.quarantined_count, 0);
  assert.equal(quarantine.rows.length, 0);
  assert.match(detail, /ED Campus Safety/);
  assert.match(detail, /QA Gate Counts/);
  assert.match(detail, /not individual human certification/i);
});
