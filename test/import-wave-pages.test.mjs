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
